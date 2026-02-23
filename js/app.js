/**
 * FlowBoard - 个人工作台应用逻辑
 */

// ========================================
// 模拟数据
// ========================================

// 账户密码数据（国内常用账号）
let passwordData = [
    {
        id: 1,
        platform: '微信',
        username: 'wxid_******',
        password: '********',
        category: 'social',
        icon: 'fab fa-weixin',
        color: 'linear-gradient(135deg, #07C160, #05a350)',
        strength: 'strong'
    },
    {
        id: 2,
        platform: '支付宝',
        username: '138****8888',
        password: '********',
        category: 'finance',
        icon: 'fas fa-wallet',
        color: 'linear-gradient(135deg, #1677FF, #0958d9)',
        strength: 'strong'
    },
    {
        id: 3,
        platform: 'LeetCode 中国',
        username: 'coder@example.com',
        password: '********',
        category: 'work',
        icon: 'fas fa-code',
        color: 'linear-gradient(135deg, #FFA116, #e5900f)',
        strength: 'medium'
    },
    {
        id: 4,
        platform: 'QQ',
        username: '123456789',
        password: '********',
        category: 'social',
        icon: 'fab fa-qq',
        color: 'linear-gradient(135deg, #12B7F5, #0ea5d9)',
        strength: 'medium'
    },
    {
        id: 5,
        platform: '微博',
        username: 'weibo_user',
        password: '********',
        category: 'social',
        icon: 'fab fa-weibo',
        color: 'linear-gradient(135deg, #E6162D, #c41227)',
        strength: 'medium'
    },
    {
        id: 6,
        platform: '淘宝',
        username: 'tb_user_123',
        password: '********',
        category: 'finance',
        icon: 'fas fa-shopping-cart',
        color: 'linear-gradient(135deg, #FF5000, #e64800)',
        strength: 'strong'
    },
    {
        id: 7,
        platform: '京东',
        username: 'jd_user@qq.com',
        password: '********',
        category: 'finance',
        icon: 'fas fa-dog',
        color: 'linear-gradient(135deg, #E4393C, #c93033)',
        strength: 'strong'
    },
    {
        id: 8,
        platform: 'Bilibili',
        username: 'bili_user',
        password: '********',
        category: 'entertainment',
        icon: 'fas fa-tv',
        color: 'linear-gradient(135deg, #FB7299, #e5678e)',
        strength: 'medium'
    },
    {
        id: 9,
        platform: '网易云音乐',
        username: 'music@163.com',
        password: '********',
        category: 'entertainment',
        icon: 'fas fa-music',
        color: 'linear-gradient(135deg, #C20C0C, #a30a0a)',
        strength: 'strong'
    },
    {
        id: 10,
        platform: '百度',
        username: 'baidu_user',
        password: '********',
        category: 'work',
        icon: 'fas fa-paw',
        color: 'linear-gradient(135deg, #2932E1, #1f26b8)',
        strength: 'medium'
    },
    {
        id: 11,
        platform: 'GitHub',
        username: 'developer@example.com',
        password: '********',
        category: 'work',
        icon: 'fab fa-github',
        color: 'linear-gradient(135deg, #333, #24292e)',
        strength: 'strong'
    },
    {
        id: 12,
        platform: '抖音',
        username: 'douyin_user',
        password: '********',
        category: 'entertainment',
        icon: 'fas fa-music',
        color: 'linear-gradient(135deg, #000000, #1a1a2e)',
        strength: 'medium'
    }
];

// 资讯数据
const newsData = [
    {
        id: 1,
        title: 'OpenAI发布GPT-5新功能：多模态能力大幅提升',
        source: '科技日报',
        time: '2小时前',
        category: 'ai',
        hot: 1250000,
        url: 'https://www.thepaper.cn/newsDetail_forward_12345678'
    },
    {
        id: 2,
        title: '苹果WWDC 2026时间确定：iOS 20将带来革命性更新',
        source: '36氪',
        time: '3小时前',
        category: 'tech',
        hot: 980000,
        url: 'https://36kr.com/p/1234567890'
    },
    {
        id: 3,
        title: 'SpaceX星舰第六次试飞成功：火星计划更进一步',
        source: '环球科学',
        time: '5小时前',
        category: 'tech',
        hot: 870000,
        url: 'https://www.huanqiu.com/article/12345678'
    },
    {
        id: 4,
        title: '特斯拉新款Model 2谍照曝光：售价或低于15万',
        source: '汽车之家',
        time: '4小时前',
        category: 'tech',
        hot: 760000,
        url: 'https://www.autohome.com.cn/news/202601/1234567.html'
    },
    {
        id: 5,
        title: '微软Copilot重大更新：集成更多Office功能',
        source: 'IT之家',
        time: '6小时前',
        category: 'ai',
        hot: 650000,
        url: 'https://www.ithome.com/0/123/456.htm'
    },
    {
        id: 51,
        title: '谷歌Gemini 2.0发布：性能超越GPT-4',
        source: 'AI前线',
        time: '1小时前',
        category: 'ai',
        hot: 1100000,
        url: 'https://www.aifront.com/news/123456'
    },
    {
        id: 52,
        title: 'Anthropic Claude 4即将发布：推理能力大幅提升',
        source: '机器之心',
        time: '3小时前',
        category: 'ai',
        hot: 890000,
        url: 'https://www.jiqizhixin.com/article/123456'
    },
    {
        id: 53,
        title: 'Midjourney V7发布：图像生成质量再创新高',
        source: '数字艺术家',
        time: '5小时前',
        category: 'ai',
        hot: 720000,
        url: 'https://www.digitalart.com/news/123456'
    },
    {
        id: 6,
        title: '美联储宣布加息25个基点：全球股市震荡',
        source: '财经网',
        time: '1小时前',
        category: 'finance',
        hot: 1100000,
        url: 'https://finance.sina.com.cn/jjxw/2026-01-01/doc-12345678'
    },
    {
        id: 7,
        title: '比特币突码10万美元大关：创历史新高',
        source: '区块链日报',
        time: '2小时前',
        category: 'finance',
        hot: 920000,
        url: 'https://www.jinse.com/news/blockchain/1234567'
    },
    {
        id: 8,
        title: '2026年春节档电影票房破纪录：总票房超80亿',
        source: '娱乐周刊',
        time: '8小时前',
        category: 'entertainment',
        hot: 780000,
        url: 'https://ent.sina.com.cn/m/c/2026-01-01/doc-12345678'
    },
    // 微博热搜
    {
        id: 101,
        title: '#张学友新电影官宣# 将于春节档上映',
        source: '微博热搜',
        time: '30分钟前',
        category: 'entertainment',
        hot: 2500000,
        url: 'https://s.weibo.com/weibo?q=%23张学友新电影%23'
    },
    {
        id: 102,
        title: '#国产芯片新突破# 光刻机技术取得重大进展',
        source: '微博热搜',
        time: '1小时前',
        category: 'tech',
        hot: 1800000,
        url: 'https://s.weibo.com/weibo?q=%23国产芯片%23'
    },
    {
        id: 103,
        title: '#考研成绩公布# 各高校开始陆续发布复试线',
        source: '微博热搜',
        time: '2小时前',
        category: 'social',
        hot: 1650000,
        url: 'https://s.weibo.com/weibo?q=%23考研成绩%23'
    },
    // 知乎热榜
    {
        id: 201,
        title: '如何评价国产大模型的开源路线？',
        source: '知乎热榜',
        time: '3小时前',
        category: 'ai',
        hot: 890000,
        url: 'https://www.zhihu.com/question/123456789'
    },
    {
        id: 202,
        title: '2026年有哪些值得关注的科技趋势？',
        source: '知乎热榜',
        time: '5小时前',
        category: 'tech',
        hot: 750000,
        url: 'https://www.zhihu.com/question/234567890'
    },
    // 抖音热榜
    {
        id: 301,
        title: '《第二十条》电影片段火爆全网',
        source: '抖音热榜',
        time: '1小时前',
        category: 'entertainment',
        hot: 3200000,
        url: 'https://www.douyin.com/hot'
    },
    // 今日头条
    {
        id: 401,
        title: '多地发布新能源车补贴新政：最高补贴5万元',
        source: '今日头条',
        time: '2小时前',
        category: 'finance',
        hot: 1100000,
        url: 'https://www.toutiao.com/article/123456'
    },
    {
        id: 402,
        title: '教育部：2026年高考新政策实施细则发布',
        source: '今日头条',
        time: '4小时前',
        category: 'social',
        hot: 950000,
        url: 'https://www.toutiao.com/article/234567'
    }
];

