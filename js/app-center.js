/**
 * FlowBoard - 应用中心
 * 用户自定义添加和管理本地应用程序
 */

// ========================================
// 数据存储
// ========================================

const APP_CENTER_STORAGE_KEY = 'flowboard_apps';

// 默认图标选项
const iconOptions = [
    { icon: 'fas fa-desktop', name: '桌面', color: '#3b82f6' },
    { icon: 'fas fa-code', name: '代码', color: '#22c55e' },
    { icon: 'fas fa-folder', name: '文件夹', color: '#f59e0b' },
    { icon: 'fas fa-globe', name: '浏览器', color: '#06b6d4' },
    { icon: 'fas fa-music', name: '音乐', color: '#ec4899' },
    { icon: 'fas fa-video', name: '视频', color: '#ef4444' },
    { icon: 'fas fa-gamepad', name: '游戏', color: '#8b5cf6' },
    { icon: 'fas fa-comments', name: '聊天', color: '#10b981' },
    { icon: 'fas fa-envelope', name: '邮件', color: '#6366f1' },
    { icon: 'fas fa-camera', name: '图像', color: '#f97316' },
    { icon: 'fas fa-terminal', name: '终端', color: '#64748b' },
    { icon: 'fas fa-database', name: '数据库', color: '#0ea5e9' },
    { icon: 'fas fa-paint-brush', name: '设计', color: '#d946ef' },
    { icon: 'fas fa-file-alt', name: '文档', color: '#14b8a6' },
    { icon: 'fas fa-cog', name: '工具', color: '#78716c' },
    { icon: 'fab fa-chrome', name: 'Chrome', color: '#4285f4' },
    { icon: 'fab fa-firefox', name: 'Firefox', color: '#ff7139' },
    { icon: 'fab fa-edge', name: 'Edge', color: '#0078d7' },
    { icon: 'fab fa-weixin', name: '微信', color: '#07c160' },
    { icon: 'fab fa-qq', name: 'QQ', color: '#12b7f5' },
    { icon: 'fab fa-github', name: 'GitHub', color: '#333' },
    { icon: 'fab fa-steam', name: 'Steam', color: '#1b2838' },
    { icon: 'fab fa-spotify', name: 'Spotify', color: '#1db954' },
    { icon: 'fab fa-discord', name: 'Discord', color: '#5865f2' }
];

// 当前编辑的应用ID
let editingAppId = null;

// ========================================
// 加载和保存数据
// ========================================

