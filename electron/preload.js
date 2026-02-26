/**
 * FlowBoard Electron 预加载脚本
 * 用于安全地在渲染进程中暴露主进程 API
 */

const { contextBridge, ipcRenderer } = require('electron');

// 使用 contextBridge 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 应用信息
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    
    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    
    // 外部链接
    openExternal: (url) => ipcRenderer.send('open-external', url),
    writeClipboardText: (text) => ipcRenderer.invoke('write-clipboard-text', text),
    
    // 数据存储
    saveData: (filename, data) => ipcRenderer.invoke('save-data', filename, data),
    loadData: (filename) => ipcRenderer.invoke('load-data', filename),

    // 资讯更新
    getNewsSnapshot: () => ipcRenderer.invoke('news-get-snapshot'),
    refreshNewsNow: () => ipcRenderer.invoke('news-refresh-now'),
    onNewsUpdated: (callback) => {
        const channel = 'news-updated';
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
    
    // 文件对话框
    selectFile: (options) => ipcRenderer.invoke('select-file', options),
    saveFile: (options) => ipcRenderer.invoke('save-file', options),
    
    // 事件监听
    on: (channel, callback) => {
        const validChannels = ['window-state-change', 'news-updated'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },
    
    // 移除事件监听
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
    
    // 开机启动设置
    setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),
    getAutoLaunchStatus: () => ipcRenderer.invoke('get-auto-launch-status'),
    
    // 应用中心
    launchApp: (appId, appConfig) => ipcRenderer.invoke('launch-app', appId, appConfig),
    checkAppsAvailability: (appConfigs) => ipcRenderer.invoke('check-apps-availability', appConfigs)
});