// 待办事项数据
let todoData = [];

let todoIdCounter = 1;

// ========================================
// 待办事项数据持久化
// ========================================

function loadTodosFromStorage() {
    try {
        const stored = localStorage.getItem('todos');
        if (stored) {
            todoData = JSON.parse(stored);
            // 更新计数器
            if (todoData.length > 0) {
                todoIdCounter = Math.max(...todoData.map(t => t.id)) + 1;
            }
        } else {
            // 没有存储数据时使用默认数据
            todoData = [
                { id: 1, text: '更新项目文档', completed: false, tag: '紧急' },
                { id: 2, text: '修改账户密码', completed: true, tag: '一般' },
                { id: 3, text: '查看今日资讯', completed: false, tag: '日常' },
                { id: 4, text: '备份重要数据', completed: false, tag: '重要' }
            ];
            todoIdCounter = 5;
            saveTodosToStorage();
        }
    } catch (error) {
        console.error('加载待办事项失败:', error);
        todoData = [];
    }
}

function saveTodosToStorage() {
    try {
        localStorage.setItem('todos', JSON.stringify(todoData));
    } catch (error) {
        console.error('保存待办事项失败:', error);
    }
}

// ========================================
// DOM 元素
// ========================================

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const passwordCards = document.getElementById('passwordCards');
const newsList = document.getElementById('newsList');
const themeCards = document.querySelectorAll('.theme-card');
const categoryBtns = document.querySelectorAll('.cat-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const modal = document.getElementById('addPasswordModal');

// ========================================
// 初始化
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    renderPasswordCards();
    updatePasswordCount();
    renderPasswordPreview();
    renderNewsList();
    initThemeSwitcher();
    initCategoryFilter();
    initTabSwitcher();
    initPasswordStrength();
    initSettings();
    initWeather();
    initVersion();
    
    // 延迟初始化 LeetCode，确保 DOM 完全加载
    setTimeout(() => {
        initLeetCode();
        initAppCenter();
    }, 100);
});

// ========================================
// 导航功能
// ========================================

function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = item.dataset.page;
            showPage(pageName);
            
            // 更新导航激活状态
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function showPage(pageName) {
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 更新导航状态
    navItems.forEach(nav => {
        nav.classList.remove('active');
        if (nav.dataset.page === pageName) {
            nav.classList.add('active');
        }
    });
    
    // 切换到主页时，强制重绘 SVG 圆环
    if (pageName === 'dashboard') {
        setTimeout(() => {
            const scoreRing = document.querySelector('.score-ring svg');
            if (scoreRing) {
                // 强制重绘
                scoreRing.style.display = 'none';
                scoreRing.offsetHeight; // 触发 reflow
                scoreRing.style.display = '';
            }
        }, 50);
    }
    
    // 初始化笔记页面
    if (pageName === 'notes' && typeof initNotes === 'function') {
        setTimeout(initNotes, 100);
    }
    
    // 初始化日程页面
    if (pageName === 'calendar' && typeof initCalendar === 'function') {
        setTimeout(initCalendar, 100);
    }
    
    // 初始化 GitHub 页面
    if (pageName === 'github' && typeof initGithub === 'function') {
        setTimeout(initGithub, 100);
    }
    
    // 初始化个人提升页面
    if (pageName === 'growth' && typeof initGrowth === 'function') {
        setTimeout(initGrowth, 100);
    }
    
    // 初始化面试追踪页面
    if (pageName === 'interview' && typeof initInterview === 'function') {
        setTimeout(initInterview, 100);
    }
    
    // 初始化 LeetCode 页面
    if (pageName === 'leetcode') {
        setTimeout(() => {
            if (typeof initLeetCode === 'function') {
                initLeetCode();
            }
        }, 100);
    }
}

// ========================================
// 账户密码管理
// ========================================