function loadApps() {
    try {
        const data = localStorage.getItem(APP_CENTER_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('加载应用数据失败:', e);
        return [];
    }
}

function saveApps(apps) {
    try {
        localStorage.setItem(APP_CENTER_STORAGE_KEY, JSON.stringify(apps));
    } catch (e) {
        console.error('保存应用数据失败:', e);
    }
}

// ========================================
// 渲染应用列表
// ========================================

function renderApps() {
    const container = document.getElementById('appsGrid');
    if (!container) return;

    const apps = loadApps();

    if (apps.length === 0) {
        container.innerHTML = `
            <div class="apps-empty">
                <i class="fas fa-cube"></i>
                <h3>还没有添加应用</h3>
                <p>点击右上角的"添加应用"按钮来添加你常用的本地软件</p>
            </div>
        `;
        return;
    }

    container.innerHTML = apps.map(app => `
        <div class="app-card" data-id="${app.id}" ondblclick="launchApp('${app.id}')">
            <div class="app-icon" style="background: ${app.color || '#3b82f6'};">
                <i class="${app.icon || 'fas fa-desktop'}"></i>
            </div>
            <span class="app-name">${escapeHtml(app.name)}</span>
            <span class="app-desc" title="${escapeHtml(app.path)}">${getFileName(app.path)}</span>
            <div class="app-actions">
                <button class="app-action-btn" onclick="event.stopPropagation(); launchApp('${app.id}')" title="启动">
                    <i class="fas fa-play"></i>
                </button>
                <button class="app-action-btn" onclick="event.stopPropagation(); editApp('${app.id}')" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="app-action-btn delete" onclick="event.stopPropagation(); deleteApp('${app.id}')" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// 获取文件名
function getFileName(path) {
    if (!path) return '';
    return path.split(/[\\\/]/).pop() || path;
}

// HTML转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// 添加/编辑应用
// ========================================

function openAddAppModal() {
    editingAppId = null;
    document.getElementById('addAppModalTitle').textContent = '添加应用';
    document.getElementById('appName').value = '';
    document.getElementById('appPath').value = '';
    
    // 重置图标选择
    renderIconSelector();
    selectIcon(iconOptions[0].icon, iconOptions[0].color);
    
    document.getElementById('addAppModal').classList.add('active');
}

function editApp(appId) {
    const apps = loadApps();
    const app = apps.find(a => a.id === appId);
    if (!app) return;

    editingAppId = appId;
    document.getElementById('addAppModalTitle').textContent = '编辑应用';
    document.getElementById('appName').value = app.name;
    document.getElementById('appPath').value = app.path;
    
    renderIconSelector();
    selectIcon(app.icon || iconOptions[0].icon, app.color || iconOptions[0].color);
    
    document.getElementById('addAppModal').classList.add('active');
}

function closeAddAppModal() {
    document.getElementById('addAppModal').classList.remove('active');
    editingAppId = null;
}

// 渲染图标选择器
function renderIconSelector() {
    const container = document.getElementById('iconSelector');
    if (!container) return;

    container.innerHTML = iconOptions.map(opt => `
        <div class="icon-option" data-icon="${opt.icon}" data-color="${opt.color}" onclick="selectIcon('${opt.icon}', '${opt.color}')" title="${opt.name}">
            <i class="${opt.icon}" style="color: ${opt.color};"></i>
        </div>
    `).join('');
}

// 选择图标
function selectIcon(icon, color) {
    // 更新选中状态
    document.querySelectorAll('.icon-option').forEach(el => {
        el.classList.remove('selected');
        if (el.dataset.icon === icon) {
            el.classList.add('selected');
        }
    });
    
    // 更新预览
    const preview = document.getElementById('selectedIconPreview');
    if (preview) {
        preview.innerHTML = `<i class="${icon}" style="color: ${color};"></i>`;
        preview.dataset.icon = icon;
        preview.dataset.color = color;
    }
}

// 选择文件
async function selectAppFile() {
    if (window.electronAPI && window.electronAPI.selectFile) {
        try {
            const result = await window.electronAPI.selectFile({
                title: '选择应用程序',
                filters: [
                    { name: '可执行文件', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
                    { name: '所有文件', extensions: ['*'] }
                ],
                properties: ['openFile']
            });
            
            if (!result.canceled && result.filePaths && result.filePaths[0]) {
                document.getElementById('appPath').value = result.filePaths[0];
                
                // 自动填充名称（如果为空）
                const nameInput = document.getElementById('appName');
                if (!nameInput.value) {
                    const fileName = getFileName(result.filePaths[0]);
                    nameInput.value = fileName.replace(/\.[^.]+$/, ''); // 去掉扩展名
                }
            }
        } catch (e) {
            console.error('选择文件失败:', e);
            showToast('选择文件失败');
        }
    } else {
        showToast('请在桌面应用中使用此功能');
    }
}

// 保存应用
function saveApp() {
    const name = document.getElementById('appName').value.trim();
    const path = document.getElementById('appPath').value.trim();
    const preview = document.getElementById('selectedIconPreview');
    const icon = preview?.dataset.icon || iconOptions[0].icon;
    const color = preview?.dataset.color || iconOptions[0].color;

    if (!name) {
        showToast('请输入应用名称');
        return;
    }
    if (!path) {
        showToast('请选择应用程序路径');
        return;
    }

    const apps = loadApps();

    if (editingAppId) {
        // 编辑模式
        const index = apps.findIndex(a => a.id === editingAppId);
        if (index !== -1) {
            apps[index] = { ...apps[index], name, path, icon, color };
        }
    } else {
        // 添加模式
        const newApp = {
            id: 'app_' + Date.now(),
            name,
            path,
            icon,
            color,
            createdAt: new Date().toISOString()
        };
        apps.push(newApp);
    }

    saveApps(apps);
    renderApps();
    closeAddAppModal();
    showToast(editingAppId ? '应用已更新' : '应用已添加');
}

// ========================================
// 删除应用
// ========================================

function deleteApp(appId) {
    if (!confirm('确定要删除这个应用吗？')) return;

    const apps = loadApps();
    const newApps = apps.filter(a => a.id !== appId);
    saveApps(newApps);
    renderApps();
    showToast('应用已删除');
}

// ========================================
// 启动应用
// ========================================

async function launchApp(appId) {
    const apps = loadApps();
    const app = apps.find(a => a.id === appId);
    
    if (!app) {
        showToast('应用不存在');
        return;
    }

    if (window.electronAPI && window.electronAPI.launchApp) {
        try {
            const result = await window.electronAPI.launchApp(appId, {
                name: app.name,
                paths: [app.path],
                command: null
            });
            
            if (result.success) {
                showToast(`正在启动 ${app.name}...`);
            } else {
                showToast(`启动失败: ${result.error || '未知错误'}`);
            }
        } catch (e) {
            console.error('启动应用失败:', e);
            showToast(`启动失败: ${e.message}`);
        }
    } else {
        showToast('请在桌面应用中使用此功能');
    }
}

// ========================================
// 初始化
// ========================================

function initAppCenter() {
    console.log('应用中心已初始化');
    renderApps();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保DOM完全加载
    setTimeout(initAppCenter, 100);
});

console.log('应用中心模块已加载 📱');
