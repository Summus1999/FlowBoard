/**
 * FlowBoard - 个人工作台应用逻辑
 */

// ========================================
// 模拟数据
// ========================================

// 账户密码数据
const passwordData = [
    {
        id: 1,
        platform: 'GitHub',
        username: 'developer@example.com',
        password: '********',
        category: 'work',
        icon: 'fab fa-github',
        color: 'linear-gradient(135deg, #333, #24292e)',
        strength: 'strong'
    },
    {
        id: 2,
        platform: 'Twitter',
        username: '@user_handle',
        password: '********',
        category: 'social',
        icon: 'fab fa-twitter',
        color: 'linear-gradient(135deg, #1da1f2, #0d8bd9)',
        strength: 'strong'
    },
    {
        id: 3,
        platform: 'Google',
        username: 'user@gmail.com',
        password: '********',
        category: 'work',
        icon: 'fab fa-google',
        color: 'linear-gradient(135deg, #ea4335, #d33b28)',
        strength: 'strong'
    },
    {
        id: 4,
        platform: 'Discord',
        username: 'User#1234',
        password: '********',
        category: 'social',
        icon: 'fab fa-discord',
        color: 'linear-gradient(135deg, #7289da, #5b6eae)',
        strength: 'medium'
    },
    {
        id: 5,
        platform: 'Netflix',
        username: 'user@email.com',
        password: '********',
        category: 'entertainment',
        icon: 'fas fa-play',
        color: 'linear-gradient(135deg, #e50914, #b20710)',
        strength: 'medium'
    },
    {
        id: 6,
        platform: '支付宝',
        username: '138****8888',
        password: '********',
        category: 'finance',
        icon: 'fas fa-wallet',
        color: 'linear-gradient(135deg, #1677ff, #0958d9)',
        strength: 'strong'
    },
    {
        id: 7,
        platform: 'Spotify',
        username: 'music@example.com',
        password: '********',
        category: 'entertainment',
        icon: 'fab fa-spotify',
        color: 'linear-gradient(135deg, #1db954, #169c45)',
        strength: 'strong'
    },
    {
        id: 8,
        platform: 'Slack',
        username: 'work@company.com',
        password: '********',
        category: 'work',
        icon: 'fab fa-slack',
        color: 'linear-gradient(135deg, #4a154b, #611f69)',
        strength: 'strong'
    }
];

// 资讯数据
const newsData = [
    {
        id: 1,
        title: 'OpenAI发布GPT-5新功能：多模态能力大幅提升',
        source: '科技日报',
        time: '2小时前',
        category: 'tech',
        hot: 1250000
    },
    {
        id: 2,
        title: '苹果WWDC 2026时间确定：iOS 20将带来革命性更新',
        source: '36氪',
        time: '3小时前',
        category: 'tech',
        hot: 980000
    },
    {
        id: 3,
        title: 'SpaceX星舰第六次试飞成功：火星计划更进一步',
        source: '环球科学',
        time: '5小时前',
        category: 'tech',
        hot: 870000
    },
    {
        id: 4,
        title: '特斯拉新款Model 2谍照曝光：售价或低于15万',
        source: '汽车之家',
        time: '4小时前',
        category: 'tech',
        hot: 760000
    },
    {
        id: 5,
        title: '微软Copilot重大更新：集成更多Office功能',
        source: 'IT之家',
        time: '6小时前',
        category: 'tech',
        hot: 650000
    },
    {
        id: 6,
        title: '美联储宣布加息25个基点：全球股市震荡',
        source: '财经网',
        time: '1小时前',
        category: 'finance',
        hot: 1100000
    },
    {
        id: 7,
        title: '比特币突破10万美元大关：创历史新高',
        source: '区块链日报',
        time: '2小时前',
        category: 'finance',
        hot: 920000
    },
    {
        id: 8,
        title: '2026年春节档电影票房破纪录：总票房超80亿',
        source: '娱乐周刊',
        time: '8小时前',
        category: 'entertainment',
        hot: 780000
    }
];

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

function editPassword(id) {
    showToast('编辑功能开发中...');
}

function deletePassword(id) {
    if (confirm('确定要删除这个账户吗？')) {
        showToast('已删除');
    }
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
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // 这里可以添加切换资讯分类的逻辑
        });
    });
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

function closeAddPasswordModal() {
    modal.classList.remove('active');
}

function savePassword() {
    const platform = document.getElementById('platformName').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!platform || !username || !password) {
        showToast('请填写完整信息');
        return;
    }
    
    showToast('账户添加成功');
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

console.log('FlowBoard 已加载完成 🚀');