function renderPasswordCards(category = 'all') {
    if (!passwordCards) return;
    
    const filtered = category === 'all' 
        ? passwordData 
        : passwordData.filter(p => p.category === category);
    
    passwordCards.innerHTML = filtered.map(item => `
        <div class="password-card">
            <div class="pwd-card-header">
                <div class="pwd-card-icon" style="background: ${item.color}">
                    <i class="${item.icon}"></i>
                </div>
                <div class="pwd-card-title">
                    <h4>${item.platform}</h4>
                    <span>${getCategoryName(item.category)}</span>
                </div>
            </div>
            <div class="pwd-card-body">
                <div class="pwd-field">
                    <i class="fas fa-user"></i>
                    <input type="text" value="${item.username}" readonly>
                    <button onclick="copyToClipboard('${item.username}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="pwd-field">
                    <i class="fas fa-lock"></i>
                    <input type="password" value="${item.password}" readonly id="pwd-${item.id}">
                    <button onclick="togglePasswordVisibility(${item.id})">
                        <i class="fas fa-eye" id="eye-${item.id}"></i>
                    </button>
                    <button onclick="copyToClipboard('password${item.id}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="pwd-card-footer">
                <div class="pwd-strength-badge">
                    <span class="strength-dot" style="background: ${getStrengthColor(item.strength)}"></span>
                    <span>${getStrengthText(item.strength)}</span>
                </div>
                <div class="pwd-actions">
                    <button class="pwd-action-btn" onclick="editPassword(${item.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="pwd-action-btn" onclick="deletePassword(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function getCategoryName(category) {
    const names = {
        social: '社交网络',
        work: '工作办公',
        finance: '金融支付',
        entertainment: '娱乐休闲'
    };
    return names[category] || '其他';
}

function getStrengthColor(strength) {
    const colors = {
        weak: '#ef4444',
        medium: '#f59e0b',
        strong: '#22c55e'
    };
    return colors[strength] || '#6b7280';
}

function getStrengthText(strength) {
    const texts = {
        weak: '弱密码',
        medium: '中等',
        strong: '强密码'
    };
    return texts[strength] || '未知';
}

function initCategoryFilter() {
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPasswordCards(btn.dataset.cat);
        });
    });
}

function togglePasswordVisibility(id) {
    const input = document.getElementById(`pwd-${id}`);
    const eye = document.getElementById(`eye-${id}`);
    
    if (input.type === 'password') {
        input.type = 'text';
        eye.classList.remove('fa-eye');
        eye.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        eye.classList.remove('fa-eye-slash');
        eye.classList.add('fa-eye');
    }
}

function copyToClipboard(text) {
    // 模拟复制功能
    showToast('已复制到剪贴板');
}

// 当前编辑的密码 ID
let editingPasswordId = null;

function editPassword(id) {
    const item = passwordData.find(p => p.id === id);
    if (!item) {
        showToast('账户不存在');
        return;
    }
    
    // 设置编辑模式
    editingPasswordId = id;
    
    // 填充表单数据
    document.getElementById('platformName').value = item.platform;
    document.getElementById('username').value = item.username;
    document.getElementById('password').value = item.password === '********' ? '' : item.password;
    
    // 设置分类选中状态
    document.querySelectorAll('.cat-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.value === item.category) {
            btn.classList.add('active');
        }
    });
    
    // 更新模态框标题
    const modalTitle = document.querySelector('#addPasswordModal .modal-header h3');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> 编辑账户';
    }
    
    // 显示模态框
    modal.classList.add('active');
}

function deletePassword(id) {
    if (confirm('确定要删除这个账户吗？')) {
        const index = passwordData.findIndex(p => p.id === id);
        if (index > -1) {
            passwordData.splice(index, 1);
            renderPasswordCards();
            updatePasswordCount();
            showToast('账户已删除');
        }
    }
}

// 更新密码数量统计
function updatePasswordCount() {
    const countEl = document.getElementById('passwordCount');
    if (countEl) {
        countEl.textContent = passwordData.length;
    }
}

// 渲染首页密码预览列表
function renderPasswordPreview() {
    const previewList = document.getElementById('passwordPreviewList');
    if (!previewList) return;
    
    // 取前3个密码显示
    const previewData = passwordData.slice(0, 3);
    
    previewList.innerHTML = previewData.map(item => `
        <div class="pwd-item">
            <div class="pwd-icon" style="background: ${item.color}">
                <i class="${item.icon}"></i>
            </div>
            <div class="pwd-info">
                <span class="pwd-name">${item.platform}</span>
                <span class="pwd-strength ${item.strength}">${getStrengthText(item.strength).replace('密码', '')}</span>
            </div>
        </div>
    `).join('');
}

// ========================================
// 实时资讯
// ========================================

function renderNewsList() {
    if (!newsList) return;
    
    newsList.innerHTML = newsData.slice(0, 8).map((item, index) => `
        <div class="news-item-simple" onclick="openNewsUrl('${item.url}')">
            <span class="news-rank ${index < 3 ? 'top' : ''}">${index + 1}</span>
            <div class="news-simple-content">
                <h4 class="news-simple-title">${item.title}</h4>
                <div class="news-simple-meta">
                    <span class="news-source">${item.source}</span>
                    <span class="news-time">${item.time}</span>
                    <span class="news-hot"><i class="fas fa-fire"></i> ${formatHot(item.hot)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function formatHot(hot) {
    if (hot >= 10000) {
        return (hot / 10000).toFixed(1) + '万';
    }
    return hot.toString();
}

function initTabSwitcher() {
    const filterBtns = document.querySelectorAll('.news-filters .filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            filterNews(filter);
        });
    });
}

