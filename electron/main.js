/**
 * FlowBoard Electron 主进程
 * 支持 macOS 和 Windows 双平台
 */

const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { XMLParser } = require('fast-xml-parser');

// 保持对窗口对象的全局引用，防止被垃圾回收
let mainWindow = null;
let tray = null;
let newsUpdateTimer = null;

// 判断是否为开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const NEWS_CACHE_VERSION = 1;
const NEWS_CACHE_FILE = 'news-cache-v1.json';
const NEWS_UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;
const NEWS_FETCH_TIMEOUT_MS = 12000;
const NEWS_MAX_ITEMS = 120;
const NEWS_SOURCE_LIMIT = 40;
const NEWS_FEED_SOURCES = [
    {
        id: 'ithome',
        name: 'IT之家',
        category: 'tech',
        url: 'https://www.ithome.com/rss/'
    },
    {
        id: 'cnbeta',
        name: 'cnBeta',
        category: 'tech',
        url: 'https://rss.cnbeta.com/'
    },
    {
        id: 'hackernews',
        name: 'Hacker News',
        category: 'ai',
        url: 'https://hnrss.org/frontpage'
    },
    {
        id: 'theverge',
        name: 'The Verge',
        category: 'tech',
        url: 'https://www.theverge.com/rss/index.xml'
    },
    {
        id: 'coindesk',
        name: 'CoinDesk',
        category: 'finance',
        url: 'https://www.coindesk.com/arc/outboundfeeds/rss/'
    }
];
const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    trimValues: true
});

let isNewsUpdating = false;
let newsSnapshot = createEmptyNewsSnapshot();

// 配置文件路径
const getConfigPath = () => {
    return path.join(app.getPath('userData'), 'config.json');
};

// 读取配置
const readConfig = () => {
    const configPath = getConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取配置失败:', error);
    }
    return {};
};

// 保存配置
const saveConfig = (config) => {
    const configPath = getConfigPath();
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('保存配置失败:', error);
    }
};

function createEmptyNewsSnapshot() {
    return {
        version: NEWS_CACHE_VERSION,
        status: 'idle',
        lastReason: 'startup',
        lastAttemptAt: null,
        lastSuccessAt: null,
        items: [],
        sourceStatus: []
    };
}

function getNewsCachePath() {
    return path.join(app.getPath('userData'), NEWS_CACHE_FILE);
}

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function toText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (!value || typeof value !== 'object') return '';
    if (typeof value['#text'] === 'string') return value['#text'].trim();
    if (typeof value._cdata === 'string') return value._cdata.trim();
    return '';
}

function stripHtmlTags(text) {
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeDateToIso(dateLike) {
    if (!dateLike) return null;
    const timestamp = Date.parse(dateLike);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp).toISOString();
}

function normalizeUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return '';
    return rawUrl.trim().replace(/\/+$/, '');
}

function computeHotScore(publishedAt) {
    const timestamp = Date.parse(publishedAt);
    if (!Number.isFinite(timestamp)) return 10000;
    const ageHours = Math.max(0, (Date.now() - timestamp) / (60 * 60 * 1000));
    const rawScore = Math.round(1200000 / (1 + ageHours * 0.8));
    return Math.max(5000, rawScore);
}

function createNewsId(sourceId, url, title) {
    return crypto
        .createHash('sha1')
        .update(`${sourceId}|${url}|${title}`)
        .digest('hex')
        .slice(0, 16);
}

function normalizeNewsItem(item) {
    if (!item || typeof item !== 'object') return null;
    const title = stripHtmlTags(toText(item.title));
    const url = normalizeUrl(toText(item.url));
    if (!title || !url) return null;

    const source = toText(item.source) || '未知来源';
    const category = toText(item.category) || 'tech';
    const publishedAt = safeDateToIso(item.publishedAt) || new Date().toISOString();
    const hot = Number.isFinite(Number(item.hot)) ? Number(item.hot) : computeHotScore(publishedAt);
    const id = toText(item.id) || createNewsId(source, url, title);

    return {
        id,
        title,
        source,
        time: toText(item.time),
        category,
        hot,
        url,
        publishedAt
    };
}

