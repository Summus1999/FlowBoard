/**
 * FlowBoard - 笔记记录模块（支持 Markdown）
 * 支持 Markdown 编辑、实时预览、分屏模式
 */

// ========================================
// 全局状态
// ========================================

let notesState = {
    notes: [],
    currentNoteId: null,
    filter: 'all',
    searchQuery: '',
    autoSaveTimer: null,
    editorMode: 'markdown', // 'markdown', 'preview', 'split'
    isMarkdownDirty: false
};

// 分类配置
const noteCategories = {
    work: { name: '工作', icon: 'fas fa-briefcase', color: '#1677FF' },
    study: { name: '学习', icon: 'fas fa-book', color: '#07C160' },
    life: { name: '生活', icon: 'fas fa-coffee', color: '#FB7299' },
    idea: { name: '灵感', icon: 'fas fa-lightbulb', color: '#FFA116' }
};

// ========================================
// 初始化
// ========================================

function initNotes() {
    // 从 localStorage 加载笔记
    loadNotesFromStorage();
    
    // 如果没有笔记，添加示例笔记
    if (notesState.notes.length === 0) {
        addSampleNotes();
    }
    
    // 渲染笔记列表
    renderNotesList();
    
    // 初始化编辑器事件
    initNoteEditorEvents();
    
    // 初始化 marked
    initMarked();
}

function initMarked() {
    if (typeof marked === 'undefined') {
        console.warn('marked.js 未加载');
        return;
    }
    
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false,
        sanitize: false,
        smartLists: true,
        smartypants: true,
        xhtml: false,
        highlight: function(code, lang) {
            if (typeof hljs !== 'undefined' && lang) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (e) {
                    return code;
                }
            }
            return code;
        }
    });
}