function filterNews(category) {
    const newsList = document.getElementById('newsList');
    if (!newsList) return;
    
    let filtered = newsData;
    if (category && category !== 'all') {
        filtered = newsData.filter(item => item.category === category);
    }
    
    // 显示前8条
    const displayData = filtered.slice(0, 8);
    
    if (displayData.length === 0) {
        newsList.innerHTML = `
            <div class="news-empty">
                <i class="fas fa-newspaper"></i>
                <p>暂无该分类的资讯</p>
            </div>
        `;
        return;
    }
    
    newsList.innerHTML = displayData.map((item, index) => `
        <div class="news-item-simple" onclick="openNewsUrl('${item.url}')">
            <span class="news-rank ${index < 3 ? 'top' : ''}">${index + 1}</span>
            <div class="news-simple-content">
                <h4 class="news-simple-title">${item.title}</h4>
                <div class="news-simple-meta">
                    <span class="news-source">${item.source}</span>
                    <span class="news-time">${item.time}</span>
                    <span class="news-hot"><i class="fas fa-fire"></i> ${formatHot(item.hot)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function openNewsUrl(url) {
    if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
    } else {
        window.open(url, '_blank');
    }
}

// ========================================
// 主题切换
// ========================================

function initThemeSwitcher() {
    themeCards.forEach(card => {
        card.addEventListener('click', () => {
            const theme = card.dataset.theme;
            applyTheme(theme);
            
            // 更新选中状态
            themeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // 保存主题设置
            localStorage.setItem('theme', theme);
        });
    });
    
    // 加载保存的主题
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
        themeCards.forEach(c => {
            c.classList.remove('active');
            if (c.dataset.theme === savedTheme) {
                c.classList.add('active');
            }
        });
    }
}

function applyTheme(themeName) {
    document.body.className = themeName;
}

// ========================================
// 设置功能
// ========================================

function initSettings() {
    // 毛玻璃效果开关
    const toggleGlass = document.getElementById('toggleGlass');
    if (toggleGlass) {
        toggleGlass.addEventListener('change', (e) => {
            const blur = e.target.checked ? 'blur(20px)' : 'none';
            document.documentElement.style.setProperty('--glass-blur', blur);
        });
    }
    
    // 动画效果开关
    const toggleAnim = document.getElementById('toggleAnim');
    if (toggleAnim) {
        toggleAnim.addEventListener('change', (e) => {
            const transition = e.target.checked ? 'all 0.3s ease' : 'none';
            document.documentElement.style.setProperty('--transition', transition);
        });
    }
    
    // 圆角大小调节
    const radiusRange = document.getElementById('radiusRange');
    if (radiusRange) {
        radiusRange.addEventListener('input', (e) => {
            const radius = e.target.value + 'px';
            document.documentElement.style.setProperty('--border-radius', radius);
            e.target.nextElementSibling.textContent = radius;
        });
    }
    
    // 初始化开机启动设置
    initAutoLaunchSettings();
    
    // Initialize weather location preference settings
    initWeatherLocationSettings();
}

// ========================================
// 开机启动设置
// ========================================

async function initAutoLaunchSettings() {
    // 检查是否在Electron环境中
    if (!window.electronAPI || !window.electronAPI.getAutoLaunchStatus) {
        console.log('非Electron环境，跳过开机启动设置');
        disableAutoLaunchSettings('仅在桌面应用中可用');
        return;
    }
    
    // 获取开机启动状态
    try {
        const status = await window.electronAPI.getAutoLaunchStatus();
        console.log('开机启动状态:', status);
        
        if (status.success) {
            const toggleAutoLaunch = document.getElementById('toggleAutoLaunch');
            if (toggleAutoLaunch) {
                toggleAutoLaunch.checked = status.enabled;
                toggleAutoLaunch.addEventListener('change', async (e) => {
                    const result = await window.electronAPI.setAutoLaunch(e.target.checked);
                    if (result.success) {
                        showToast(e.target.checked ? '已设置开机自动启动' : '已取消开机自动启动');
                    } else {
                        showToast('设置失败: ' + (result.error || '未知错误'));
                        toggleAutoLaunch.checked = !e.target.checked; // 恢复原状态
                    }
                });
            }
            
            // 如果平台不支持，显示提示
            if (status.notSupported) {
                disableAutoLaunchSettings('当前平台暂不支持');
            }
        } else {
            disableAutoLaunchSettings('无法获取状态');
        }
    } catch (error) {
        console.error('初始化开机启动设置失败:', error);
        disableAutoLaunchSettings('初始化失败');
    }
    
    // 启动时最小化设置
    const toggleMinimizeOnLaunch = document.getElementById('toggleMinimizeOnLaunch');
    if (toggleMinimizeOnLaunch) {
        const savedMinimizeOnLaunch = localStorage.getItem('minimizeOnLaunch');
        toggleMinimizeOnLaunch.checked = savedMinimizeOnLaunch === 'true';
        toggleMinimizeOnLaunch.addEventListener('change', (e) => {
            localStorage.setItem('minimizeOnLaunch', e.target.checked);
            showToast(e.target.checked ? '启动时将自动最小化' : '启动时正常显示窗口');
        });
    }
    
    // 关闭时最小化设置
    const toggleMinimizeOnClose = document.getElementById('toggleMinimizeOnClose');
    if (toggleMinimizeOnClose) {
        const savedMinimizeOnClose = localStorage.getItem('minimizeOnClose');
        toggleMinimizeOnClose.checked = savedMinimizeOnClose !== 'false'; // 默认开启
        toggleMinimizeOnClose.addEventListener('change', (e) => {
            localStorage.setItem('minimizeOnClose', e.target.checked);
            showToast(e.target.checked ? '关闭时最小化到托盘' : '关闭时退出应用');
        });
    }
}

function disableAutoLaunchSettings(reason) {
    const settingItem = document.getElementById('autoLaunchSetting');
    if (settingItem) {
        settingItem.classList.add('disabled');
        settingItem.style.opacity = '0.5';
        settingItem.style.pointerEvents = 'none';
        
        const descEl = settingItem.querySelector('.setting-desc');
        if (descEl) {
            descEl.textContent += ` (${reason})`;
        }
    }
}

// ========================================
// 模态框功能
// ========================================

function openAddPasswordModal() {
    // 重置编辑状态
    editingPasswordId = null;
    
    // 清空表单
    document.getElementById('platformName').value = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // 重置分类为第一个
    document.querySelectorAll('.cat-option').forEach((btn, index) => {
        btn.classList.remove('active');
        if (index === 0) btn.classList.add('active');
    });
    
    // 更新模态框标题
    const modalTitle = document.querySelector('#addPasswordModal .modal-header h3');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> 添加账户';
    }
    
    modal.classList.add('active');
}

function closeAddPasswordModal() {
    modal.classList.remove('active');
    editingPasswordId = null;
}

function savePassword() {
    const platform = document.getElementById('platformName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!platform || !username || !password) {
        showToast('请填写完整信息');
        return;
    }
    
    // 获取选中的分类
    const activeCat = document.querySelector('.cat-option.active');
    const category = activeCat ? activeCat.dataset.value : 'social';
    
    // 计算密码强度
    const strength = checkPasswordStrength(password);
    
    if (editingPasswordId) {
        // 编辑模式
        const index = passwordData.findIndex(p => p.id === editingPasswordId);
        if (index > -1) {
            passwordData[index] = {
                ...passwordData[index],
                platform,
                username,
                password,
                category,
                strength
            };
            showToast('账户已更新');
        }
    } else {
        // 添加模式
        const newId = Math.max(...passwordData.map(p => p.id), 0) + 1;
        const iconMap = {
            social: 'fas fa-share-alt',
            work: 'fas fa-briefcase',
            finance: 'fas fa-credit-card',
            entertainment: 'fas fa-gamepad'
        };
        const colorMap = {
            social: 'linear-gradient(135deg, #07C160, #05a350)',
            work: 'linear-gradient(135deg, #1677FF, #0958d9)',
            finance: 'linear-gradient(135deg, #FF5000, #e64800)',
            entertainment: 'linear-gradient(135deg, #FB7299, #e5678e)'
        };
        
        passwordData.push({
            id: newId,
            platform,
            username,
            password,
            category,
            icon: iconMap[category] || 'fas fa-lock',
            color: colorMap[category] || 'linear-gradient(135deg, #667eea, #764ba2)',
            strength
        });
        showToast('账户添加成功');
    }
    
    // 刷新显示
    renderPasswordCards();
    updatePasswordCount();
    closeAddPasswordModal();
    
    // 清空表单
    document.getElementById('platformName').value = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// 密码强度检测
function initPasswordStrength() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            const strength = checkPasswordStrength(e.target.value);
            updateStrengthMeter(strength);
        });
    }
}

function checkPasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
}

function updateStrengthMeter(strength) {
    const bar = document.getElementById('strengthBar');
    const text = document.getElementById('strengthText');
    
    if (!bar || !text) return;
    
    bar.className = 'strength-bar ' + strength;
    
    const texts = {
        weak: '密码强度：弱',
        medium: '密码强度：中',
        strong: '密码强度：强'
    };
    text.textContent = texts[strength] || '密码强度';
}

// 分类选择
const catOptions = document.querySelectorAll('.cat-option');
catOptions.forEach(option => {
    option.addEventListener('click', () => {
        catOptions.forEach(o => o.classList.remove('active'));
        option.classList.add('active');
    });
});

// ========================================
// 工具函数
// ========================================

function showToast(message) {
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--accent-color);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 添加动画样式
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 3秒后移除
    setTimeout(() => {
        toast.style.animation = 'fadeInUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 快捷键支持
document.addEventListener('keydown', (e) => {
    // ESC关闭模态框
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeAddPasswordModal();
    }
    
    // Ctrl/Cmd + K 搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        showToast('搜索功能开发中...');
    }
});

// 实时时间更新
function updateTime() {
    const now = new Date();
    // 可以在这里添加时间显示逻辑
}

setInterval(updateTime, 1000);

// 模拟实时数据更新
setInterval(() => {
    // 更新消息计数
    const msgCount = document.getElementById('messageCount');
    if (msgCount && Math.random() > 0.7) {
        const count = parseInt(msgCount.textContent);
        if (Math.random() > 0.5 && count < 10) {
            msgCount.textContent = count + 1;
        }
    }
}, 30000);

// ========================================
// 热榜中心点击跳转
// ========================================

function openFeaturedNews() {
    // 打开头条新闻链接
    const url = 'https://www.thepaper.cn/newsDetail_forward_12345678';
    if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
    } else {
        window.open(url, '_blank');
    }
}

function initNewsClickHandler() {
    // 为热榜中心的新闻项添加点击事件
    const newsItems = document.querySelectorAll('.news-item');
    newsItems.forEach((item, index) => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const news = newsData[index];
            if (news && news.url) {
                // 在默认浏览器中打开链接
                if (window.electronAPI && window.electronAPI.openExternal) {
                    window.electronAPI.openExternal(news.url);
                } else {
                    window.open(news.url, '_blank');
                }
            } else {
                showToast('暂无该新闻的链接');
            }
        });
    });
    
    // 资讯详情页面的新闻项
    const newsDetailItems = document.querySelectorAll('.news-item-detailed');
    newsDetailItems.forEach((item, index) => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const news = newsData[index];
            if (news && news.url) {
                if (window.electronAPI && window.electronAPI.openExternal) {
                    window.electronAPI.openExternal(news.url);
                } else {
                    window.open(news.url, '_blank');
                }
            }
        });
    });
}

// ========================================
// 待办事项功能
// ========================================

function initTodoList() {
    loadTodosFromStorage();
    renderTodoList();
    renderDashboardTodoList();
    updateTaskCount();
}

function renderTodoList() {
    // 只针对独立的待办事项页面，不针对主页的待办卡片
    const todoPage = document.getElementById('page-todo');
    if (!todoPage) return; // 如果没有待办事项页面，直接返回
    
    const todoList = todoPage.querySelector('.todo-list');
    if (!todoList) return;
    
    // 清空列表
    todoList.innerHTML = '';
    
    // 添加每个待办事项
    todoData.forEach(todo => {
        const todoItem = createTodoElement(todo);
        todoList.appendChild(todoItem);
    });
    
    // 添加"新增待办"按钮
    const addButton = document.createElement('button');
    addButton.className = 'btn-primary';
    addButton.style.cssText = 'width: 100%; margin-top: 12px; padding: 10px;';
    addButton.innerHTML = '<i class="fas fa-plus"></i> 添加待办';
    addButton.addEventListener('click', showAddTodoModal);
    todoList.appendChild(addButton);
}

function createTodoElement(todo) {
    const item = document.createElement('div');
    item.className = 'todo-item';
    item.dataset.id = todo.id;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-check';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));
    
    const label = document.createElement('label');
    label.className = 'todo-text' + (todo.completed ? ' completed' : '');
    label.textContent = todo.text;
    
    const tag = document.createElement('span');
    tag.className = 'todo-tag ' + getTagClass(todo.tag);
    tag.textContent = todo.tag;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon';
    deleteBtn.style.cssText = 'margin-left: auto; width: 28px; height: 28px;';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTodo(todo.id);
    });
    
    item.appendChild(checkbox);
    item.appendChild(label);
    item.appendChild(tag);
    item.appendChild(deleteBtn);
    
    return item;
}

function toggleTodo(id) {
    const todo = todoData.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodosToStorage();
        renderTodoList();
        updateTaskCount();
    }
}

function deleteTodo(id) {
    if (confirm('确定要删除这个待办事项吗？')) {
        todoData = todoData.filter(t => t.id !== id);
        saveTodosToStorage();
        renderTodoList();
        updateTaskCount();
        showToast('已删除');
    }
}

function showAddTodoModal() {
    // 重置表单
    document.getElementById('todoText').value = '';
    // 重置标签选择
    document.querySelectorAll('#todoTagSelect .cat-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.value === '一般') {
            btn.classList.add('active');
        }
    });
    // 显示模态框
    document.getElementById('addTodoModal').classList.add('active');
}

function closeAddTodoModal() {
    document.getElementById('addTodoModal').classList.remove('active');
}

function selectTodoTag(btn) {
    document.querySelectorAll('#todoTagSelect .cat-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function saveTodoFromModal() {
    const text = document.getElementById('todoText').value.trim();
    if (!text) {
        showToast('请输入待办内容');
        return;
    }
    
    const activeTag = document.querySelector('#todoTagSelect .cat-option.active');
    const tag = activeTag ? activeTag.dataset.value : '一般';
    
    const newTodo = {
        id: todoIdCounter++,
        text: text,
        completed: false,
        tag: tag
    };
    todoData.push(newTodo);
    saveTodosToStorage();
    renderTodoList();
    renderDashboardTodoList();
    updateTaskCount();
    closeAddTodoModal();
    showToast('已添加');
}

function updateTaskCount() {
    // 统计未完成的待办事项数量
    const uncompletedCount = todoData.filter(t => !t.completed).length;
    const taskCountEl = document.getElementById('taskCount');
    if (taskCountEl) {
        taskCountEl.textContent = uncompletedCount;
    }
}

// ========================================
// 主页待办事项功能
// ========================================

function renderDashboardTodoList() {
    const todoList = document.getElementById('dashboardTodoList');
    if (!todoList) return;
    
    const getTagClass = (tag) => {
        switch(tag) {
            case '紧急': return 'urgent';
            case '重要': return 'important';
            case '一般': return 'normal';
            case '日常': return 'daily';
            default: return '';
        }
    };
    
    todoList.innerHTML = todoData.map(todo => `
        <div class="todo-item">
            <input type="checkbox" class="todo-check" id="todo${todo.id}" ${todo.completed ? 'checked' : ''} onchange="toggleDashboardTodo(${todo.id})">
            <label for="todo${todo.id}" class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</label>
            <span class="todo-tag ${getTagClass(todo.tag)}">${todo.tag}</span>
            <button class="todo-delete-btn" onclick="deleteDashboardTodo(${todo.id})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function toggleDashboardTodo(id) {
    const todo = todoData.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodosToStorage();
        renderDashboardTodoList();
        updateTaskCount();
        renderTodoList(); // 同时更新其他页面的列表
    }
}

