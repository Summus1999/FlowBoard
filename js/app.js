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
        title: '比特币突破10万美元大关：创历史新高',
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
    }
];

// 待办事项数据
let todoData = [
    { id: 1, text: '更新项目文档', completed: false, tag: '紧急' },
    { id: 2, text: '修改账户密码', completed: true, tag: '一般' },
    { id: 3, text: '查看今日资讯', completed: false, tag: '日常' },
    { id: 4, text: '备份重要数据', completed: false, tag: '重要' }
];

let todoIdCounter = 5;

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
    
    // 延迟初始化 LeetCode，确保 DOM 完全加载
    setTimeout(() => {
        initLeetCode();
        initSubmissionsPage();
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
    
    newsList.innerHTML = newsData.slice(0, 6).map(item => `
        <div class="news-item-detailed">
            <div class="news-thumb">
                <i class="fas fa-newspaper"></i>
            </div>
            <div class="news-detail-content">
                <h4 class="news-detail-title">${item.title}</h4>
                <div class="news-detail-meta">
                    <span><i class="fas fa-source"></i> ${item.source}</span>
                    <span><i class="fas fa-clock"></i> ${item.time}</span>
                    <span><i class="fas fa-fire"></i> ${formatHot(item.hot)}</span>
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
    
    // 只显示前6条
    const displayData = filtered.slice(0, 6);
    
    if (displayData.length === 0) {
        newsList.innerHTML = `
            <div class="news-empty">
                <i class="fas fa-newspaper"></i>
                <p>暂无该分类的资讯</p>
            </div>
        `;
        return;
    }
    
    newsList.innerHTML = displayData.map(item => `
        <div class="news-item-detailed" onclick="openNewsUrl('${item.url}')">
            <div class="news-thumb">
                <i class="fas fa-newspaper"></i>
            </div>
            <div class="news-detail-content">
                <h4 class="news-detail-title">${item.title}</h4>
                <div class="news-detail-meta">
                    <span><i class="fas fa-source"></i> ${item.source}</span>
                    <span><i class="fas fa-clock"></i> ${item.time}</span>
                    <span><i class="fas fa-fire"></i> ${formatHot(item.hot)}</span>
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
}

// ========================================
// 模态框功能
// ========================================

function openAddPasswordModal() {
    modal.classList.add('active');
}

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
    renderTodoList();
    renderDashboardTodoList();
    updateTaskCount();
}

function renderTodoList() {
    const todoList = document.querySelector('.todo-list');
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
    tag.className = 'todo-tag' + (todo.tag === '紧急' ? ' urgent' : '');
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
        renderTodoList();
        updateTaskCount();
    }
}

function deleteTodo(id) {
    if (confirm('确定要删除这个待办事项吗？')) {
        todoData = todoData.filter(t => t.id !== id);
        renderTodoList();
        updateTaskCount();
        showToast('已删除');
    }
}

function showAddTodoModal() {
    const text = prompt('请输入待办事项：');
    if (text && text.trim()) {
        const tag = prompt('请输入标签（紧急/重要/一般/日常）：', '一般') || '一般';
        const newTodo = {
            id: todoIdCounter++,
            text: text.trim(),
            completed: false,
            tag: tag
        };
        todoData.push(newTodo);
        renderTodoList();
        renderDashboardTodoList();
        updateTaskCount();
        showToast('已添加');
    }
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
    
    todoList.innerHTML = todoData.map(todo => `
        <div class="todo-item">
            <input type="checkbox" class="todo-check" id="todo${todo.id}" ${todo.completed ? 'checked' : ''} onchange="toggleDashboardTodo(${todo.id})">
            <label for="todo${todo.id}" class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</label>
            <span class="todo-tag ${todo.tag === '紧急' ? 'urgent' : ''}">${todo.tag}</span>
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
        renderDashboardTodoList();
        updateTaskCount();
        renderTodoList(); // 同时更新其他页面的列表
    }
}

function deleteDashboardTodo(id) {
    if (confirm('确定要删除这个待办事项吗？')) {
        todoData = todoData.filter(t => t.id !== id);
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
