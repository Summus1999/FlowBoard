/**
 * 提交记录页面逻辑
 */

let currentSubmissions = [];
let currentFilters = {
    search: '',
    language: '',
    status: '',
    sortBy: 'timestamp',
    sortOrder: 'desc'
};

// ========================================
// 初始化
// ========================================

function initSubmissionsPage() {
    // 初始化语言筛选器
    initLanguageFilter();
    
    // 绑定事件
    initSubmissionEventListeners();
    
    // 加载提交记录
    loadSubmissions();
    
    // 更新统计
    updateSubmissionStats();
}

function initLanguageFilter() {
    const select = document.getElementById('submissionLanguageFilter');
    if (!select) return;

    const languages = LanguageConfig.getAllLanguages();
    select.innerHTML = '<option value="">所有语言</option>' +
        languages.map(lang => `<option value="${lang.id}">${lang.name}</option>`).join('');
}

function initSubmissionEventListeners() {
    // 搜索
    const searchInput = document.getElementById('submissionSearch');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentFilters.search = e.target.value;
                loadSubmissions();
            }, 300);
        });
    }

    // 语言筛选
    const languageFilter = document.getElementById('submissionLanguageFilter');
    if (languageFilter) {
        languageFilter.addEventListener('change', (e) => {
            currentFilters.language = e.target.value;
            loadSubmissions();
        });
    }

    // 状态筛选
    const statusFilter = document.getElementById('submissionStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentFilters.status = e.target.value;
            loadSubmissions();
        });
    }

    // 排序
    const sortBy = document.getElementById('submissionSortBy');
    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            currentFilters.sortBy = e.target.value;
            loadSubmissions();
        });
    }
}

// ========================================
// 加载和渲染
// ========================================

function loadSubmissions() {
    currentSubmissions = submissionHistory.getAllSubmissions(currentFilters);
    renderSubmissionsList();
    
    // 显示数据来源提示
    const container = document.getElementById('submissionsList');
    if (container && currentSubmissions.length === 0) {
        // 检查是否有 LeetCode 登录
        if (typeof leetCodeState !== 'undefined' && leetCodeState.isLoggedIn) {
            // 已登录但没有记录，可以从 LeetCode 获取
            container.innerHTML = `
                <div class="submissions-empty">
                    <i class="fas fa-cloud-download-alt"></i>
                    <h3>暂无本地提交记录</h3>
                    <p>检测到您已登录 LeetCode</p>
                    <button class="btn-primary" onclick="fetchLeetCodeSubmissions()" style="margin-top: 12px;">
                        <i class="fas fa-sync"></i> 从 LeetCode 同步
                    </button>
                </div>
            `;
        }
    }
}

async function fetchLeetCodeSubmissions() {
    showToast('正在从 LeetCode 同步提交记录...');
    
    try {
        // 获取最近提交
        const submissions = await leetCodeAPI.getUserSubmissions('', 50);
        
        if (submissions && submissions.length > 0) {
            // 添加到本地历史
            submissions.forEach(sub => {
                submissionHistory.addSubmission({
                    problemId: null, // 需要从 titleSlug 映射
                    problemTitle: sub.title,
                    problemTitleSlug: sub.titleSlug,
                    language: sub.language,
                    code: '// 代码需要从 LeetCode 获取详细提交信息', // 可能需要额外请求
                    status: sub.status,
                    timestamp: sub.timestamp.toISOString(),
                    runtime: null,
                    memory: null
                });
            });
            
            loadSubmissions();
            updateSubmissionStats();
            showToast(`成功同步 ${submissions.length} 条记录`);
        } else {
            showToast('未找到 LeetCode 提交记录');
        }
    } catch (error) {
        console.error('同步失败:', error);
        showToast('同步失败: ' + error.message);
    }
}