function normalizeSourceStatus(status) {
    if (!status || typeof status !== 'object') return null;
    return {
        id: toText(status.id) || 'unknown',
        name: toText(status.name) || 'unknown',
        success: Boolean(status.success),
        itemCount: Number.isFinite(Number(status.itemCount)) ? Number(status.itemCount) : 0,
        durationMs: Number.isFinite(Number(status.durationMs)) ? Number(status.durationMs) : 0,
        error: toText(status.error)
    };
}

function normalizeNewsCollection(items) {
    const dedupMap = new Map();
    for (const item of items) {
        const normalized = normalizeNewsItem(item);
        if (!normalized) continue;
        const dedupKey = normalized.url || `${normalized.source}:${normalized.title.toLowerCase()}`;
        if (!dedupMap.has(dedupKey)) {
            dedupMap.set(dedupKey, normalized);
        }
    }

    return Array.from(dedupMap.values()).sort((a, b) => {
        const aTime = Date.parse(a.publishedAt);
        const bTime = Date.parse(b.publishedAt);
        if (aTime !== bTime) {
            return bTime - aTime;
        }
        return b.hot - a.hot;
    });
}

function sanitizeNewsSnapshot(snapshot) {
    const base = createEmptyNewsSnapshot();
    if (!snapshot || typeof snapshot !== 'object') return base;
    const normalizedStatus = ['idle', 'updating', 'success', 'error'].includes(snapshot.status)
        ? snapshot.status
        : 'idle';
    const normalizedItems = normalizeNewsCollection(Array.isArray(snapshot.items) ? snapshot.items : [])
        .slice(0, NEWS_MAX_ITEMS);
    const normalizedSourceStatus = toArray(snapshot.sourceStatus)
        .map(normalizeSourceStatus)
        .filter(Boolean)
        .slice(0, NEWS_FEED_SOURCES.length);

    return {
        ...base,
        version: NEWS_CACHE_VERSION,
        status: normalizedStatus,
        lastReason: toText(snapshot.lastReason) || base.lastReason,
        lastAttemptAt: safeDateToIso(snapshot.lastAttemptAt),
        lastSuccessAt: safeDateToIso(snapshot.lastSuccessAt),
        items: normalizedItems,
        sourceStatus: normalizedSourceStatus
    };
}

function loadNewsSnapshot() {
    try {
        const cachePath = getNewsCachePath();
        if (!fs.existsSync(cachePath)) {
            return createEmptyNewsSnapshot();
        }
        const rawText = fs.readFileSync(cachePath, 'utf8');
        return sanitizeNewsSnapshot(JSON.parse(rawText));
    } catch (error) {
        console.warn('加载资讯缓存失败:', error.message || error);
        return createEmptyNewsSnapshot();
    }
}

function persistNewsSnapshot() {
    try {
        const cachePath = getNewsCachePath();
        fs.writeFileSync(cachePath, JSON.stringify(newsSnapshot, null, 2), 'utf8');
    } catch (error) {
        console.warn('保存资讯缓存失败:', error.message || error);
    }
}

function getNewsSnapshot() {
    return JSON.parse(JSON.stringify(newsSnapshot));
}

function broadcastNewsSnapshot() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('news-updated', getNewsSnapshot());
}

async function fetchTextWithTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*',
                'User-Agent': 'FlowBoard-NewsFetcher/1.0'
            },
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
    } finally {
        clearTimeout(timeoutId);
    }
}

function resolveRssLink(linkNode) {
    if (typeof linkNode === 'string') {
        return linkNode;
    }
    if (!linkNode || typeof linkNode !== 'object') {
        return '';
    }
    if (typeof linkNode.href === 'string') {
        return linkNode.href;
    }
    return toText(linkNode);
}

