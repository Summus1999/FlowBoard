/**
 * FlowBoard - 插件与扩展系统 (功能13)
 * 插件管理、沙箱运行、API 暴露
 */

const PluginSystem = {
    plugins: [],
    loadedPlugins: new Map(),

    async init() {
        await this.loadPlugins();
        this.renderPluginManager();
    },

    async loadPlugins() {
        this.plugins = await flowboardDB.getAll('plugins');
    },

    renderPluginManager() {
        const container = document.getElementById('pluginManager');
        if (!container) return;

        container.innerHTML = `
            <div class="plugin-header">
                <h3>插件管理</h3>
                <button class="btn-primary" onclick="PluginSystem.showInstallModal()">
                    <i class="fas fa-plus"></i> 安装插件
                </button>
            </div>
            <div class="plugin-list">
                ${this.plugins.map(p => this.renderPluginCard(p)).join('')}
            </div>
            ${this.plugins.length === 0 ? `
                <div class="plugin-empty">
                    <i class="fas fa-puzzle-piece"></i>
                    <p>暂无已安装插件</p>
                </div>
            ` : ''}
        `;
    },

    renderPluginCard(plugin) {
        return `
            <div class="plugin-card ${plugin.enabled ? 'enabled' : ''}" data-id="${plugin.id}">
                <div class="plugin-icon">
                    <i class="fas ${plugin.icon || 'fa-puzzle-piece'}"></i>
                </div>
                <div class="plugin-info">
                    <h4>${this.escapeHtml(plugin.name)}</h4>
                    <p>${this.escapeHtml(plugin.description)}</p>
                    <span class="plugin-version">v${plugin.version}</span>
                </div>
                <div class="plugin-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${plugin.enabled ? 'checked' : ''} 
                               onchange="PluginSystem.togglePlugin('${plugin.id}')">
                        <span class="toggle-slider"></span>
                    </label>
                    <button onclick="PluginSystem.uninstallPlugin('${plugin.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    showInstallModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'installPluginModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('installPluginModal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>安装插件</h3>
                    <button class="close-btn" onclick="document.getElementById('installPluginModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="plugin-install-tabs">
                        <button class="active" onclick="PluginSystem.switchInstallTab('file')">本地文件</button>
                        <button onclick="PluginSystem.switchInstallTab('url')">URL</button>
                    </div>
                    <div class="plugin-install-content" id="pluginInstallFile">
                        <p>选择插件文件 (.zip 或 .js)</p>
                        <input type="file" id="pluginFile" accept=".js,.zip" class="form-control">
                    </div>
                    <div class="plugin-install-content hidden" id="pluginInstallUrl">
                        <p>输入插件 URL</p>
                        <input type="url" id="pluginUrl" class="form-control" placeholder="https://...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('installPluginModal').remove()">取消</button>
                    <button class="btn-primary" onclick="PluginSystem.installPlugin()">安装</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    switchInstallTab(tab) {
        document.querySelectorAll('.plugin-install-tabs button').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        
        document.getElementById('pluginInstallFile').classList.toggle('hidden', tab !== 'file');
        document.getElementById('pluginInstallUrl').classList.toggle('hidden', tab !== 'url');
    },

    async installPlugin() {
        const fileInput = document.getElementById('pluginFile');
        const urlInput = document.getElementById('pluginUrl');

        try {
            let manifest;
            let code;

            if (fileInput?.files?.[0]) {
                const file = fileInput.files[0];
                const text = await file.text();
                
                // 尝试解析 manifest
                if (file.name.endsWith('.json')) {
                    manifest = JSON.parse(text);
                } else {
                    // 假设是 JS 文件，包含 manifest 注释
                    const manifestMatch = text.match(/\/\*\s*manifest\s*([\s\S]*?)\*\//);
                    if (manifestMatch) {
                        manifest = JSON.parse(manifestMatch[1]);
                    }
                    code = text;
                }
            } else if (urlInput?.value) {
                showToast('从 URL 安装暂未实现');
                return;
            }

            if (!manifest || !manifest.name) {
                throw new Error('无效的插件文件');
            }

            const plugin = {
                id: flowboardDB.generateId('plugin_'),
                name: manifest.name,
                version: manifest.version || '1.0.0',
                description: manifest.description || '',
                icon: manifest.icon,
                author: manifest.author,
                code: code,
                enabled: false,
                installedAt: Date.now()
            };

            await flowboardDB.put('plugins', plugin);
            this.plugins.push(plugin);
            
            document.getElementById('installPluginModal').remove();
            this.renderPluginManager();
            showToast('插件安装成功');

        } catch (error) {
            showToast('安装失败: ' + error.message);
        }
    },

    async togglePlugin(pluginId) {
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (!plugin) return;

        plugin.enabled = !plugin.enabled;
        await flowboardDB.put('plugins', plugin);

        if (plugin.enabled) {
            this.loadPlugin(plugin);
        } else {
            this.unloadPlugin(plugin);
        }

        this.renderPluginManager();
    },

    loadPlugin(plugin) {
        try {
            // 创建沙箱 iframe
            const sandbox = document.createElement('iframe');
            sandbox.style.display = 'none';
            sandbox.sandbox = 'allow-scripts';
            document.body.appendChild(sandbox);

            // 准备 API
            const api = this.createPluginAPI(plugin);

            // 构建插件代码
            const pluginCode = `
                (function() {
                    const FlowBoardAPI = ${JSON.stringify(api)};
                    
                    // 插件主函数
                    ${plugin.code}
                    
                    // 如果有 init 函数，自动调用
                    if (typeof init === 'function') {
                        init(FlowBoardAPI);
                    }
                })();
            `;

            sandbox.srcdoc = `<script>${pluginCode}</script>`;
            this.loadedPlugins.set(plugin.id, sandbox);

        } catch (error) {
            console.error('[PluginSystem] 加载插件失败:', error);
            plugin.enabled = false;
        }
    },

    unloadPlugin(plugin) {
        const sandbox = this.loadedPlugins.get(plugin.id);
        if (sandbox) {
            sandbox.remove();
            this.loadedPlugins.delete(plugin.id);
        }
    },

    createPluginAPI(plugin) {
        // 暴露给插件的受限 API
        return {
            // 注册侧边栏项目
            registerSidebar: (config) => {
                if (window.FlowBoardSidebar) {
                    FlowBoardSidebar.registerItem({
                        ...config,
                        source: 'plugin',
                        pluginId: plugin.id
                    });
                }
            },

            // 显示通知
            showNotification: (title, body) => {
                NotificationManager.show({
                    title,
                    body,
                    source: plugin.name
                });
            },

            // 存储数据
            setStorage: async (key, value) => {
                await flowboardDB.setKV(`plugin_${plugin.id}_${key}`, value);
            },

            // 获取数据
            getStorage: async (key) => {
                return await flowboardDB.getKV(`plugin_${plugin.id}_${key}`);
            },

            // 打开页面
            openPage: (page) => {
                showPage(page);
            },

            // 插件信息
            plugin: {
                id: plugin.id,
                name: plugin.name,
                version: plugin.version
            }
        };
    },

    async uninstallPlugin(pluginId) {
        if (!confirm('确定卸载这个插件吗？')) return;

        const plugin = this.plugins.find(p => p.id === pluginId);
        if (plugin?.enabled) {
            this.unloadPlugin(plugin);
        }

        await flowboardDB.delete('plugins', pluginId);
        this.plugins = this.plugins.filter(p => p.id !== pluginId);
        
        this.renderPluginManager();
        showToast('插件已卸载');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出
window.PluginSystem = PluginSystem;
