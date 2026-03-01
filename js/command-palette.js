/**
 * FlowBoard - 全局搜索与命令面板 (功能8)
 * 类似 VS Code 的命令面板体验
 */

const CommandPalette = {
    isOpen: false,
    currentQuery: '',
    selectedIndex: 0,
    results: [],
    recentItems: [],

    // 命令注册表
    commands: [
        { id: 'new-note', title: '新建笔记', icon: 'fa-sticky-note', category: '命令', action: () => { showPage('notes'); openNoteModal(); } },
        { id: 'new-task', title: '新建任务', icon: 'fa-plus', category: '命令', action: () => { showPage('tasks'); TaskBoardUI.showAddTaskModal(); } },
        { id: 'new-todo', title: '添加待办', icon: 'fa-check-circle', category: '命令', action: () => showAddTodoModal() },
        { id: 'open-ai-chat', title: '打开 AI 助手', icon: 'fa-robot', category: '命令', action: () => AIChatUI.open() },
        { id: 'start-pomodoro', title: '开始番茄钟', icon: 'fa-clock', category: '命令', action: () => PomodoroTimer.togglePanel() },
        { id: 'switch-theme', title: '切换主题', icon: 'fa-palette', category: '命令', action: () => showPage('settings') },
        { id: 'open-settings', title: '打开设置', icon: 'fa-cog', category: '命令', action: () => showPage('settings') },
        { id: 'generate-plan', title: '生成学习计划', icon: 'fa-magic', category: '命令', action: () => LearningPlanUI.showGenerateModal() }
    ],

    init() {
        this.createPalette();
        this.bindShortcuts();
        this.loadRecentItems();
    },

    createPalette() {
        const palette = document.createElement('div');
        palette.id = 'commandPalette';
        palette.className = 'command-palette';
        palette.innerHTML = `
            <div class="command-palette-overlay" onclick="CommandPalette.close()"></div>
            <div class="command-palette-container">
                <div class="command-palette-input-wrapper">
                    <i class="fas fa-search"></i>
                    <input type="text" 
                           id="commandPaletteInput" 
                           class="command-palette-input"
                           placeholder="搜索命令、文件、笔记..."
                           autocomplete="off">
                    <span class="command-palette-shortcut">ESC</span>
                </div>
                <div class="command-palette-results" id="commandPaletteResults">
                    <!-- 搜索结果 -->
                </div>
                <div class="command-palette-footer">
                    <span><kbd>↑</kbd> <kbd>↓</kbd> 导航</span>
                    <span><kbd>Enter</kbd> 确认</span>
                    <span><kbd>ESC</kbd> 关闭</span>
                </div>
            </div>
        `;

        document.body.appendChild(palette);

        // 绑定输入事件
        const input = document.getElementById('commandPaletteInput');
        input.addEventListener('input', (e) => this.onInput(e.target.value));
        input.addEventListener('keydown', (e) => this.onKeyDown(e));
    },

    bindShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K 打开
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }
            // ESC 关闭
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    },

    open() {
        this.isOpen = true;
        this.currentQuery = '';
        this.selectedIndex = 0;
        
        const palette = document.getElementById('commandPalette');
        palette.classList.add('active');
        
        const input = document.getElementById('commandPaletteInput');
        input.value = '';
        input.focus();

        // 显示最近访问
        this.showRecentItems();
    },

    close() {
        this.isOpen = false;
        document.getElementById('commandPalette')?.classList.remove('active');
    },

    async onInput(query) {
        this.currentQuery = query.trim();
        this.selectedIndex = 0;

        if (this.currentQuery.startsWith('>')) {
            // 命令模式
            await this.searchCommands(this.currentQuery.slice(1));
        } else {
            // 全局搜索
            await this.searchGlobal(this.currentQuery);
        }

        this.renderResults();
    },

    async searchCommands(query) {
        const filtered = this.commands.filter(cmd => 
            cmd.title.toLowerCase().includes(query.toLowerCase())
        );
        
        this.results = filtered.map(cmd => ({
            type: 'command',
            icon: cmd.icon,
            title: cmd.title,
            category: '命令',
            action: cmd.action
        }));
    },

    async searchGlobal(query) {
        this.results = [];

        if (!query) {
            this.showRecentItems();
            return;
        }

        // 搜索笔记
        const notes = await this.searchNotes(query);
        this.results.push(...notes);

        // 搜索任务
        const tasks = await this.searchTasks(query);
        this.results.push(...tasks);

        // 搜索知识库
        const docs = await this.searchKnowledge(query);
        this.results.push(...docs);

        // 搜索页面
        const pages = this.searchPages(query);
        this.results.push(...pages);

        // 搜索命令
        const commands = this.commands
            .filter(cmd => cmd.title.toLowerCase().includes(query.toLowerCase()))
            .map(cmd => ({
                type: 'command',
                icon: cmd.icon,
                title: cmd.title,
                category: '命令',
                action: cmd.action
            }));
        this.results.push(...commands);
    },

    async searchNotes(query) {
        // 从 localStorage 搜索笔记（保持兼容）
        const notesStr = localStorage.getItem('flowboard_notes');
        if (!notesStr) return [];

        try {
            const notes = JSON.parse(notesStr);
            return notes
                .filter(n => n.title?.toLowerCase().includes(query.toLowerCase()) || 
                            n.content?.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 5)
                .map(n => ({
                    type: 'note',
                    icon: 'fa-sticky-note',
                    title: n.title,
                    subtitle: n.content?.slice(0, 50) + '...',
                    category: '笔记',
                    action: () => { showPage('notes'); loadNote(n.id); }
                }));
        } catch (e) {
            return [];
        }
    },

    async searchTasks(query) {
        const tasks = await flowboardDB.getAll('tasks');
        return tasks
            .filter(t => t.title?.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5)
            .map(t => ({
                type: 'task',
                icon: 'fa-check-circle',
                title: t.title,
                subtitle: t.status,
                category: '任务',
                action: () => { showPage('tasks'); }
            }));
    },

    async searchKnowledge(query) {
        const docs = await flowboardDB.getAll('knowledgeDocs');
        return docs
            .filter(d => d.fileName?.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map(d => ({
                type: 'doc',
                icon: 'fa-file',
                title: d.fileName,
                category: '知识库',
                action: () => { showPage('knowledge'); KnowledgeBaseUI.previewDoc(d.id); }
            }));
    },

    searchPages(query) {
        const pages = [
            { id: 'dashboard', title: '我的主页', icon: 'fa-th-large' },
            { id: 'news', title: '资讯中心', icon: 'fa-newspaper' },
            { id: 'ai-chat', title: 'AI 助手', icon: 'fa-robot' },
            { id: 'notes', title: '笔记记录', icon: 'fa-sticky-note' },
            { id: 'calendar', title: '日程管理', icon: 'fa-calendar' },
            { id: 'tasks', title: '任务看板', icon: 'fa-columns' },
            { id: 'growth', title: '个人提升', icon: 'fa-chart-line' },
            { id: 'knowledge', title: '知识库', icon: 'fa-book' },
            { id: 'interview', title: '面试追踪', icon: 'fa-microphone' },
            { id: 'leetcode', title: 'LeetCode', icon: 'fa-code' },
            { id: 'github', title: 'GitHub', icon: 'fa-github' },
            { id: 'apps', title: '应用中心', icon: 'fa-th-large' }
        ];

        return pages
            .filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
            .map(p => ({
                type: 'page',
                icon: p.icon,
                title: p.title,
                category: '页面',
                action: () => showPage(p.id)
            }));
    },

    showRecentItems() {
        this.results = this.recentItems.slice(0, 10);
        if (this.results.length === 0) {
            this.results = [
                { type: 'tip', title: '输入关键词开始搜索', category: '提示', action: null }
            ];
        }
        this.renderResults();
    },

    renderResults() {
        const container = document.getElementById('commandPaletteResults');
        if (!container) return;

        if (this.results.length === 0) {
            container.innerHTML = '<div class="command-palette-empty">无搜索结果</div>';
            return;
        }

        // 按类别分组
        const grouped = this.groupByCategory(this.results);
        
        container.innerHTML = Object.entries(grouped).map(([category, items]) => `
            <div class="command-palette-group">
                <div class="command-palette-group-title">${category}</div>
                ${items.map((item, idx) => {
                    const globalIndex = this.results.indexOf(item);
                    return `
                        <div class="command-palette-item ${globalIndex === this.selectedIndex ? 'selected' : ''}" 
                             onclick="CommandPalette.execute(${globalIndex})">
                            <i class="fas ${item.icon || 'fa-circle'}"></i>
                            <div class="command-palette-item-content">
                                <div class="command-palette-item-title">${this.highlightMatch(item.title)}</div>
                                ${item.subtitle ? `<div class="command-palette-item-subtitle">${item.subtitle}</div>` : ''}
                            </div>
                            ${item.shortcut ? `<span class="command-palette-item-shortcut">${item.shortcut}</span>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `).join('');
    },

    groupByCategory(items) {
        const grouped = {};
        items.forEach(item => {
            const cat = item.category || '其他';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });
        return grouped;
    },

    highlightMatch(text) {
        if (!this.currentQuery) return text;
        const regex = new RegExp(`(${this.escapeRegex(this.currentQuery)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    onKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
                this.renderResults();
                this.scrollToSelected();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.renderResults();
                this.scrollToSelected();
                break;
            case 'Enter':
                e.preventDefault();
                this.execute(this.selectedIndex);
                break;
        }
    },

    scrollToSelected() {
        const container = document.getElementById('commandPaletteResults');
        const selected = container?.querySelector('.selected');
        if (selected && container) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    },

    execute(index) {
        const item = this.results[index];
        if (!item || !item.action) return;

        // 添加到最近访问
        this.addToRecent(item);

        this.close();
        item.action();
    },

    addToRecent(item) {
        // 去重并添加到开头
        this.recentItems = this.recentItems.filter(r => r.title !== item.title);
        this.recentItems.unshift(item);
        if (this.recentItems.length > 20) {
            this.recentItems = this.recentItems.slice(0, 20);
        }
        localStorage.setItem('command_palette_recent', JSON.stringify(this.recentItems));
    },

    loadRecentItems() {
        const saved = localStorage.getItem('command_palette_recent');
        if (saved) {
            try {
                this.recentItems = JSON.parse(saved);
            } catch (e) {
                this.recentItems = [];
            }
        }
    }
};

// 导出
window.CommandPalette = CommandPalette;