function resolveAtomLink(linkNode) {
    const links = toArray(linkNode);
    for (const link of links) {
        if (typeof link === 'string' && link.trim()) {
            return link.trim();
        }
        if (!link || typeof link !== 'object') continue;
        const href = toText(link.href);
        const rel = toText(link.rel);
        if (href && (!rel || rel === 'alternate')) {
            return href;
        }
    }

    for (const link of links) {
        if (!link || typeof link !== 'object') continue;
        const href = toText(link.href);
        if (href) return href;
    }

    return '';
}

function extractRssItems(parsedFeed) {
    const channel = parsedFeed?.rss?.channel;
    if (!channel) return [];
    const items = toArray(channel.item);
    return items.map((item) => ({
        title: toText(item.title),
        link: resolveRssLink(item.link),
        publishedAt: toText(item.pubDate) || toText(item.published) || toText(item.updated) || toText(item['dc:date'])
    }));
}

function extractAtomItems(parsedFeed) {
    const feed = parsedFeed?.feed;
    if (!feed) return [];
    const entries = toArray(feed.entry);
    return entries.map((entry) => ({
        title: toText(entry.title),
        link: resolveAtomLink(entry.link),
        publishedAt: toText(entry.published) || toText(entry.updated)
    }));
}

function buildNewsItem(source, feedItem) {
    const title = stripHtmlTags(toText(feedItem.title));
    const url = normalizeUrl(toText(feedItem.link));
    if (!title || !url) return null;
    const publishedAt = safeDateToIso(feedItem.publishedAt) || new Date().toISOString();

    return {
        id: createNewsId(source.id, url, title),
        title,
        source: source.name,
        time: '',
        category: source.category,
        hot: computeHotScore(publishedAt),
        url,
        publishedAt
    };
}

async function fetchNewsSource(source) {
    const startTime = Date.now();
    try {
        const feedText = await fetchTextWithTimeout(source.url);
        const parsedFeed = xmlParser.parse(feedText);
        const rawItems = extractRssItems(parsedFeed);
        const feedItems = rawItems.length > 0 ? rawItems : extractAtomItems(parsedFeed);
        const items = feedItems
            .map((item) => buildNewsItem(source, item))
            .filter(Boolean)
            .slice(0, NEWS_SOURCE_LIMIT);

        return {
            id: source.id,
            name: source.name,
            success: true,
            itemCount: items.length,
            durationMs: Date.now() - startTime,
            error: '',
            items
        };
    } catch (error) {
        return {
            id: source.id,
            name: source.name,
            success: false,
            itemCount: 0,
            durationMs: Date.now() - startTime,
            error: error.message || String(error),
            items: []
        };
    }
}

