/**
 * FlowBoard - 应用中心
 * 快速启动本地应用程序
 */

// ========================================
// 获取用户目录路径（兼容浏览器和 Electron）
// ========================================

function getUserPath(type) {
    // 在 Electron 环境中通过 API 获取
    if (window.electronAPI && window.electronAPI.getUserPath) {
        return window.electronAPI.getUserPath(type) || '';
    }
    // 浏览器环境返回空字符串
    return '';
}

// ========================================
// 应用配置 - 可执行文件路径
// ========================================

const AppConfigs = {
    // 社交应用
    wechat: {
        name: '微信',
        paths: [
            'C:\\Program Files (x86)\\Tencent\\WeChat\\WeChat.exe',
            'C:\\Program Files\\Tencent\\WeChat\\WeChat.exe'
        ],
        dynamicPaths: ['USERPROFILE\\AppData\\Roaming\\Tencent\\WeChat\\WeChat.exe'],
        command: 'start wechat',
        icon: 'fab fa-weixin'
    },
    qq: {
        name: 'QQ',
        paths: [
            'C:\\Program Files (x86)\\Tencent\\QQ\\Bin\\QQ.exe',
            'C:\\Program Files\\Tencent\\QQ\\Bin\\QQ.exe'
        ],
        command: 'start qq',
        icon: 'fab fa-qq'
    },
    tim: {
        name: 'TIM',
        paths: [
            'C:\\Program Files (x86)\\Tencent\\TIM\\Bin\\TIM.exe',
            'C:\\Program Files\\Tencent\\TIM\\Bin\\TIM.exe'
        ],
        command: 'start tim',
        icon: 'fas fa-briefcase'
    },
    dingtalk: {
        name: '钉钉',
        paths: [
            'C:\\Program Files (x86)\\DingDing\\DingtalkLauncher.exe',
            'C:\\Program Files\\DingDing\\DingtalkLauncher.exe'
        ],
        dynamicPaths: ['LOCALAPPDATA\\DingTalk\\DingtalkLauncher.exe'],
        command: 'start dingtalk',
        icon: 'fas fa-dingding'
    },
    feishu: {
        name: '飞书',
        paths: [
            'C:\\Program Files\\Feishu\\Feishu.exe'
        ],
        dynamicPaths: ['LOCALAPPDATA\\Feishu\\Feishu.exe'],
        command: 'start feishu',
        icon: 'fas fa-paper-plane'
    },
    
    // 开发工具
    vscode: {
        name: 'VS Code',
        paths: [
            'C:\\Program Files\\Microsoft VS Code\\Code.exe',
            'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe'
        ],
        dynamicPaths: ['LOCALAPPDATA\\Programs\\Microsoft VS Code\\Code.exe'],
        command: 'code',
        icon: 'fas fa-code'
    },
    idea: {
        name: 'IntelliJ IDEA',
        paths: [
            'C:\\Program Files\\JetBrains\\IntelliJ IDEA Community Edition\\bin\\idea64.exe',
            'C:\\Program Files\\JetBrains\\IntelliJ IDEA Ultimate\\bin\\idea64.exe'
        ],
        dynamicPaths: ['PROGRAMFILES\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe'],
        command: 'idea',
        icon: 'fas fa-coffee'
    },
    webstorm: {
        name: 'WebStorm',
        paths: [
            'C:\\Program Files\\JetBrains\\WebStorm\\bin\\webstorm64.exe'
        ],
        dynamicPaths: ['PROGRAMFILES\\JetBrains\\WebStorm\\bin\\webstorm64.exe'],
        command: 'webstorm',
        icon: 'fab fa-js'
    },
    datagrip: {
        name: 'DataGrip',
        paths: [
            'C:\\Program Files\\JetBrains\\DataGrip\\bin\\datagrip64.exe'
        ],
        dynamicPaths: ['PROGRAMFILES\\JetBrains\\DataGrip\\bin\\datagrip64.exe'],
        command: 'datagrip',
        icon: 'fas fa-database'
    },
    postman: {
        name: 'Postman',
        paths: [
            'C:\\Program Files\\Postman\\Postman.exe'
        ],
        dynamicPaths: [
            'LOCALAPPDATA\\Postman\\Postman.exe',
            'USERPROFILE\\AppData\\Local\\Postman\\Postman.exe'
        ],
        command: 'start postman',
        icon: 'fas fa-rocket'
    },
    gitbash: {
        name: 'Git Bash',
        paths: [
            'C:\\Program Files\\Git\\git-bash.exe',
            'C:\\Program Files (x86)\\Git\\git-bash.exe'
        ],
        command: 'start git-bash',
        icon: 'fab fa-git-alt'
    },
    
    // 浏览器
    chrome: {
        name: 'Google Chrome',
        paths: [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ],
        dynamicPaths: ['LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe'],
        command: 'start chrome',
        icon: 'fab fa-chrome'
    },
    edge: {
        name: 'Microsoft Edge',
        paths: [
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ],
        command: 'start msedge',
        icon: 'fab fa-edge'
    },
    firefox: {
        name: 'Firefox',
        paths: [
            'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
            'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
        ],
        command: 'start firefox',
        icon: 'fab fa-firefox'
    },
    
    // 媒体娱乐
    netease_music: {
        name: '网易云音乐',
        paths: [
            'C:\\Program Files (x86)\\Netease\\CloudMusic\\cloudmusic.exe',
            'C:\\Program Files\\Netease\\CloudMusic\\cloudmusic.exe'
        ],
        command: 'start cloudmusic',
        icon: 'fas fa-music'
    },
    qq_music: {
        name: 'QQ音乐',
        paths: [
            'C:\\Program Files (x86)\\Tencent\\QQMusic\\QQMusic.exe',
            'C:\\Program Files\\Tencent\\QQMusic\\QQMusic.exe'
        ],
        command: 'start qqmusic',
        icon: 'fas fa-music'
    },
    bilibili: {
        name: '哔哩哔哩',
        paths: [
            'C:\\Program Files\\bilibili\\bilibili.exe'
        ],
        dynamicPaths: ['USERPROFILE\\AppData\\Local\\bilibili\\bilibili.exe'],
        command: 'start bilibili',
        icon: 'fas fa-tv'
    },
    
    // 办公效率
    wps: {
        name: 'WPS Office',
        paths: [
            'C:\\Program Files\\WPS Office\\office6\\wps.exe',
            'C:\\Program Files (x86)\\WPS Office\\office6\\wps.exe'
        ],
        command: 'start wps',
        icon: 'fas fa-file-word'
    },
    typora: {
        name: 'Typora',
        paths: [
            'C:\\Program Files\\Typora\\Typora.exe',
            'C:\\Program Files (x86)\\Typora\\Typora.exe'
        ],
        command: 'start typora',
        icon: 'fab fa-markdown'
    },
    notion: {
        name: 'Notion',
        paths: [],
        dynamicPaths: [
            'LOCALAPPDATA\\Programs\\Notion\\Notion.exe',
            'USERPROFILE\\AppData\\Local\\Programs\\Notion\\Notion.exe'
        ],
        command: 'start notion',
        icon: 'fas fa-sticky-note'
    },
    xmind: {
        name: 'XMind',
        paths: [
            'C:\\Program Files\\XMind\\XMind.exe',
            'C:\\Program Files (x86)\\XMind\\XMind.exe'
        ],
        command: 'start xmind',
        icon: 'fas fa-project-diagram'
    },
    snipaste: {
        name: 'Snipaste',
        paths: [
            'C:\\Program Files\\Snipaste\\Snipaste.exe',
            'C:\\Program Files (x86)\\Snipaste\\Snipaste.exe'
        ],
        command: 'start snipaste',
        icon: 'fas fa-cut'
    },
    
    // 系统工具
    cmd: {
        name: '命令提示符',
        paths: ['C:\\Windows\\System32\\cmd.exe'],
        command: 'start cmd',
        icon: 'fas fa-terminal'
    },
    powershell: {
        name: 'PowerShell',
        paths: [
            'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
            'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
        ],
        command: 'start powershell',
        icon: 'fas fa-terminal'
    },
    explorer: {
        name: '文件资源管理器',
        paths: ['C:\\Windows\\explorer.exe'],
        command: 'start explorer',
        icon: 'fas fa-folder-open'
    },
    taskmgr: {
        name: '任务管理器',
        paths: ['C:\\Windows\\System32\\taskmgr.exe'],
        command: 'start taskmgr',
        icon: 'fas fa-tasks'
    }
};