function deleteDashboardTodo(id) {
    if (confirm('确定要删除这个待办事项吗？')) {
        todoData = todoData.filter(t => t.id !== id);
        saveTodosToStorage();
        renderDashboardTodoList();
        updateTaskCount();
        renderTodoList();
        showToast('已删除');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化热榜点击和待办功能
    setTimeout(() => {
        initNewsClickHandler();
        initTodoList();
    }, 500);
    
    // 加载用户配置
    loadUserProfile();
});

// ========================================
// 底部按钮交互
// ========================================

// 回到主页
function goToHome() {
    showPage('dashboard');
}

// 从底部按钮打开设置
function openSettingsFromFooter() {
    showPage('settings');
}

// ========================================
// 个人设置
// ========================================

function openProfileModal() {
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

function saveProfile() {
    const name = document.getElementById('profileNameInput').value.trim();
    
    if (!name) {
        showToast('请输入显示名称');
        return;
    }
    
    // 保存到 localStorage
    const profile = {
        name: name,
        avatar: localStorage.getItem('user_avatar') || null
    };
    localStorage.setItem('user_profile', JSON.stringify(profile));
    
    // 更新显示
    updateUserCardDisplay(profile);
    
    showToast('个人设置已保存');
    closeProfileModal();
}

function changeAvatar() {
    document.getElementById('avatarInput').click();
}

function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件');
        return;
    }
    
    // 检查文件大小（最大 2MB）
    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过 2MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const avatarData = e.target.result;
        localStorage.setItem('user_avatar', avatarData);
        
        // 更新预览
        const avatarDisplay = document.getElementById('profileAvatarDisplay');
        avatarDisplay.innerHTML = `<img src="${avatarData}" alt="头像">`;
        
        showToast('头像已更新');
    };
    reader.readAsDataURL(file);
}

