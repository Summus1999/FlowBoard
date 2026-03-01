/**
 * FlowBoard - 书签与稍后阅读 (功能17)
 * 链接收藏、阅读列表、内容抓取
 */

const BookmarkManager = {
    bookmarks: [],
    categories: ['技术', '阅读', '灵感', '参考', '未分类'],

    async init() {
        await this.loadBookmarks();
        this.render();
    },

    async loadBookmarks() {
        this.bookmarks = await flowboardDB.getAll('bookmarks');
    },

    render() {
        const container = document.getElementById('bookmarkManager');
        if (!container) return;

        const grouped = this.groupByCategory();

        container.innerHTML = `
            <div class="bookmark-header">
                <h3>书签收藏</h3>
                <button class="btn-primary" onclick="BookmarkManager.showAddModal()">
                    <i class="fas fa-plus"></i> 添加书签
                </button>
            </div>
            <div class="bookmark-toolbar">
                <div class="bookmark-search">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="搜索书签..." oninput="BookmarkManager.search(this.value)">
                </div>
                <select class="bookmark-filter" onchange="BookmarkManager.filterByStatus(this.value)">
                    <option value="all">全部</option>
                    <option value="unread">未读</option>
                    <option value="read">已读</option>
                    <option value="archived">已归档</option>
                </select>
            </div>
            <div class="bookmark-content">
                ${Object.entries(grouped).map(([category, items]) => `
                    <div class="bookmark-category">
                        <h4>${category} <span class="count">(${items.length})</span></h4>
                        <div class="bookmark-list">
                            ${items.map(b => this.renderBookmarkCard(b)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    groupByCategory() {
        const groups = {};
        for (const cat of this.categories) {
            groups[cat] = [];
        }
        for (const b of this.bookmarks) {
            const cat = b.category || '未分类';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(b);
        }
        return groups;
    },

    renderBookmarkCard(bookmark) {
        return `
            <div class="bookmark-card ${bookmark.status || 'unread'}" data-id="${bookmark.id}">
                <div class="bookmark-favicon">
                    <img src="https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&size=32" 
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔖</text></svg>'">
                </div>
                <div class="bookmark-info">
                    <a href="${bookmark.url}" target="_blank" class="bookmark-title" 
                       onclick="BookmarkManager.markAsRead('${bookmark.id}')">
                        ${this.escapeHtml(bookmark.title || bookmark.url)}
                    </a>
                    <div class="bookmark-meta">
                        <span class="bookmark-url">${new URL(bookmark.url).hostname}</span>
                        <span class="bookmark-date">${new Date(bookmark.createdAt).toLocaleDateString()}</span>
                    </div>
                    ${bookmark.notes ? `<p class="bookmark-notes">${this.escapeHtml(bookmark.notes)}</p>` : ''}
                    ${bookmark.tags?.length ? `
                        <div class="bookmark-tags">
                            ${bookmark.tags.map(t => `<span class="bookmark-tag">${t}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="bookmark-actions">
                    <button onclick="BookmarkManager.markAsRead('${bookmark.id}')" title="标记已读">
                        <i class="fas fa-check"></i>
                    </button>
                    <button onclick="BookmarkManager.archive('${bookmark.id}')" title="归档">
                        <i class="fas fa-archive"></i>
                    </button>
                    <button onclick="BookmarkManager.deleteBookmark('${bookmark.id}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    showAddModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'addBookmarkModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('addBookmarkModal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>添加书签</h3>
                    <button class="close-btn" onclick="document.getElementById('addBookmarkModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>链接 URL <span class="required">*</span></label>
                        <input type="url" id="bookmarkUrl" class="form-control" placeholder="https://...">
                    </div>
                    <div class="form-group">
                        <label>标题</label>
                        <input type="text" id="bookmarkTitle" class="form-control" placeholder="留空自动获取">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>分类</label>
                            <select id="bookmarkCategory" class="form-control">
                                ${this.categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>优先级</label>
                            <select id="bookmarkPriority" class="form-control">
                                <option value="later">稍后阅读</option>
                                <option value="favorite">收藏</option>
                                <option value="archive">归档</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>备注</label>
                        <textarea id="bookmarkNotes" class="form-control" rows="2"></textarea>
                    </div>
                    <div class="form-group">
                        <label>标签（逗号分隔）</label>
                        <input type="text" id="bookmarkTags" class="form-control" placeholder="技术, 教程">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('addBookmarkModal').remove()">取消</button>
                    <button class="btn-primary" onclick="BookmarkManager.addBookmark()">添加</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async addBookmark() {
        const url = document.getElementById('bookmarkUrl').value.trim();
        if (!url) {
            showToast('请输入 URL');
            return;
        }

        let title = document.getElementById('bookmarkTitle').value.trim();
        
        // 如果没有标题，尝试获取页面标题
        if (!title) {
            title = await this.fetchPageTitle(url);
        }

        const bookmark = {
            id: flowboardDB.generateId('bookmark_'),
            url,
            title: title || url,
            category: document.getElementById('bookmarkCategory').value,
            priority: document.getElementById('bookmarkPriority').value,
            notes: document.getElementById('bookmarkNotes').value,
            tags: document.getElementById('bookmarkTags').value.split(',').map(t => t.trim()).filter(Boolean),
            status: 'unread',
            createdAt: Date.now()
        };

        await flowboardDB.put('bookmarks', bookmark);
        this.bookmarks.push(bookmark);
        
        document.getElementById('addBookmarkModal').remove();
        this.render();
        showToast('书签已添加');
    },

    async fetchPageTitle(url) {
        try {
            // 由于跨域限制，这里只能使用服务器端方案或代理
            // 简化处理：返回空，让用户手动输入
            return '';
        } catch (e) {
            return '';
        }
    },

    async markAsRead(id) {
        const bookmark = await flowboardDB.get('bookmarks', id);
        if (bookmark) {
            bookmark.status = 'read';
            bookmark.readAt = Date.now();
            await flowboardDB.put('bookmarks', bookmark);
            
            const local = this.bookmarks.find(b => b.id === id);
            if (local) local.status = 'read';
            
            this.render();
        }
    },

    async archive(id) {
        const bookmark = await flowboardDB.get('bookmarks', id);
        if (bookmark) {
            bookmark.status = 'archived';
            await flowboardDB.put('bookmarks', bookmark);
            
            const local = this.bookmarks.find(b => b.id === id);
            if (local) local.status = 'archived';
            
            this.render();
            showToast('已归档');
        }
    },

    async deleteBookmark(id) {
        if (!confirm('确定删除这个书签吗？')) return;
        
        await flowboardDB.delete('bookmarks', id);
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        this.render();
    },

    search(query) {
        if (!query) {
            this.render();
            return;
        }

        const filtered = this.bookmarks.filter(b => 
            b.title?.toLowerCase().includes(query.toLowerCase()) ||
            b.url?.toLowerCase().includes(query.toLowerCase()) ||
            b.notes?.toLowerCase().includes(query.toLowerCase()) ||
            b.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
        );

        // 临时渲染搜索结果
        const container = document.querySelector('.bookmark-content');
        if (container) {
            container.innerHTML = `
                <div class="bookmark-list">
                    ${filtered.map(b => this.renderBookmarkCard(b)).join('')}
                </div>
            `;
        }
    },

    filterByStatus(status) {
        if (status === 'all') {
            this.render();
            return;
        }

        const filtered = this.bookmarks.filter(b => b.status === status);
        const container = document.querySelector('.bookmark-content');
        if (container) {
            container.innerHTML = `
                <div class="bookmark-list">
                    ${filtered.map(b => this.renderBookmarkCard(b)).join('')}
                </div>
            `;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 快速添加书签命令
CommandPalette.commands.push({
    id: 'add-bookmark',
    title: '添加书签',
    icon: 'fa-bookmark',
    category: '命令',
    action: () => BookmarkManager.showAddModal()
});

// 导出
window.BookmarkManager = BookmarkManager;