// ========================================
// 启动应用
// ========================================

async function launchApp(appId) {
    const app = AppConfigs[appId];
    if (!app) {
        showToast(`未知应用: ${appId}`);
        return;
    }
    
    // 在Electron环境中
    if (window.electronAPI && window.electronAPI.launchApp) {
        try {
            const result = await window.electronAPI.launchApp(appId, app);
            if (result.success) {
                showToast(`正在启动 ${app.name}...`);
            } else {
                showToast(`启动失败: ${result.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('启动应用失败:', error);
            showToast(`启动失败: ${error.message}`);
        }
    } else {
        // 浏览器环境 - 尝试使用 command
        showToast(`正在尝试启动 ${app.name}...`);
        
        // 尝试打开应用链接（某些应用支持URL协议）
        const protocols = {
            vscode: 'vscode://',
            idea: 'jetbrains://idea/',
            webstorm: 'jetbrains://webstorm/',
            chrome: 'chrome://',
            edge: 'microsoft-edge:',
            wechat: 'weixin://',
            qq: 'tencent://',
            tim: 'tim://'
        };
        
        if (protocols[appId]) {
            window.open(protocols[appId], '_blank');
        } else {
            showToast(`请在桌面应用中使用此功能 (${app.name})`);
        }
    }
}

// ========================================
// 初始化应用中心
// ========================================

function initAppCenter() {
    console.log('应用中心已初始化');
    
    // 检查应用可用性（在Electron环境中）
    if (window.electronAPI && window.electronAPI.checkAppsAvailability) {
        checkAppsAvailability();
    }
}

async function checkAppsAvailability() {
    try {
        const result = await window.electronAPI.checkAppsAvailability(AppConfigs);
        if (result && result.available) {
            // 更新UI显示哪些应用可用
            result.available.forEach(appId => {
                const card = document.querySelector(`[onclick="launchApp('${appId}')"]`);
                if (card) {
                    card.classList.add('app-available');
                }
            });
            
            result.unavailable.forEach(appId => {
                const card = document.querySelector(`[onclick="launchApp('${appId}')"]`);
                if (card) {
                    card.classList.add('app-unavailable');
                    card.style.opacity = '0.6';
                }
            });
        }
    } catch (error) {
        console.log('应用可用性检查失败:', error);
    }
}

console.log('应用中心模块已加载 📱');