function loadUserProfile() {
    const stored = localStorage.getItem('user_profile');
    if (stored) {
        try {
            const profile = JSON.parse(stored);
            document.getElementById('profileNameInput').value = profile.name || '个人用户';
            updateUserCardDisplay(profile);
        } catch (e) {
            console.error('加载用户配置失败:', e);
        }
    }
    
    // 加载头像
    const avatar = localStorage.getItem('user_avatar');
    if (avatar) {
        const avatarDisplay = document.getElementById('profileAvatarDisplay');
        if (avatarDisplay) {
            avatarDisplay.innerHTML = `<img src="${avatar}" alt="头像">`;
        }
    }
}

function updateUserCardDisplay(profile) {
    // 更新侧边栏用户卡片
    const userNameEl = document.querySelector('.user-name');
    const userAvatarEl = document.querySelector('.user-avatar');
    
    if (userNameEl) userNameEl.textContent = profile.name;
    
    // 更新头像
    const avatar = localStorage.getItem('user_avatar');
    if (avatar && userAvatarEl) {
        userAvatarEl.innerHTML = `<img src="${avatar}" alt="头像">`;
    }
    
    // 同时更新个人设置模态框中的头像
    const profileAvatarDisplay = document.getElementById('profileAvatarDisplay');
    if (profileAvatarDisplay && avatar) {
        profileAvatarDisplay.innerHTML = `<img src="${avatar}" alt="头像">`;
    }
}

console.log('FlowBoard 已加载完成 🚀');


// ========================================
// 天气功能
// ========================================

let weatherData = null;
let currentLocation = null;
const WEATHER_CACHE_KEY = 'weather_cache_v2';
const WEATHER_PREFERENCE_KEY = 'weather_location_preference_v1';
const WEATHER_CACHE_DURATION = 30 * 60 * 1000;
const GPS_ACCURACY_THRESHOLD_METERS = 5000;
const DEFAULT_WEATHER_LOCATION = {
    lat: 39.9042,
    lon: 116.4074,
    city: '北京',
    source: 'default'
};

// WMO 天气代码映射
const weatherCodeMap = {
    0: { desc: '晴', icon: 'fa-sun', color: '#FFA500' },
    1: { desc: '多云', icon: 'fa-cloud-sun', color: '#87CEEB' },
    2: { desc: '多云', icon: 'fa-cloud-sun', color: '#87CEEB' },
    3: { desc: '阴', icon: 'fa-cloud', color: '#B0C4DE' },
    45: { desc: '雾', icon: 'fa-smog', color: '#C0C0C0' },
    48: { desc: '雾凇', icon: 'fa-smog', color: '#C0C0C0' },
    51: { desc: '毛毛雨', icon: 'fa-cloud-rain', color: '#4682B4' },
    53: { desc: '小雨', icon: 'fa-cloud-rain', color: '#4682B4' },
    55: { desc: '中雨', icon: 'fa-cloud-rain', color: '#4682B4' },
    61: { desc: '小雨', icon: 'fa-cloud-rain', color: '#4682B4' },
    63: { desc: '中雨', icon: 'fa-cloud-showers-heavy', color: '#4169E1' },
    65: { desc: '大雨', icon: 'fa-cloud-showers-heavy', color: '#4169E1' },
    71: { desc: '小雪', icon: 'fa-snowflake', color: '#87CEFA' },
    73: { desc: '中雪', icon: 'fa-snowflake', color: '#87CEFA' },
    75: { desc: '大雪', icon: 'fa-snowflake', color: '#87CEFA' },
    80: { desc: '阵雨', icon: 'fa-cloud-showers-heavy', color: '#4169E1' },
    81: { desc: '强阵雨', icon: 'fa-cloud-showers-heavy', color: '#4169E1' },
    82: { desc: '暴雨', icon: 'fa-cloud-showers-heavy', color: '#0000CD' },
    95: { desc: '雷雨', icon: 'fa-bolt', color: '#FFD700' },
    96: { desc: '雷阵雨', icon: 'fa-bolt', color: '#FFD700' },
    99: { desc: '强雷雨', icon: 'fa-bolt', color: '#FFD700' }
};