async function updateNewsSnapshot(reason = 'interval') {
    if (isNewsUpdating) {
        return getNewsSnapshot();
    }
    isNewsUpdating = true;

    const attemptAt = new Date().toISOString();
    newsSnapshot = {
        ...newsSnapshot,
        status: 'updating',
        lastReason: reason,
        lastAttemptAt: attemptAt
    };
    persistNewsSnapshot();
    broadcastNewsSnapshot();

    try {
        const settled = await Promise.allSettled(NEWS_FEED_SOURCES.map((source) => fetchNewsSource(source)));
        const sourceStatus = [];
        const fetchedItems = [];

        settled.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const sourceResult = result.value;
                sourceStatus.push({
                    id: sourceResult.id,
                    name: sourceResult.name,
                    success: sourceResult.success,
                    itemCount: sourceResult.itemCount,
                    durationMs: sourceResult.durationMs,
                    error: sourceResult.error
                });
                if (sourceResult.success && sourceResult.items.length > 0) {
                    fetchedItems.push(...sourceResult.items);
                }
                return;
            }

            const source = NEWS_FEED_SOURCES[index];
            sourceStatus.push({
                id: source.id,
                name: source.name,
                success: false,
                itemCount: 0,
                durationMs: 0,
                error: result.reason?.message || String(result.reason)
            });
        });

        const normalizedFetchedItems = normalizeNewsCollection(fetchedItems).slice(0, NEWS_MAX_ITEMS);
        const hasSuccessfulSource = sourceStatus.some((item) => item.success);

        if (normalizedFetchedItems.length > 0) {
            newsSnapshot = {
                ...newsSnapshot,
                status: 'success',
                lastReason: reason,
                lastAttemptAt: attemptAt,
                lastSuccessAt: attemptAt,
                items: normalizedFetchedItems,
                sourceStatus
            };
        } else if (newsSnapshot.items.length > 0) {
            newsSnapshot = {
                ...newsSnapshot,
                status: hasSuccessfulSource ? 'success' : 'error',
                lastReason: reason,
                lastAttemptAt: attemptAt,
                sourceStatus
            };
            if (hasSuccessfulSource && !newsSnapshot.lastSuccessAt) {
                newsSnapshot.lastSuccessAt = attemptAt;
            }
        } else {
            newsSnapshot = {
                ...newsSnapshot,
                status: 'error',
                lastReason: reason,
                lastAttemptAt: attemptAt,
                sourceStatus
            };
        }
    } catch (error) {
        newsSnapshot = {
            ...newsSnapshot,
            status: 'error',
            lastReason: reason,
            lastAttemptAt: attemptAt
        };
        console.warn('资讯更新失败:', error.message || error);
    } finally {
        persistNewsSnapshot();
        broadcastNewsSnapshot();
        isNewsUpdating = false;
    }

    return getNewsSnapshot();
}

function initNewsUpdater() {
    newsSnapshot = loadNewsSnapshot();

    if (newsUpdateTimer) {
        clearInterval(newsUpdateTimer);
    }

    newsUpdateTimer = setInterval(() => {
        void updateNewsSnapshot('interval');
    }, NEWS_UPDATE_INTERVAL_MS);

    void updateNewsSnapshot('startup');
}

function stopNewsUpdater() {
    if (newsUpdateTimer) {
        clearInterval(newsUpdateTimer);
        newsUpdateTimer = null;
    }
}

// 创建主窗口
function createMainWindow() {
    const config = readConfig();
    
    mainWindow = new BrowserWindow({
        width: config.windowWidth || 1400,
        height: config.windowHeight || 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'FlowBoard - 个人工作台',
        icon: getIconPath(),
        show: false, // 先不显示，等加载完成再显示
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // 开发环境禁用，生产环境视情况而定
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        // macOS 隐藏标题栏
        frame: process.platform !== 'darwin',
        // 透明背景（可选）
        transparent: false,
        backgroundColor: '#0a1628'
    });

    // 加载页面
    const indexPath = isDev 
        ? 'http://localhost:3000'  // 开发环境使用本地服务器
        : `file://${path.join(__dirname, '../index.html')}`;
    
    if (isDev) {
        mainWindow.loadURL(indexPath);
        // 打开开发者工具
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../index.html'));
    }

    // 窗口加载完成后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // 恢复窗口最大化状态
        if (config.isMaximized) {
            mainWindow.maximize();
        }

        broadcastNewsSnapshot();
    });

    // 窗口关闭前保存尺寸和状态
    mainWindow.on('close', (event) => {
        if (process.platform === 'darwin') {
            // macOS: 点击关闭按钮时隐藏而不是退出
            event.preventDefault();
            mainWindow.hide();
        } else {
            // Windows/Linux: 保存配置
            const bounds = mainWindow.getBounds();
            saveConfig({
                windowWidth: bounds.width,
                windowHeight: bounds.height,
                isMaximized: mainWindow.isMaximized()
            });
        }
    });

    // 窗口关闭时清理引用
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

// 获取图标路径
function getIconPath() {
    const iconName = process.platform === 'darwin' ? 'icon.icns' : 'icon.png';
    const iconPath = path.join(__dirname, '../assets', iconName);
    
    // 如果图标不存在，返回 null 使用默认图标
    if (fs.existsSync(iconPath)) {
        return iconPath;
    }
    return null;
}

