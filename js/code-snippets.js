/**
 * FlowBoard - 代码片段仓库 (功能12)
 * 代码收藏、分类管理、编辑器集成
 */

const CodeSnippets = {
    snippets: [],
    currentLanguage: 'javascript',

    async init() {
        await this.loadSnippets();
        this.render();
    },

    async loadSnippets() {
        this.snippets = await flowboardDB.getAll('codeSnippets');
        if (this.snippets.length === 0) {
            // 加载预设片段
            await this.loadPresetSnippets();
        }
    },

    async loadPresetSnippets() {
        const presets = [
            {
                id: 'preset_twosum',
                title: '两数之和',
                language: 'javascript',
                code: `function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}`,
                tags: ['algorithm', 'hashmap', 'leetcode'],
                category: '算法模板',
                isPreset: true
            },
            {
                id: 'preset_bfs',
                title: 'BFS 模板',
                language: 'javascript',
                code: `function bfs(start, target) {
    const queue = [start];
    const visited = new Set([start]);
    
    while (queue.length > 0) {
        const node = queue.shift();
        if (node === target) return true;
        
        for (const neighbor of getNeighbors(node)) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return false;
}`,
                tags: ['algorithm', 'bfs', 'graph'],
                category: '算法模板',
                isPreset: true
            },
            {
                id: 'preset_dfs',
                title: 'DFS 模板',
                language: 'javascript',
                code: `function dfs(node, visited = new Set()) {
    if (!node || visited.has(node)) return;
    
    visited.add(node);
    console.log(node.value);
    
    for (const child of node.children) {
        dfs(child, visited);
    }
}`,
                tags: ['algorithm', 'dfs', 'graph'],
                category: '算法模板',
                isPreset: true
            },
            {
                id: 'preset_dp',
                title: '动态规划模板',
                language: 'javascript',
                code: `function dp(n) {
    // 1. 定义状态
    const dp = new Array(n + 1).fill(0);
    
    // 2. 初始状态
    dp[0] = 0;
    dp[1] = 1;
    
    // 3. 状态转移
    for (let i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    
    // 4. 返回结果
    return dp[n];
}`,
                tags: ['algorithm', 'dp', 'dynamic-programming'],
                category: '算法模板',
                isPreset: true
            },
            {
                id: 'preset_binarysearch',
                title: '二分查找',
                language: 'javascript',
                code: `function binarySearch(nums, target) {
    let left = 0, right = nums.length - 1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}`,
                tags: ['algorithm', 'binary-search'],
                category: '算法模板',
                isPreset: true
            }
        ];

        for (const snippet of presets) {
            await flowboardDB.put('codeSnippets', snippet);
        }
        this.snippets = presets;
    },

    render() {
        const container = document.getElementById('codeSnippets');
        if (!container) return;

        const categories = this.groupByCategory();
        
        container.innerHTML = `
            <div class="snippets-header">
                <h3>代码片段</h3>
                <button class="btn-primary" onclick="CodeSnippets.showAddModal()">
                    <i class="fas fa-plus"></i> 新建片段
                </button>
            </div>
            <div class="snippets-toolbar">
                <div class="snippets-search">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="搜索代码片段..." 
                           oninput="CodeSnippets.search(this.value)">
                </div>
                <select class="language-filter" onchange="CodeSnippets.filterByLanguage(this.value)">
                    <option value="">所有语言</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="go">Go</option>
                </select>
            </div>
            <div class="snippets-content">
                ${Object.entries(categories).map(([category, snippets]) => `
                    <div class="snippet-category">
                        <h4>${category}</h4>
                        <div class="snippet-list">
                            ${snippets.map(s => this.renderSnippetCard(s)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    groupByCategory() {
        const groups = {};
        for (const s of this.snippets) {
            const cat = s.category || '未分类';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        }
        return groups;
    },

    renderSnippetCard(snippet) {
        return `
            <div class="snippet-card" data-id="${snippet.id}">
                <div class="snippet-header">
                    <span class="snippet-title">${this.escapeHtml(snippet.title)}</span>
                    <span class="snippet-lang">${snippet.language}</span>
                </div>
                <div class="snippet-preview">
                    <pre><code>${this.escapeHtml(snippet.code.slice(0, 150))}${snippet.code.length > 150 ? '...' : ''}</code></pre>
                </div>
                <div class="snippet-tags">
                    ${(snippet.tags || []).map(t => `<span class="snippet-tag">${t}</span>`).join('')}
                </div>
                <div class="snippet-actions">
                    <button onclick="CodeSnippets.copyToClipboard('${snippet.id}')" title="复制">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="CodeSnippets.insertToEditor('${snippet.id}')" title="插入编辑器">
                        <i class="fas fa-code"></i>
                    </button>
                    <button onclick="CodeSnippets.showEditModal('${snippet.id}')" title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!snippet.isPreset ? `
                        <button onclick="CodeSnippets.deleteSnippet('${snippet.id}')" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    showAddModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'addSnippetModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('addSnippetModal').remove()"></div>
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>新建代码片段</h3>
                    <button class="close-btn" onclick="document.getElementById('addSnippetModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label>标题</label>
                            <input type="text" id="snippetTitle" class="form-control" placeholder="例如：快速排序">
                        </div>
                        <div class="form-group">
                            <label>语言</label>
                            <select id="snippetLanguage" class="form-control">
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="go">Go</option>
                                <option value="rust">Rust</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>分类</label>
                        <select id="snippetCategory" class="form-control">
                            <option value="算法模板">算法模板</option>
                            <option value="数据结构">数据结构</option>
                            <option value="设计模式">设计模式</option>
                            <option value="工具函数">工具函数</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>代码</label>
                        <textarea id="snippetCode" class="form-control code-editor" rows="10" 
                                  placeholder="在此粘贴代码..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>标签（用逗号分隔）</label>
                        <input type="text" id="snippetTags" class="form-control" placeholder="例如：排序, 数组, 算法">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('addSnippetModal').remove()">取消</button>
                    <button class="btn-primary" onclick="CodeSnippets.addSnippet()">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async addSnippet() {
        const title = document.getElementById('snippetTitle').value.trim();
        const code = document.getElementById('snippetCode').value.trim();
        
        if (!title || !code) {
            showToast('请填写标题和代码');
            return;
        }

        const snippet = {
            id: flowboardDB.generateId('snippet_'),
            title,
            language: document.getElementById('snippetLanguage').value,
            category: document.getElementById('snippetCategory').value,
            code,
            tags: document.getElementById('snippetTags').value.split(',').map(t => t.trim()).filter(Boolean),
            createdAt: Date.now()
        };

        await flowboardDB.put('codeSnippets', snippet);
        this.snippets.push(snippet);
        
        document.getElementById('addSnippetModal').remove();
        this.render();
        showToast('代码片段已保存');
    },

    async copyToClipboard(id) {
        const snippet = this.snippets.find(s => s.id === id);
        if (!snippet) return;

        await navigator.clipboard.writeText(snippet.code);
        showToast('已复制到剪贴板');
    },

    insertToEditor(id) {
        const snippet = this.snippets.find(s => s.id === id);
        if (!snippet) return;

        // 检查是否在 LeetCode 页面
        if (window.insertToLeetCodeEditor) {
            window.insertToLeetCodeEditor(snippet.code);
            showToast('已插入到编辑器');
        } else {
            this.copyToClipboard(id);
            showToast('已复制，请在编辑器中粘贴');
        }
    },

    search(query) {
        if (!query) {
            this.render();
            return;
        }

        const filtered = this.snippets.filter(s => 
            s.title.toLowerCase().includes(query.toLowerCase()) ||
            s.code.toLowerCase().includes(query.toLowerCase()) ||
            (s.tags || []).some(t => t.toLowerCase().includes(query.toLowerCase()))
        );

        // 临时替换渲染
        const container = document.querySelector('.snippets-content');
        if (container) {
            container.innerHTML = `
                <div class="snippet-list">
                    ${filtered.map(s => this.renderSnippetCard(s)).join('')}
                </div>
            `;
        }
    },

    filterByLanguage(lang) {
        if (!lang) {
            this.render();
            return;
        }

        const filtered = this.snippets.filter(s => s.language === lang);
        const container = document.querySelector('.snippets-content');
        if (container) {
            container.innerHTML = `
                <div class="snippet-list">
                    ${filtered.map(s => this.renderSnippetCard(s)).join('')}
                </div>
            `;
        }
    },

    async deleteSnippet(id) {
        const snippet = this.snippets.find(s => s.id === id);
        if (snippet?.isPreset) {
            showToast('预设片段不能删除');
            return;
        }

        if (!confirm('确定删除这个代码片段吗？')) return;

        await flowboardDB.delete('codeSnippets', id);
        this.snippets = this.snippets.filter(s => s.id !== id);
        this.render();
        showToast('已删除');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出
window.CodeSnippets = CodeSnippets;
