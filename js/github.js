/**
 * FlowBoard - GitHub 项目跟踪模块
 * 追踪 GitHub 账户下最近更新的项目
 */

// ========================================
// 全局状态
// ========================================

let githubState = {
    username: localStorage.getItem('github_username') || '',
    token: localStorage.getItem('github_token') || '',
    repos: [],
    isLoading: false,
    isLoggedIn: false
};

// 检查登录状态
function checkGithubLoginStatus() {
    const savedUsername = localStorage.getItem('github_username');
    const savedToken = localStorage.getItem('github_token');
    
    githubState.isLoggedIn = !!(savedUsername);
    githubState.username = savedUsername || '';
    githubState.token = savedToken || '';
    
    updateGithubLoginUI();
}

// 编程语言颜色映射
const languageColors = {
    'JavaScript': '#f1e05a',
    'TypeScript': '#2b7489',
    'Python': '#3572A5',
    'Java': '#b07219',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'C++': '#f34b7d',
    'C': '#555555',
    'C#': '#178600',
    'PHP': '#4F5D95',
    'Ruby': '#701516',
    'Swift': '#ffac45',
    'Kotlin': '#A97BFF',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Shell': '#89e051',
    'Vue': '#41b883',
    'React': '#61dafb'
};

// ========================================
// 初始化
// ========================================

function initGithub() {
    checkGithubLoginStatus();
    
    // 加载保存的用户名
    const savedUsername = localStorage.getItem('github_username');
    if (savedUsername) {
        const usernameInput = document.getElementById('githubUsername');
        if (usernameInput) usernameInput.value = savedUsername;
        // 自动加载最近更新的2个仓库
        loadGithubRepos();
    }
}

// ========================================
// 登录/登出功能
// ========================================

function toggleGithubLogin() {
    if (githubState.isLoggedIn) {
        // 登出
        logoutGithub();
    } else {
        // 显示登录模态框
        showGithubLoginModal();
    }
}