function addSampleNotes() {
    const sampleNotes = [
        {
            id: Date.now(),
            title: '欢迎使用 Markdown 笔记',
            content: `# 欢迎使用 Markdown 笔记功能

这是一个支持 **Markdown** 语法的笔记功能。

## 支持的语法

### 1. 文本样式
- **粗体文本**
- *斜体文本*
- ~~删除线~~
- \`行内代码\`

### 2. 列表
无序列表：
- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2

有序列表：
1. 第一步
2. 第二步
3. 第三步

### 3. 代码块
\`\`\`javascript
function hello() {
    console.log("Hello, Markdown!");
}
\`\`\`

### 4. 引用
> 这是一段引用文本
> 可以有多行

### 5. 链接和图片
[访问 GitHub](https://github.com)

---

**提示**：点击右上角的切换按钮可以在编辑/预览/分屏模式间切换。`,
            category: 'idea',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: Date.now() + 1,
            title: 'FlowBoard 使用指南',
            content: `# FlowBoard 使用指南

## 功能模块

1. **账户管理** - 安全存储各类账号密码
2. **笔记记录** - 支持 Markdown 的笔记功能
3. **LeetCode** - 刷题练习和代码编辑
4. **资讯中心** - 查看最新热点新闻

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| \`Tab\` | 插入缩进 |
| \`Ctrl/Cmd + S\` | 保存笔记 |

---

> 开始记录你的想法吧！`,
            category: 'study',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
    
    notesState.notes = sampleNotes;
    saveNotesToStorage();
}

// ========================================
// 数据持久化
// ========================================

function loadNotesFromStorage() {
    try {
        const stored = localStorage.getItem('flowboard_notes');
        if (stored) {
            notesState.notes = JSON.parse(stored);
        }
    } catch (error) {
        console.error('加载笔记失败:', error);
        notesState.notes = [];
    }
}

function saveNotesToStorage() {
    try {
        localStorage.setItem('flowboard_notes', JSON.stringify(notesState.notes));
    } catch (error) {
        console.error('保存笔记失败:', error);
    }
}

// ========================================
// 编辑器模式切换
// ========================================

function switchEditorMode(mode) {
    notesState.editorMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    const container = document.getElementById('noteEditorContainer');
    const editor = document.getElementById('noteMarkdownEditor');
    const preview = document.getElementById('notePreviewPane');
    const toolbar = document.querySelector('.markdown-toolbar');
    
    if (!container || !editor || !preview) return;
    
    // 移除所有模式类
    container.classList.remove('split-mode', 'preview-mode');
    
    switch (mode) {
        case 'markdown':
            // 纯编辑模式
            editor.style.display = 'block';
            preview.style.display = 'none';
            if (toolbar) toolbar.style.display = 'flex';
            break;
            
        case 'preview':
            // 纯预览模式
            editor.style.display = 'none';
            preview.style.display = 'block';
            if (toolbar) toolbar.style.display = 'none';
            // 更新预览
            updatePreview();
            break;
            
        case 'split':
            // 分屏模式
            container.classList.add('split-mode');
            editor.style.display = 'block';
            preview.style.display = 'block';
            if (toolbar) toolbar.style.display = 'flex';
            // 更新预览
            updatePreview();
            break;
    }
}

function updatePreview() {
    const editor = document.getElementById('noteMarkdownEditor');
    const preview = document.getElementById('notePreviewPane');
    
    if (!editor || !preview || typeof marked === 'undefined') return;
    
    const markdown = editor.value;
    const html = marked.parse(markdown);
    preview.innerHTML = html;
    
    // 代码高亮
    if (typeof hljs !== 'undefined') {
        preview.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}

// ========================================
// Markdown 工具栏
// ========================================

function insertMarkdown(before, after = '') {
    const editor = document.getElementById('noteMarkdownEditor');
    if (!editor) return;
    
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const selected = value.substring(start, end);
    
    // 插入 Markdown 语法
    const newValue = value.substring(0, start) + before + selected + after + value.substring(end);
    editor.value = newValue;
    
    // 恢复光标位置
    const newCursorPos = start + before.length + selected.length;
    editor.setSelectionRange(newCursorPos, newCursorPos);
    editor.focus();
    
    // 触发输入事件以更新预览和保存
    editor.dispatchEvent(new Event('input'));
}

// ========================================
// 笔记列表渲染
// ========================================

function renderNotesList() {
    const listContainer = document.getElementById('notesList');
    if (!listContainer) return;
    
    let filtered = notesState.notes.filter(note => {
        // 分类筛选
        if (notesState.filter !== 'all' && note.category !== notesState.filter) {
            return false;
        }
        // 搜索筛选
        if (notesState.searchQuery) {
            const query = notesState.searchQuery.toLowerCase();
            const titleMatch = note.title && note.title.toLowerCase().includes(query);
            const contentMatch = note.content && note.content.toLowerCase().includes(query);
            return titleMatch || contentMatch;
        }
        return true;
    });
    
    // 按更新时间倒序
    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="notes-empty">
                <i class="fas fa-sticky-note"></i>
                <p>${notesState.searchQuery ? '没有找到匹配的笔记' : '暂无笔记，点击新建笔记开始记录'}</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = filtered.map(note => {
        const isActive = notesState.currentNoteId === note.id;
        const category = noteCategories[note.category] || noteCategories.idea;
        const preview = stripHtml(note.content || '').substring(0, 60) + '...';
        const date = formatDate(note.updatedAt);
        
        return `
            <div class="note-item ${isActive ? 'active' : ''}" onclick="selectNote(${note.id})">
                <div class="note-item-title">${escapeHtml(note.title || '无标题')}</div>
                <div class="note-item-preview">${escapeHtml(preview)}</div>
                <div class="note-item-meta">
                    <span class="note-item-category ${note.category}">${category.name}</span>
                    <span>${date}</span>
                    <div class="note-item-actions" onclick="event.stopPropagation()">
                        <button class="note-item-action" onclick="deleteNote(${note.id})" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// 笔记操作
// ========================================

function selectNote(id) {
    const note = notesState.notes.find(n => n.id === id);
    if (!note) return;
    
    notesState.currentNoteId = id;
    
    // 填充编辑器
    document.getElementById('noteTitleInput').value = note.title || '';
    document.getElementById('noteCategorySelect').value = note.category || 'idea';
    document.getElementById('noteMarkdownEditor').value = note.content || '';
    
    // 更新预览
    updatePreview();
    
    // 更新字数统计
    updateWordCount();
    
    // 重新渲染列表以更新选中状态
    renderNotesList();
}

function createNewNote() {
    const newNote = {
        id: Date.now(),
        title: '',
        content: '',
        category: 'idea',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    notesState.notes.unshift(newNote);
    notesState.currentNoteId = newNote.id;
    
    // 清空编辑器
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteCategorySelect').value = 'idea';
    document.getElementById('noteMarkdownEditor').value = '';
    
    // 更新预览
    updatePreview();
    updateWordCount();
    renderNotesList();
    saveNotesToStorage();
    
    // 切换到编辑模式
    switchEditorMode('markdown');
    
    // 聚焦到标题输入框
    document.getElementById('noteTitleInput').focus();
}

function saveCurrentNote() {
    if (!notesState.currentNoteId) {
        showToast('请先选择或创建一个笔记');
        return;
    }
    
    const note = notesState.notes.find(n => n.id === notesState.currentNoteId);
    if (!note) return;
    
    note.title = document.getElementById('noteTitleInput').value.trim() || '无标题';
    note.category = document.getElementById('noteCategorySelect').value;
    note.content = document.getElementById('noteMarkdownEditor').value;
    note.updatedAt = new Date().toISOString();
    
    saveNotesToStorage();
    renderNotesList();
    
    // 显示保存状态
    const statusEl = document.getElementById('noteSaveStatus');
    if (statusEl) {
        statusEl.textContent = '已保存 ' + formatTime(new Date());
        setTimeout(() => {
            statusEl.textContent = '自动保存';
        }, 2000);
    }
    
    showToast('笔记已保存');
}

function deleteNote(id) {
    if (!confirm('确定要删除这个笔记吗？')) return;
    
    const index = notesState.notes.findIndex(n => n.id === id);
    if (index > -1) {
        notesState.notes.splice(index, 1);
        
        // 如果删除的是当前选中的笔记，清空编辑器
        if (notesState.currentNoteId === id) {
            notesState.currentNoteId = null;
            document.getElementById('noteTitleInput').value = '';
            document.getElementById('noteMarkdownEditor').value = '';
            updatePreview();
            updateWordCount();
        }
        
        saveNotesToStorage();
        renderNotesList();
        showToast('笔记已删除');
    }
}

// ========================================
// 筛选和搜索
// ========================================

function filterNotes(category) {
    notesState.filter = category;
    
    // 更新按钮状态
    document.querySelectorAll('.note-cat-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.cat === category) {
            btn.classList.add('active');
        }
    });
    
    renderNotesList();
}

function searchNotes() {
    const input = document.getElementById('noteSearch');
    notesState.searchQuery = input ? input.value.trim() : '';
    renderNotesList();
}

// ========================================
// 编辑器事件
// ========================================

function initNoteEditorEvents() {
    const titleInput = document.getElementById('noteTitleInput');
    const categorySelect = document.getElementById('noteCategorySelect');
    const editor = document.getElementById('noteMarkdownEditor');
    
    // 自动保存
    const autoSave = () => {
        if (notesState.autoSaveTimer) {
            clearTimeout(notesState.autoSaveTimer);
        }
        notesState.autoSaveTimer = setTimeout(() => {
            if (notesState.currentNoteId) {
                saveCurrentNote();
            }
        }, 2000);
    };
    
    if (titleInput) {
        titleInput.addEventListener('input', autoSave);
    }
    
    if (categorySelect) {
        categorySelect.addEventListener('change', autoSave);
    }
    
    if (editor) {
        editor.addEventListener('input', () => {
            updateWordCount();
            autoSave();
            
            // 分屏或预览模式下实时更新
            if (notesState.editorMode === 'split' || notesState.editorMode === 'preview') {
                updatePreview();
            }
        });
        
        // 支持 Tab 键
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.setSelectionRange(start + 4, start + 4);
            }
            
            // Ctrl/Cmd + S 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveCurrentNote();
            }
        });
    }
}

function updateWordCount() {
    const editor = document.getElementById('noteMarkdownEditor');
    const countEl = document.getElementById('noteWordCount');
    if (!editor || !countEl) return;
    
    const text = editor.value;
    const count = text.length;
    const lines = text.split('\n').length;
    countEl.textContent = `${count} 字 | ${lines} 行`;
}

// ========================================
// 模态框
// ========================================

function openNoteModal() {
    createNewNote();
}

function closeNoteModal() {
    document.getElementById('noteModal')?.classList.remove('active');
}

// ========================================
// 工具函数
// ========================================

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    // 小于1小时显示"x分钟前"
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return minutes < 1 ? '刚刚' : `${minutes}分钟前`;
    }
    
    // 小于24小时显示"x小时前"
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}小时前`;
    }
    
    // 否则显示日期
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTime(date) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

console.log('Markdown 笔记模块已加载 📝');
