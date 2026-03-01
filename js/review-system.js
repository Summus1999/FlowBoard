/**
 * FlowBoard - 学习进度复盘系统 (功能5)
 * 定期复盘、报告生成、趋势追踪
 */

const ReviewSystem = {
    async generateWeeklyReview() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);

        // 收集数据
        const tasks = await this.getTasksInRange(startDate, endDate);
        const studyTime = await this.getStudyTimeInRange(startDate, endDate);
        const plan = await flowboardDB.getKV('active_plan');

        const stats = {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status === 'done').length,
            totalHours: studyTime,
            completionRate: tasks.length > 0 ? (tasks.filter(t => t.status === 'done').length / tasks.length * 100).toFixed(1) : 0,
            dailyAverage: (studyTime / 7).toFixed(1)
        };

        // 生成报告
        const report = {
            id: flowboardDB.generateId('review_'),
            type: 'weekly',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            createdAt: Date.now(),
            stats,
            content: await this.generateAIReview(stats, plan)
        };

        await flowboardDB.put('reviews', report);
        return report;
    },

    async getTasksInRange(start, end) {
        const allTasks = await flowboardDB.getAll('tasks');
        return allTasks.filter(t => {
            const date = new Date(t.updatedAt || t.createdAt);
            return date >= start && date <= end;
        });
    },

    async getStudyTimeInRange(start, end) {
        const records = await flowboardDB.getByIndex('studyRecords', 'date');
        let total = 0;
        records.forEach(r => {
            const date = new Date(r.date);
            if (date >= start && date <= end) {
                total += r.minutes || 0;
            }
        });
        return (total / 60).toFixed(1);
    },

    async generateAIReview(stats, plan) {
        const prompt = `
基于以下学习数据生成复盘报告：

## 本周数据
- 完成任务: ${stats.completedTasks}/${stats.totalTasks} (${stats.completionRate}%)
- 学习时长: ${stats.totalHours} 小时
- 日均学习: ${stats.dailyAverage} 小时

## 计划信息
${plan ? `当前计划: ${plan.title}` : '无活跃计划'}

请生成包含以下内容的 Markdown 报告：
1. 本周概览（数据总结）
2. 完成情况分析
3. 存在的问题
4. 下周建议
5. 鼓励语

语气友好专业，使用中文。
`;

        try {
            const client = llmManager.getClient();
            const response = await client.chat([{ role: 'user', content: prompt }]);
            return response.content;
        } catch (error) {
            return this.generateFallbackReview(stats);
        }
    },

    generateFallbackReview(stats) {
        return `
## 本周学习复盘

### 概览
本周你完成了 **${stats.completedTasks}** 个任务，学习时长 **${stats.totalHours}** 小时。

### 完成情况
- 任务完成率: **${stats.completionRate}%**
- 日均学习: **${stats.dailyAverage}** 小时

### 分析
${stats.completionRate >= 80 ? '✅ 完成度很高，保持这个节奏！' : stats.completionRate >= 50 ? '⚠️ 完成度一般，可以尝试调整计划' : '💪 完成度较低，建议从更小的目标开始'}

### 下周建议
1. 继续保持学习节奏
2. 合理分配每日任务
3. 及时记录学习进度

继续加油！💪
`;
    },

    async getReviewHistory() {
        return await flowboardDB.getAll('reviews');
    },

    renderReviewCard(report) {
        const dateRange = `${new Date(report.startDate).toLocaleDateString()} - ${new Date(report.endDate).toLocaleDateString()}`;
        
        return `
            <div class="review-card" data-id="${report.id}">
                <div class="review-header">
                    <span class="review-type">${report.type === 'weekly' ? '周复盘' : '月复盘'}</span>
                    <span class="review-date">${dateRange}</span>
                </div>
                <div class="review-stats">
                    <div class="review-stat">
                        <span class="review-stat-value">${report.stats.completionRate}%</span>
                        <span class="review-stat-label">完成率</span>
                    </div>
                    <div class="review-stat">
                        <span class="review-stat-value">${report.stats.totalHours}h</span>
                        <span class="review-stat-label">学习时长</span>
                    </div>
                </div>
                <div class="review-preview">
                    ${report.content.slice(0, 100)}...
                </div>
                <div class="review-actions">
                    <button class="btn-text" onclick="ReviewSystem.viewDetail('${report.id}')">
                        查看详情
                    </button>
                    <button class="btn-text" onclick="ReviewSystem.exportReport('${report.id}')">
                        导出
                    </button>
                </div>
            </div>
        `;
    },

    async viewDetail(id) {
        const report = await flowboardDB.get('reviews', id);
        if (!report) return;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'reviewDetailModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('reviewDetailModal').remove()"></div>
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>复盘报告</h3>
                    <button class="close-btn" onclick="document.getElementById('reviewDetailModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="markdown-body review-content">
                        ${marked.parse(report.content)}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async exportReport(id) {
        const report = await flowboardDB.get('reviews', id);
        if (!report) return;

        const blob = new Blob([report.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `review-${new Date(report.createdAt).toLocaleDateString()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

const ReviewUI = {
    init() {
        this.renderReviewSection();
        this.scheduleWeeklyReminder();
    },

    async renderReviewSection() {
        const container = document.getElementById('reviewSection');
        if (!container) return;

        const reviews = await ReviewSystem.getReviewHistory();
        reviews.sort((a, b) => b.createdAt - a.createdAt);

        container.innerHTML = `
            <div class="review-header-actions">
                <h3>学习复盘</h3>
                <button class="btn-primary" onclick="ReviewUI.generateNewReview()">
                    <i class="fas fa-sync"></i> 生成复盘
                </button>
            </div>
            <div class="review-list">
                ${reviews.length > 0 
                    ? reviews.map(r => ReviewSystem.renderReviewCard(r)).join('')
                    : '<p class="empty-hint">暂无复盘记录</p>'
                }
            </div>
        `;
    },

    async generateNewReview() {
        showToast('正在生成复盘报告...');
        const report = await ReviewSystem.generateWeeklyReview();
        await this.renderReviewSection();
        ReviewSystem.viewDetail(report.id);
    },

    scheduleWeeklyReminder() {
        // 每周日晚 20:00 提醒
        const checkReminder = () => {
            const now = new Date();
            if (now.getDay() === 0 && now.getHours() === 20 && now.getMinutes() === 0) {
                NotificationManager.show({
                    title: '学习复盘提醒',
                    body: '本周即将结束，点击生成复盘报告',
                    onClick: () => {
                        showPage('growth');
                        setTimeout(() => this.generateNewReview(), 500);
                    }
                });
            }
        };
        
        setInterval(checkReminder, 60000); // 每分钟检查
    }
};

// 学习计时器功能
const StudyTimer = {
    startTime: null,
    isRunning: false,
    timerInterval: null,

    start() {
        this.startTime = Date.now();
        this.isRunning = true;
        
        this.timerInterval = setInterval(() => {
            this.updateDisplay();
        }, 1000);

        // 保存状态
        flowboardDB.setKV('study_timer_running', true);
        flowboardDB.setKV('study_timer_start', this.startTime);
    },

    stop() {
        if (!this.isRunning) return;
        
        clearInterval(this.timerInterval);
        const duration = Math.floor((Date.now() - this.startTime) / 1000 / 60); // 分钟
        
        // 保存记录
        this.saveRecord(duration);
        
        this.isRunning = false;
        this.startTime = null;
        
        flowboardDB.setKV('study_timer_running', false);
        flowboardDB.setKV('study_timer_start', null);
        
        return duration;
    },

    async saveRecord(minutes) {
        const today = new Date().toISOString().split('T')[0];
        const record = {
            id: flowboardDB.generateId('study_'),
            date: today,
            minutes,
            createdAt: Date.now()
        };
        await flowboardDB.put('studyRecords', record);
    },

    updateDisplay() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        
        const display = document.getElementById('studyTimerDisplay');
        if (display) {
            display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    },

    async restoreState() {
        const wasRunning = await flowboardDB.getKV('study_timer_running');
        const startTime = await flowboardDB.getKV('study_timer_start');
        
        if (wasRunning && startTime) {
            this.startTime = startTime;
            this.isRunning = true;
            this.timerInterval = setInterval(() => this.updateDisplay(), 1000);
        }
    }
};

// 导出
window.ReviewSystem = ReviewSystem;
window.ReviewUI = ReviewUI;
window.StudyTimer = StudyTimer;