function getWeatherPreference() {
    try {
        const raw = localStorage.getItem(WEATHER_PREFERENCE_KEY);
        if (!raw) return { mode: 'auto' };
        const parsed = JSON.parse(raw);
        if (!parsed || (parsed.mode !== 'auto' && parsed.mode !== 'manual')) {
            return { mode: 'auto' };
        }
        return parsed;
    } catch (_error) {
        return { mode: 'auto' };
    }
}

function setWeatherPreference(preference) {
    localStorage.setItem(WEATHER_PREFERENCE_KEY, JSON.stringify(preference));
}

function getLocationSourceLabel(source) {
    const sourceLabels = {
        manual: '手动城市',
        gps: 'GPS',
        'gps-low-accuracy': 'GPS(低精度)',
        ip: 'IP',
        default: '默认城市'
    };
    return sourceLabels[source] || '未知';
}

function updateWeatherLocationStatus() {
    const statusEl = document.getElementById('weatherLocationStatus');
    if (!statusEl) return;

    const preference = getWeatherPreference();
    const strategyText = preference.mode === 'manual'
        ? `定位策略：手动城市（${preference.city || '未设置'}）`
        : '定位策略：自动定位';

    if (!currentLocation) {
        statusEl.textContent = strategyText;
        return;
    }

    const sourceLabel = getLocationSourceLabel(currentLocation.source);
    const cityText = currentLocation.city ? `（${currentLocation.city}）` : '';
    statusEl.textContent = `${strategyText} · 当前来源：${sourceLabel}${cityText}`;
}

function initWeatherLocationSettings() {
    const cityInput = document.getElementById('weatherCityInput');
    if (!cityInput) return;

    const preference = getWeatherPreference();
    if (preference.mode === 'manual' && preference.city) {
        cityInput.value = preference.city;
    } else {
        cityInput.value = '';
    }

    cityInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveManualWeatherLocation();
        }
    });

    updateWeatherLocationStatus();
}

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function buildWeatherLocationKey(location) {
    const lat = toFiniteNumber(location?.lat);
    const lon = toFiniteNumber(location?.lon);
    const roundedLat = lat === null ? '0.00' : lat.toFixed(2);
    const roundedLon = lon === null ? '0.00' : lon.toFixed(2);
    const city = (location?.city || '').trim();
    return `${location?.source || 'unknown'}:${roundedLat},${roundedLon}:${city}`;
}

function readWeatherCache(locationKey) {
    try {
        const raw = localStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return null;

        const cache = JSON.parse(raw);
        if (!cache || !cache.timestamp || !cache.locationKey || !cache.weatherData || !cache.location) {
            return null;
        }

        if (Date.now() - cache.timestamp > WEATHER_CACHE_DURATION) {
            return null;
        }

        if (cache.locationKey !== locationKey) {
            return null;
        }

        return cache;
    } catch (_error) {
        return null;
    }
}

function writeWeatherCache(location, data) {
    const cache = {
        timestamp: Date.now(),
        locationKey: buildWeatherLocationKey(location),
        location,
        weatherData: data
    };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
}

function clearWeatherCache() {
    localStorage.removeItem(WEATHER_CACHE_KEY);
    localStorage.removeItem('weather_cache');
    localStorage.removeItem('weather_location');
    localStorage.removeItem('weather_cache_time');
}

