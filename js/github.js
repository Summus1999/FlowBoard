/**
 * FlowBoard - GitHub 项目跟踪模块
 * 追踪 GitHub 账户下最近更新的项目
 */

// ========================================
// 全局状态
// ========================================

let githubState = {
    username: localStorage.getItem('github_username') || '',
    repos: [],
    isLoading: false
};

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
    // 加载保存的用户名
    const savedUsername = localStorage.getItem('github_username');
    if (savedUsername) {
        document.getElementById('githubUsername').value = savedUsername;
        loadGithubRepos();
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
        
        githubState.repos = reposWithCommits;
        githubState.isLoading = false;
        
        // 更新统计信息
        updateGithubStats(userData, reposWithCommits);
        
        // 渲染仓库列表
        renderGithubRepos(reposWithCommits);
        
        showToast('加载成功');
        
    } catch (error) {
        console.error('GitHub API 错误:', error);
        githubState.isLoading = false;
        renderError('获取数据失败，请检查网络或用户名');
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

function updateGithubStats(userData, repos) {
    // 计算总星数
    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    
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