// 创建系统托盘
function createTray() {
    // 使用应用主图标作为托盘图标
    const iconPath = path.join(__dirname, '../assets/icon.png');
    
    let trayIcon;
    if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
        // Windows 和 macOS 都需要调整为适合托盘的尺寸
        if (process.platform === 'darwin') {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
        } else {
            // Windows/Linux 使用 16x16 或 32x32
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
        }
    } else {
        // 如果图标不存在，创建一个简单的颜色块作为占位
        trayIcon = nativeImage.createFromNamedImage('application', [16, 16]);
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('FlowBoard - 个人工作台');
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '打开 FlowBoard',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createMainWindow();
                }
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    // 点击托盘图标显示/隐藏窗口
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        } else {
            createMainWindow();
        }
    });
}

// 设置应用菜单（macOS）
function setApplicationMenu() {
    if (process.platform === 'darwin') {
        const template = [
            {
                label: app.getName(),
                submenu: [
                    { role: 'about', label: '关于 FlowBoard' },
                    { type: 'separator' },
                    { role: 'hide', label: '隐藏' },
                    { role: 'hideothers', label: '隐藏其他' },
                    { role: 'unhide', label: '显示全部' },
                    { type: 'separator' },
                    { role: 'quit', label: '退出 FlowBoard' }
                ]
            },
            {
                label: '编辑',
                submenu: [
                    { role: 'undo', label: '撤销' },
                    { role: 'redo', label: '重做' },
                    { type: 'separator' },
                    { role: 'cut', label: '剪切' },
                    { role: 'copy', label: '复制' },
                    { role: 'paste', label: '粘贴' },
                    { role: 'selectall', label: '全选' }
                ]
            },
            {
                label: '视图',
                submenu: [
                    { role: 'reload', label: '刷新' },
                    { role: 'forcereload', label: '强制刷新' },
                    { role: 'toggledevtools', label: '开发者工具' },
                    { type: 'separator' },
                    { role: 'resetzoom', label: '重置缩放' },
                    { role: 'zoomin', label: '放大' },
                    { role: 'zoomout', label: '缩小' },
                    { type: 'separator' },
                    { role: 'togglefullscreen', label: '全屏' }
                ]
            },
            {
                label: '窗口',
                submenu: [
                    { role: 'minimize', label: '最小化' },
                    { role: 'close', label: '关闭' }
                ]
            }
        ];
        
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    } else {
        // Windows/Linux 使用默认菜单或隐藏
        Menu.setApplicationMenu(null);
    }
}

// ====================
// IPC 通信处理
// ====================

// 获取应用版本
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// 获取平台信息
ipcMain.handle('get-platform', () => {
    return process.platform;
});