async function geocodeCityLocation(cityName) {
    const trimmedCity = cityName.trim();
    if (!trimmedCity) return null;

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedCity)}&count=1&language=zh&format=json`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) return null;

        const data = await response.json();
        const result = data?.results?.[0];
        if (!result) return null;

        const lat = toFiniteNumber(result.latitude);
        const lon = toFiniteNumber(result.longitude);
        if (lat === null || lon === null) return null;

        return {
            lat,
            lon,
            city: result.name || trimmedCity,
            country: result.country || '',
            source: 'manual'
        };
    } catch (_error) {
        return null;
    }
}

async function saveManualWeatherLocation() {
    const cityInput = document.getElementById('weatherCityInput');
    if (!cityInput) return;

    const city = cityInput.value.trim();
    if (!city) {
        showToast('请输入城市名称');
        return;
    }

    const resolvedLocation = await geocodeCityLocation(city);
    if (!resolvedLocation) {
        showToast('未找到该城市，请检查城市名称');
        return;
    }

    setWeatherPreference({
        mode: 'manual',
        city,
        lat: resolvedLocation.lat,
        lon: resolvedLocation.lon
    });

    clearWeatherCache();
    await getWeather(true);
    updateWeatherLocationStatus();
    showToast(`天气定位已切换到 ${resolvedLocation.city}`);
}

async function useAutoWeatherLocation() {
    const cityInput = document.getElementById('weatherCityInput');
    if (cityInput) {
        cityInput.value = '';
    }

    setWeatherPreference({ mode: 'auto' });
    clearWeatherCache();
    await getWeather(true);
    updateWeatherLocationStatus();
    showToast('已切换为自动定位');
}

// 初始化天气
function initWeather() {
    const weatherCard = document.getElementById('weatherCard');
    if (weatherCard) {
        weatherCard.addEventListener('click', refreshWeather);
    }

    updateWeatherLocationStatus();
    getWeather();
}

// 获取天气
async function getWeather(forceRefresh = false) {
    updateWeatherLoading(true);

    try {
        const resolvedLocation = await resolveWeatherLocation();
        currentLocation = resolvedLocation;

        const cacheKey = buildWeatherLocationKey(resolvedLocation);
        if (!forceRefresh) {
            const cached = readWeatherCache(cacheKey);
            if (cached) {
                weatherData = cached.weatherData;
                currentLocation = cached.location;
                updateWeatherUI();
                return;
            }
        }

        await fetchWeatherData(resolvedLocation.lat, resolvedLocation.lon);
    } catch (error) {
        console.warn('天气定位失败:', error.message || error);
        updateWeatherError();
    }
}

async function resolveWeatherLocation() {
    const preference = getWeatherPreference();
    if (preference.mode === 'manual' && preference.city) {
        const manualLocation = await resolveManualWeatherLocation(preference);
        if (manualLocation) return manualLocation;
    }
    return resolveAutoWeatherLocation();
}

async function resolveManualWeatherLocation(preference) {
    const lat = toFiniteNumber(preference.lat);
    const lon = toFiniteNumber(preference.lon);
    if (lat !== null && lon !== null) {
        return {
            lat,
            lon,
            city: preference.city,
            source: 'manual'
        };
    }

    const geocodedLocation = await geocodeCityLocation(preference.city);
    if (!geocodedLocation) return null;

    setWeatherPreference({
        mode: 'manual',
        city: preference.city,
        lat: geocodedLocation.lat,
        lon: geocodedLocation.lon
    });
    return geocodedLocation;
}

async function resolveAutoWeatherLocation() {
    let gpsLocation = null;
    if (navigator.geolocation) {
        gpsLocation = await getGpsLocation();
        if (gpsLocation && gpsLocation.accuracy <= GPS_ACCURACY_THRESHOLD_METERS) {
            return gpsLocation;
        }
    }

    const ipLocation = await getLocationByIP();
    if (ipLocation) return ipLocation;

    if (gpsLocation) {
        return {
            lat: gpsLocation.lat,
            lon: gpsLocation.lon,
            city: gpsLocation.city || '',
            source: 'gps-low-accuracy'
        };
    }

    return DEFAULT_WEATHER_LOCATION;
}

function getGpsLocation() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = toFiniteNumber(position.coords.latitude);
                const lon = toFiniteNumber(position.coords.longitude);
                if (lat === null || lon === null) {
                    resolve(null);
                    return;
                }

                resolve({
                    lat,
                    lon,
                    city: '',
                    source: 'gps',
                    accuracy: toFiniteNumber(position.coords.accuracy) || Number.MAX_SAFE_INTEGER
                });
            },
            () => resolve(null),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    });
}

async function getLocationByIP() {
    const providers = [fetchLocationFromIpApiCo, fetchLocationFromIpWhoIs];
    for (const provider of providers) {
        const location = await provider();
        if (location) return location;
    }
    return null;
}

async function fetchLocationFromIpApiCo() {
    try {
        const response = await fetch('https://ipapi.co/json/', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const lat = toFiniteNumber(data.latitude);
        const lon = toFiniteNumber(data.longitude);
        if (lat === null || lon === null) return null;

        return {
            lat,
            lon,
            city: data.city || '',
            country: data.country_name || '',
            source: 'ip'
        };
    } catch (_error) {
        return null;
    }
}

async function fetchLocationFromIpWhoIs() {
    try {
        const response = await fetch('https://ipwho.is/', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.success === false) return null;

        const lat = toFiniteNumber(data.latitude);
        const lon = toFiniteNumber(data.longitude);
        if (lat === null || lon === null) return null;

        return {
            lat,
            lon,
            city: data.city || '',
            country: data.country || '',
            source: 'ip'
        };
    } catch (_error) {
        return null;
    }
}

// 获取天气数据
async function fetchWeatherData(lat, lon) {
    try {
        // 使用 Open-Meteo API（免费，无需 API key）
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('天气数据获取失败');

        const data = await response.json();
        weatherData = {
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
            time: data.current.time
        };

        writeWeatherCache(currentLocation, weatherData);
        updateWeatherUI();
    } catch (error) {
        console.error('获取天气失败:', error);
        updateWeatherError();
    }
}

// 更新天气 UI
function updateWeatherUI() {
    updateWeatherLoading(false);
    
    if (!weatherData) {
        updateWeatherError();
        return;
    }
    
    const tempEl = document.getElementById('weatherTemp');
    const descEl = document.getElementById('weatherDesc');
    const iconEl = document.getElementById('weatherIcon');
    
    if (tempEl) tempEl.textContent = `${weatherData.temperature}°`;
    
    // 获取天气描述和图标
    const weatherInfo = weatherCodeMap[weatherData.weatherCode] || weatherCodeMap[0];
    
    if (descEl) {
        const cityName = currentLocation?.city ? `${currentLocation.city} · ` : '';
        descEl.textContent = `${cityName}${weatherInfo.desc}`;
    }
    
    // 更新图标
    if (iconEl) {
        iconEl.innerHTML = `<i class="fas ${weatherInfo.icon}" style="color: ${weatherInfo.color}"></i>`;
    }

    updateWeatherLocationStatus();
}

// 更新加载状态
function updateWeatherLoading(loading) {
    const card = document.getElementById('weatherCard');
    const descEl = document.getElementById('weatherDesc');
    
    if (card) {
        if (loading) {
            card.classList.add('loading');
        } else {
            card.classList.remove('loading');
        }
    }
    
    if (descEl && loading) {
        descEl.textContent = '定位中...';
    }
}

// 更新错误状态
function updateWeatherError() {
    updateWeatherLoading(false);

    const tempEl = document.getElementById('weatherTemp');
    const descEl = document.getElementById('weatherDesc');
    const iconEl = document.getElementById('weatherIcon');

    if (tempEl) tempEl.textContent = '--°';
    if (descEl) descEl.textContent = '获取失败';
    if (iconEl) iconEl.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #ff6b6b"></i>';
    updateWeatherLocationStatus();
}

// 刷新天气
function refreshWeather() {
    clearWeatherCache();
    getWeather(true);
}

// ========================================
// 版本信息
// ========================================

function initVersion() {
    const versionEl = document.getElementById('versionText');
    if (versionEl) {
        // 从 package.json 获取版本号（Electron 环境）
        // 或者使用硬编码版本号
        let version = 'v1.1.0';
        
        // 尝试从 localStorage 获取版本（如果有保存）
        const storedVersion = localStorage.getItem('app_version');
        if (storedVersion) {
            version = storedVersion;
        }
        
        versionEl.textContent = version;
        
        // 点击版本号显示更多信息
        versionEl.addEventListener('click', showVersionInfo);
    }
}

// 显示版本信息
function showVersionInfo() {
    const versionInfo = {
        version: 'v1.1.0',
        buildDate: '2026-02-23',
        electron: window.isElectron ? '已启用' : '未启用',
        platform: navigator.platform,
        userAgent: navigator.userAgent
    };
    
    // 创建简单的版本信息弹窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'versionInfoModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeVersionModal()"></div>
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-info-circle"></i> 关于 FlowBoard</h3>
                <button class="close-btn" onclick="closeVersionModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="version-detail">
                    <p><strong>版本号:</strong> ${versionInfo.version}</p>
                    <p><strong>构建日期:</strong> ${versionInfo.buildDate}</p>
                    <p><strong>Electron:</strong> ${versionInfo.electron}</p>
                    <p><strong>平台:</strong> ${versionInfo.platform}</p>
                    <hr style="margin: 15px 0; border-color: var(--border-color);">
                    <p style="font-size: 12px; color: var(--text-muted);">
                        FlowBoard - 个人工作台<br>
                        一款跨平台的个人效率工具
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeVersionModal()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

// 关闭版本弹窗
function closeVersionModal() {
    const modal = document.getElementById('versionInfoModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

console.log('FlowBoard 已加载完成 🚀');
