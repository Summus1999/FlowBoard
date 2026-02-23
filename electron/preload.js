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
    
    // 数据存储
    saveData: (filename, data) => ipcRenderer.invoke('save-data', filename, data),
    loadData: (filename) => ipcRenderer.invoke('load-data', filename),
    
    // 文件对话框
    selectFile: (options) => ipcRenderer.invoke('select-file', options),
    saveFile: (options) => ipcRenderer.invoke('save-file', options),
    
    // 事件监听
    on: (channel, callback) => {
        const validChannels = ['window-state-change'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },
    
    // 移除事件监听
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