function showGithubLoginModal() {
    const modal = document.createElement('div');
    modal.className = 'modal github-login-modal active';
    modal.id = 'githubLoginModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeGithubLoginModal()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fab fa-github"></i> 登录 GitHub</h3>
                <button class="close-btn" onclick="closeGithubLoginModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>GitHub 用户名</label>
                    <div class="input-with-icon">
                        <i class="fas fa-user"></i>
                        <input type="text" placeholder="输入你的 GitHub 用户名" id="githubLoginUsername">
                    </div>
                </div>
                <div class="form-group">
                    <label>Personal Access Token (可选)</label>
                    <div class="input-with-icon">
                        <i class="fas fa-key"></i>
                        <input type="password" placeholder="用于访问私有仓库" id="githubLoginToken">
                    </div>
                    <small style="color: var(--text-muted); font-size: 11px;">
                        <i class="fas fa-info-circle"></i> 
                        Token 只需 public_repo 权限即可访问公开仓库
                    </small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeGithubLoginModal()">取消</button>
                <button class="btn-primary" onclick="loginGithub()">
                    <i class="fas fa-sign-in-alt"></i> 登录
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeGithubLoginModal() {
    const modal = document.getElementById('githubLoginModal');
    if (modal) modal.remove();
}

async function loginGithub() {
    const username = document.getElementById('githubLoginUsername')?.value.trim();
    const token = document.getElementById('githubLoginToken')?.value.trim();
    
    if (!username) {
        showToast('请输入 GitHub 用户名');
        return;
    }
    
    // 保存登录信息
    localStorage.setItem('github_username', username);
    if (token) {
        localStorage.setItem('github_token', token);
    }
    
    githubState.username = username;
    githubState.token = token;
    githubState.isLoggedIn = true;
    
    // 更新UI
    const usernameInput = document.getElementById('githubUsername');
    if (usernameInput) usernameInput.value = username;
    
    updateGithubLoginUI();
    closeGithubLoginModal();
    
    showToast('GitHub 登录成功');
    
    // 自动加载最近更新的2个仓库
    await loadGithubRepos();
}

function logoutGithub() {
    if (confirm('确定要退出 GitHub 登录吗？')) {
        localStorage.removeItem('github_username');
        localStorage.removeItem('github_token');
        
        githubState.username = '';
        githubState.token = '';
        githubState.isLoggedIn = false;
        githubState.repos = [];
        
        const usernameInput = document.getElementById('githubUsername');
        if (usernameInput) usernameInput.value = '';
        
        updateGithubLoginUI();
        renderGithubRepos([]);
        
        // 重置统计
        document.getElementById('githubRepoCount').textContent = '-';
        document.getElementById('githubFollowers').textContent = '-';
        document.getElementById('githubStars').textContent = '-';
        
        showToast('已退出 GitHub 登录');
    }
}

function updateGithubLoginUI() {
    const loginBtn = document.getElementById('githubLoginBtn');
    const loginStatus = document.getElementById('githubLoginStatus');
    
    if (loginBtn) {
        if (githubState.isLoggedIn) {
            loginBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> 退出';
            loginBtn.onclick = logoutGithub;
        } else {
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
            loginBtn.onclick = showGithubLoginModal;
        }
    }
    
    if (loginStatus) {
        if (githubState.isLoggedIn) {
            loginStatus.innerHTML = `<i class="fas fa-check-circle"></i> <span>已登录: ${githubState.username}</span>`;
            loginStatus.className = 'github-login-status logged-in';
        } else {
            loginStatus.innerHTML = '<i class="fas fa-circle"></i> <span>未登录</span>';
            loginStatus.className = 'github-login-status';
        }
    }
}

// ========================================
// 数据加载
// ========================================

async function loadGithubRepos() {
    const username = document.getElementById('githubUsername').value.trim();
    if (!username) {
        showToast('请输入 GitHub 用户名');
        return;
    }
    
    githubState.username = username;
    localStorage.setItem('github_username', username);
    githubState.isLoading = true;
    
    renderLoading();
    
    try {
        // 获取用户信息
        const userResponse = await fetch(`https://api.github.com/users/${username}`);
        if (!userResponse.ok) {
            if (userResponse.status === 404) {
                renderError('用户不存在');
                return;
            }
            throw new Error('获取用户信息失败');
        }
        const userData = await userResponse.json();
        
        // 获取用户仓库（按更新时间排序，取前2个）
        const reposResponse = await fetch(
            `https://api.github.com/users/${username}/repos?sort=updated&direction=desc&per_page=2`
        );
        if (!reposResponse.ok) {
            throw new Error('获取仓库信息失败');
        }
        const reposData = await reposResponse.json();
        
        // 获取每个仓库的最后提交时间
        const reposWithCommits = await Promise.all(
            reposData.map(async (repo) => {
                try {
                    const commitsResponse = await fetch(
                        `https://api.github.com/repos/${username}/${repo.name}/commits?per_page=1`
                    );
                    if (commitsResponse.ok) {
                        const commits = await commitsResponse.json();
                        if (commits.length > 0) {
                            repo.last_commit = commits[0].commit.committer.date;
                            repo.last_commit_message = commits[0].commit.message;
                        }
                    }
                } catch (e) {
                    console.error('获取提交信息失败:', e);
                }
                return repo;
            })
        );
        
        // 获取用户所有仓库的总星标数
        const totalStars = await fetchTotalStars(username, userData.public_repos);
        
        githubState.repos = reposWithCommits;
        githubState.isLoading = false;
        
        // 更新统计信息（使用真实的总星标数）
        updateGithubStats(userData, totalStars);
        
        // 渲染仓库列表
        renderGithubRepos(reposWithCommits);
        
        showToast('加载成功');
        
    } catch (error) {
        console.error('GitHub API 错误:', error);
        githubState.isLoading = false;
        renderError('获取数据失败，请检查网络或用户名');
    }
}

// 获取用户所有仓库的总星标数
async function fetchTotalStars(username, totalRepos) {
    try {
        // GitHub API 每页最多100个仓库，需要分页获取
        const perPage = 100;
        const pages = Math.ceil(totalRepos / perPage);
        let totalStars = 0;
        
        for (let page = 1; page <= pages; page++) {
            const response = await fetch(
                `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}`
            );
            if (response.ok) {
                const repos = await response.json();
                totalStars += repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
            }
        }
        
        return totalStars;
    } catch (error) {
        console.error('获取总星标数失败:', error);
        return 0;
    }
}

// ========================================
// 渲染
// ========================================

function renderLoading() {
    const container = document.getElementById('githubRepos');
    container.innerHTML = `
        <div class="github-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>正在加载 GitHub 数据...</p>
        </div>
    `;
}

function renderError(message) {
    const container = document.getElementById('githubRepos');
    container.innerHTML = `
        <div class="github-error">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
    
    // 重置统计
    document.getElementById('githubRepoCount').textContent = '-';
    document.getElementById('githubFollowers').textContent = '-';
    document.getElementById('githubStars').textContent = '-';
}

function updateGithubStats(userData, totalStars) {
    document.getElementById('githubRepoCount').textContent = userData.public_repos;
    document.getElementById('githubFollowers').textContent = userData.followers;
    document.getElementById('githubStars').textContent = totalStars;
}

function renderGithubRepos(repos) {
    const container = document.getElementById('githubRepos');
    
    if (repos.length === 0) {
        container.innerHTML = `
            <div class="github-empty">
                <i class="fab fa-github"></i>
                <p>该用户暂无公开仓库</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="github-repo-list">
            ${repos.map(repo => createRepoCard(repo)).join('')}
        </div>
    `;
}

function createRepoCard(repo) {
    const language = repo.language || 'Unknown';
    const languageColor = languageColors[language] || '#8b949e';
    const lastCommit = repo.last_commit ? formatTimeAgo(repo.last_commit) : '暂无提交';
    const description = repo.description || '暂无描述';
    
    return `
        <div class="github-repo-card" onclick="openRepo('${repo.html_url}')" style="cursor: pointer;">
            <div class="github-repo-header">
                <div class="github-repo-name">
                    <i class="fas fa-book"></i>
                    ${escapeHtml(repo.name)}
                </div>
                <span class="github-repo-visibility">${repo.private ? 'Private' : 'Public'}</span>
            </div>
            <div class="github-repo-description">
                ${escapeHtml(description)}
            </div>
            <div class="github-repo-meta">
                <div class="github-repo-language">
                    <span class="language-color" style="background: ${languageColor}"></span>
                    ${language}
                </div>
                <div class="github-repo-stat">
                    <i class="far fa-star"></i>
                    ${repo.stargazers_count}
                </div>
                <div class="github-repo-stat">
                    <i class="fas fa-code-branch"></i>
                    ${repo.forks_count}
                </div>
                <div class="github-repo-update">
                    <i class="far fa-clock"></i>
                    最后提交: ${lastCommit}
                </div>
            </div>
            ${repo.last_commit_message ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <span style="font-size: 12px; color: var(--text-muted);">
                    <i class="fas fa-comment" style="margin-right: 6px;"></i>
                    ${escapeHtml(repo.last_commit_message.substring(0, 50))}${repo.last_commit_message.length > 50 ? '...' : ''}
                </span>
            </div>
            ` : ''}
        </div>
    `;
}

// ========================================
// 工具函数
// ========================================

function openRepo(url) {
    if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
    } else {
        window.open(url, '_blank');
    }
}

function openGithubOfficial() {
    const url = 'https://github.com';
    if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
    } else {
        window.open(url, '_blank');
    }
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // 小于1小时
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return minutes < 1 ? '刚刚' : `${minutes}分钟前`;
    }
    
    // 小于24小时
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}小时前`;
    }
    
    // 小于7天
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}天前`;
    }
    
    // 显示日期
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// 页面切换初始化
// ========================================

const originalShowPage3 = window.showPage;
if (originalShowPage3) {
    window.showPage = function(pageName) {
        originalShowPage3(pageName);
        if (pageName === 'github') {
            setTimeout(initGithub, 100);
        }
    };
}

console.log('GitHub 项目跟踪模块已加载 🐙');