// 最小化窗口
ipcMain.on('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

// 最大化/还原窗口
ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

// 关闭窗口
ipcMain.on('window-close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

// 打开外部链接
ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

// 保存数据到本地文件
ipcMain.handle('save-data', async (event, filename, data) => {
    try {
        const dataPath = path.join(app.getPath('userData'), filename);
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 从本地文件读取数据
ipcMain.handle('load-data', async (event, filename) => {
    try {
        const dataPath = path.join(app.getPath('userData'), filename);
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf8');
            return { success: true, data: JSON.parse(data) };
        }
        return { success: true, data: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('news-get-snapshot', async () => {
    return getNewsSnapshot();
});

ipcMain.handle('news-refresh-now', async () => {
    return updateNewsSnapshot('manual');
});

// 选择文件对话框
ipcMain.handle('select-file', async (event, options) => {
    if (mainWindow) {
        const result = await dialog.showOpenDialog(mainWindow, options);
        return result;
    }
    return { canceled: true };
});

// 保存文件对话框
ipcMain.handle('save-file', async (event, options) => {
    if (mainWindow) {
        const result = await dialog.showSaveDialog(mainWindow, options);
        return result;
    }
    return { canceled: true };
});

// ====================
// 开机启动设置
// ====================

// 设置开机启动
ipcMain.handle('set-auto-launch', async (event, enable) => {
    try {
        // Windows 和 macOS 支持开机启动
        if (process.platform === 'linux') {
            return { success: false, error: 'Linux 平台暂不支持开机启动设置' };
        }
        
        app.setLoginItemSettings({
            openAtLogin: enable,
            openAsHidden: false,
            path: app.getPath('exe')
        });
        
        // 验证设置
        const settings = app.getLoginItemSettings();
        console.log(`开机启动设置已${enable ? '启用' : '禁用'}:`, settings);
        
        return { 
            success: true, 
            enabled: settings.openAtLogin,
            platform: process.platform
        };
    } catch (error) {
        console.error('设置开机启动失败:', error);
        return { success: false, error: error.message };
    }
});

// 获取开机启动状态
ipcMain.handle('get-auto-launch-status', async () => {
    try {
        if (process.platform === 'linux') {
            return { 
                success: true, 
                enabled: false, 
                platform: process.platform,
                notSupported: true 
            };
        }
        
        const settings = app.getLoginItemSettings();
        return { 
            success: true, 
            enabled: settings.openAtLogin,
            platform: process.platform
        };
    } catch (error) {
        console.error('获取开机启动状态失败:', error);
        return { success: false, error: error.message };
    }
});

// ====================
// 应用中心 - 启动本地应用
// ====================

const { exec, spawn } = require('child_process');

// 检查文件是否存在
function fileExists(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

// 查找可执行文件
function findExecutable(paths) {
    for (const path of paths) {
        if (path && fileExists(path)) {
            return path;
        }
    }
    return null;
}

// 启动应用
ipcMain.handle('launch-app', async (event, appId, appConfig) => {
    try {
        // 首先尝试直接路径
        const exePath = findExecutable(appConfig.paths);
        
        if (exePath) {
            // 使用 spawn 启动应用
            const child = spawn('"' + exePath + '"', [], {
                detached: true,
                shell: true,
                windowsHide: false
            });
            
            child.unref();
            
            return { 
                success: true, 
                method: 'direct',
                path: exePath 
            };
        }
        
        // 如果直接路径失败，尝试使用命令
        if (appConfig.command) {
            return new Promise((resolve) => {
                exec(appConfig.command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`启动应用失败: ${error}`);
                        resolve({ 
                            success: false, 
                            error: '应用未安装或路径不正确' 
                        });
                    } else {
                        resolve({ 
                            success: true, 
                            method: 'command',
                            command: appConfig.command 
                        });
                    }
                });
            });
        }
        
        return { 
            success: false, 
            error: '未找到应用程序' 
        };
        
    } catch (error) {
        console.error('启动应用失败:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
});

// 检查应用可用性
ipcMain.handle('check-apps-availability', async (event, appConfigs) => {
    const available = [];
    const unavailable = [];
    
    for (const [appId, config] of Object.entries(appConfigs)) {
        const exePath = findExecutable(config.paths);
        if (exePath) {
            available.push(appId);
        } else {
            unavailable.push(appId);
        }
    }
    
    return { available, unavailable };
});

// ====================
// 应用生命周期
// ====================

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
    createMainWindow();
    createTray();
    setApplicationMenu();
    initNewsUpdater();

    app.on('activate', () => {
        // macOS: 点击 dock 图标时重新创建窗口
        if (mainWindow === null) {
            createMainWindow();
        } else {
            mainWindow.show();
        }
    });
});

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopNewsUpdater();
});

// 在 macOS 上，当用户点击 dock 图标且没有其他窗口打开时，通常会重新创建一个窗口
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// 防止多个应用实例（可选）
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 当尝试运行第二个实例时，聚焦到第一个实例的窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

console.log('FlowBoard Electron 主进程已启动');