function renderSubmissionsList() {
    const container = document.getElementById('submissionsList');
    if (!container) return;

    if (currentSubmissions.length === 0) {
        container.innerHTML = `
            <div class="submissions-empty">
                <i class="fas fa-clipboard-list"></i>
                <h3>暂无提交记录</h3>
                <p>在 LeetCode 页面刷题后，提交记录会显示在这里</p>
            </div>
        `;
        return;
    }

    container.innerHTML = currentSubmissions.map(sub => {
        const date = new Date(sub.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString();
        const statusInfo = getStatusInfo(sub.status);
        
        return `
            <div class="submission-item" onclick="showSubmissionDetail('${sub.id}')">
                <div class="submission-status ${sub.status}">
                    <i class="fas ${statusInfo.icon}"></i>
                </div>
                <div class="submission-info">
                    <div class="submission-title">${sub.problemTitle}</div>
                    <div class="submission-meta">
                        <span><i class="fas fa-calendar"></i> ${dateStr} ${timeStr}</span>
                        <span><i class="fas fa-code"></i> ${LanguageConfig.getLanguage(sub.language).name}</span>
                    </div>
                </div>
                <div class="submission-stats">
                    ${sub.runtime ? `<span><i class="fas fa-clock"></i> ${sub.runtime} ms</span>` : ''}
                    ${sub.memory ? `<span><i class="fas fa-memory"></i> ${sub.memory} MB</span>` : ''}
                </div>
                <div class="submission-actions-btn" onclick="event.stopPropagation()">
                    <button class="btn-icon ${sub.isFavorite ? 'active' : ''}" 
                            onclick="toggleSubmissionFavorite('${sub.id}')"
                            title="${sub.isFavorite ? '取消收藏' : '收藏'}">
                        <i class="${sub.isFavorite ? 'fas' : 'far'} fa-star"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteSubmission('${sub.id}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getStatusInfo(status) {
    const statusMap = {
        'accepted': { icon: 'fa-check-circle', text: '通过', color: '#22c55e' },
        'wrong_answer': { icon: 'fa-times-circle', text: '解答错误', color: '#ef4444' },
        'time_limit_exceeded': { icon: 'fa-clock', text: '超时', color: '#f59e0b' },
        'memory_limit_exceeded': { icon: 'fa-memory', text: '内存超限', color: '#f59e0b' },
        'runtime_error': { icon: 'fa-bug', text: '运行错误', color: '#6b7280' },
        'compile_error': { icon: 'fa-exclamation-triangle', text: '编译错误', color: '#6b7280' },
        'pending': { icon: 'fa-spinner fa-spin', text: '等待中', color: '#3b82f6' }
    };
    return statusMap[status] || { icon: 'fa-question-circle', text: '未知', color: '#9ca3af' };
}

// ========================================
// 操作
// ========================================

function toggleSubmissionFavorite(id) {
    const isFavorite = submissionHistory.toggleFavorite(id);
    loadSubmissions();
    showToast(isFavorite ? '已收藏' : '已取消收藏');
}

function deleteSubmission(id) {
    if (confirm('确定要删除这条提交记录吗？')) {
        if (submissionHistory.deleteSubmission(id)) {
            loadSubmissions();
            updateSubmissionStats();
            showToast('已删除');
        }
    }
}

function showSubmissionDetail(id) {
    const sub = submissionHistory.getSubmission(id);
    if (!sub) return;

    const statusInfo = getStatusInfo(sub.status);
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal submission-detail-modal active';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <div class="submission-detail-status ${sub.status}">
                    <i class="fas ${statusInfo.icon}"></i>
                    <h3>${statusInfo.text}</h3>
                </div>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>题目</label>
                    <div class="input-with-icon">
                        <i class="fas fa-book"></i>
                        <input type="text" value="${sub.problemTitle}" readonly>
                    </div>
                </div>
                <div class="form-group">
                    <label>提交时间</label>
                    <div class="input-with-icon">
                        <i class="fas fa-calendar"></i>
                        <input type="text" value="${new Date(sub.timestamp).toLocaleString()}" readonly>
                    </div>
                </div>
                <div class="form-group">
                    <label>语言</label>
                    <div class="input-with-icon">
                        <i class="fas fa-code"></i>
                        <input type="text" value="${LanguageConfig.getLanguage(sub.language).name}" readonly>
                    </div>
                </div>
                ${sub.runtime ? `
                <div class="form-group">
                    <label>执行用时</label>
                    <div class="input-with-icon">
                        <i class="fas fa-clock"></i>
                        <input type="text" value="${sub.runtime} ms" readonly>
                    </div>
                </div>` : ''}
                ${sub.memory ? `
                <div class="form-group">
                    <label>内存消耗</label>
                    <div class="input-with-icon">
                        <i class="fas fa-memory"></i>
                        <input type="text" value="${sub.memory} MB" readonly>
                    </div>
                </div>` : ''}
                <div class="form-group">
                    <label>代码</label>
                    <div class="submission-code-preview">
                        <pre><code>${escapeHtml(sub.code)}</code></pre>
                    </div>
                </div>
                <div class="submission-notes">
                    <h4>笔记</h4>
                    <textarea placeholder="添加笔记..." id="submissionNote">${sub.notes || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                <button class="btn-primary" onclick="saveSubmissionNote('${sub.id}')">
                    <i class="fas fa-save"></i> 保存笔记
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveSubmissionNote(id) {
    const note = document.getElementById('submissionNote')?.value || '';
    submissionHistory.addNotes(id, note);
    showToast('笔记已保存');
    document.querySelector('.submission-detail-modal')?.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// 统计
// ========================================

function updateSubmissionStats() {
    const stats = submissionHistory.getStats();
    const streak = submissionHistory.getStreakDays();
    
    document.getElementById('statAccepted').textContent = stats.accepted || 0;
    document.getElementById('statWrong').textContent = 
        (stats.wrongAnswer || 0) + 
        (stats.timeLimitExceeded || 0) + 
        (stats.runtimeError || 0) + 
        (stats.compileError || 0);
    document.getElementById('statFavorites').textContent = stats.favorites || 0;
    document.getElementById('statStreak').textContent = streak || 0;
}

function showSubmissionStats() {
    const stats = submissionHistory.getStats();
    
    const modal = document.createElement('div');
    modal.className = 'modal stats-modal active';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-chart-bar"></i> 提交统计</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="stats-grid">
                    <div class="stats-item">
                        <h4>总提交数</h4>
                        <div class="value">${stats.total || 0}</div>
                    </div>
                    <div class="stats-item">
                        <h4>通过率</h4>
                        <div class="value">${stats.total ? Math.round((stats.accepted / stats.total) * 100) : 0}%</div>
                    </div>
                </div>
                <div class="stats-charts">
                    <div class="stats-chart-item">
                        <h4>状态分布</h4>
                        <div class="chart-bar">
                            <div class="chart-bar-fill" style="width: ${stats.total ? (stats.accepted / stats.total * 100) : 0}%; background: #22c55e;"></div>
                        </div>
                        <small>通过: ${stats.accepted || 0}</small>
                    </div>
                    <div class="stats-chart-item">
                        <h4>语言分布</h4>
                        ${Object.entries(stats.byLanguage || {}).map(([lang, count]) => `
                            <div style="margin-bottom: 8px;">
                                <span>${LanguageConfig.getLanguage(lang).name}: ${count}</span>
                                <div class="chart-bar">
                                    <div class="chart-bar-fill" style="width: ${(count / stats.total * 100)}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ========================================
// 导出
// ========================================

function exportSubmissions() {
    const json = submissionHistory.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `leetcode-submissions-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('导出成功');
}

// 在页面切换时重新加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('page-submissions')) {
            initSubmissionsPage();
        }
    });
}

console.log('提交记录页面模块已加载');
