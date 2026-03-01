/**
 * FlowBoard - 多窗口与工作区 (功能16)
 * Electron 多窗口管理、工作区保存恢复
 */

const MultiWindowManager = {
    windows: [],
    maxWindows: 5,
    currentWorkspace: null,

    init() {
        this.setupWindowControls();
        this.loadWorkspaces();
    },

    setupWindowControls() {
        // 为页面头部添加弹出按钮
        setTimeout(() => {
            document.querySelectorAll('.page-header h2').forEach(header => {
                const popoutBtn = document.createElement('button');
                popoutBtn.className = 'btn-text popout-btn';
                popoutBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
                popoutBtn.title = '在新窗口打开';
                popoutBtn.onclick = () => this.popoutCurrentPage();
                header.parentElement.appendChild(popoutBtn);
            });
        }, 1000);
    },

    async popoutCurrentPage() {
        if (this.windows.length >= this.maxWindows) {
            showToast('最多只能打开 5 个窗口');
            return;
        }

        const currentPage = document.querySelector('.page.active');
        if (!currentPage) return;

        const pageId = currentPage.id.replace('page-', '');
        const pageTitle = currentPage.querySelector('h2')?.textContent || 'FlowBoard';

        // 在 Electron 环境中使用 BrowserWindow
        if (window.electronAPI) {
            try {
                await window.electronAPI.openWindow({
                    page: pageId,
                    title: pageTitle
                });
                this.windows.push({ id: pageId, type: 'electron' });
            } catch (error) {
                // 降级：使用浏览器窗口
                this.openBrowserWindow(pageId, pageTitle);
            }
        } else {
            // 浏览器环境：使用 window.open
            this.openBrowserWindow(pageId, pageTitle);
        }
    },

    openBrowserWindow(pageId, title) {
        const width = 1200;
        const height = 800;
        const left = (screen.width - width) / 2 + this.windows.length * 20;
        const top = (screen.height - height) / 2 + this.windows.length * 20;

        const win = window.open(
            `${window.location.origin}${window.location.pathname}#${pageId}`,
            `flowboard-${pageId}`,
            `width=${width},height=${height},left=${left},top=${top}`
        );

        if (win) {
            this.windows.push({ id: pageId, window: win, type: 'browser' });
            win.onbeforeunload = () => {
                this.windows = this.windows.filter(w => w.id !== pageId);
            };
        }
    },

    // 工作区管理
    async saveWorkspace() {
        const workspace = {
            id: flowboardDB.generateId('ws_'),
            name: prompt('输入工作区名称:', `工作区 ${new Date().toLocaleDateString()}`),
            createdAt: Date.now(),
            layout: {
                mainPage: document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard',
                popoutWindows: this.windows.map(w => ({ page: w.id }))
            }
        };

        if (!workspace.name) return;

        await flowboardDB.put('workspaces', workspace);
        showToast('工作区已保存');
        this.loadWorkspaces();
    },

    async loadWorkspaces() {
        const workspaces = await flowboardDB.getAll('workspaces');
        workspaces.sort((a, b) => b.createdAt - a.createdAt);
        
        // 更新 UI
        const container = document.getElementById('workspaceList');
        if (container) {
            container.innerHTML = workspaces.map(ws => `
                <div class="workspace-item">
                    <span>${this.escapeHtml(ws.name)}</span>
                    <button onclick="MultiWindowManager.loadWorkspace('${ws.id}')">加载</button>
                    <button onclick="MultiWindowManager.deleteWorkspace('${ws.id}')">删除</button>
                </div>
            `).join('');
        }
    },

    async loadWorkspace(workspaceId) {
        const workspace = await flowboardDB.get('workspaces', workspaceId);
        if (!workspace) return;

        // 关闭现有弹窗
        this.closeAllPopouts();

        // 加载主页面
        if (workspace.layout.mainPage) {
            showPage(workspace.layout.mainPage);
        }

        // 恢复弹窗
        setTimeout(() => {
            for (const win of workspace.layout.popoutWindows || []) {
                this.popoutPage(win.page);
            }
        }, 500);

        showToast('工作区已加载');
    },

    async deleteWorkspace(workspaceId) {
        if (!confirm('确定删除这个工作区吗？')) return;
        await flowboardDB.delete('workspaces', workspaceId);
        this.loadWorkspaces();
    },

    closeAllPopouts() {
        for (const win of this.windows) {
            if (win.type === 'browser' && win.window) {
                win.window.close();
            }
        }
        this.windows = [];
    },

    popoutPage(pageId) {
        const pageNames = {
            'notes': '笔记记录',
            'leetcode': 'LeetCode',
            'tasks': '任务看板',
            'ai-chat': 'AI 助手',
            'knowledge': '知识库'
        };
        this.openBrowserWindow(pageId, pageNames[pageId] || pageId);
    },

    // 预设工作区
    applyPresetWorkspace(presetName) {
        const presets = {
            'study': {
                mainPage: 'notes',
                popouts: ['leetcode']
            },
            'review': {
                mainPage: 'ai-chat',
                popouts: ['growth']
            },
            'planning': {
                mainPage: 'tasks',
                popouts: ['calendar']
            }
        };

        const preset = presets[presetName];
        if (preset) {
            this.closeAllPopouts();
            showPage(preset.mainPage);
            setTimeout(() => {
                for (const page of preset.popouts) {
                    this.popoutPage(page);
                }
            }, 500);
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出
window.MultiWindowManager = MultiWindowManager;
