/**
 * FlowBoard - 数据可视化仪表盘 V2 (功能14)
 * 主页升级为可拖拽的卡片式仪表盘
 */

const DashboardV2 = {
    cards: [],
    defaultLayout: [
        { type: 'stats', title: '概览统计', w: 3, h: 1 },
        { type: 'todo', title: '待办事项', w: 1, h: 2 },
        { type: 'habit', title: '习惯追踪', w: 1, h: 2 },
        { type: 'pomodoro', title: '番茄钟', w: 1, h: 2 },
        { type: 'leetcode', title: '刷题进度', w: 2, h: 1 },
        { type: 'plan', title: '学习计划', w: 2, h: 1 }
    ],

    async init() {
        await this.loadLayout();
        this.render();
        this.startAutoUpdate();
    },

    async loadLayout() {
        const saved = await flowboardDB.getKV('dashboard_layout');
        this.cards = saved || this.defaultLayout;
    },

    async saveLayout() {
        await flowboardDB.setKV('dashboard_layout', this.cards);
    },

    render() {
        const container = document.getElementById('page-dashboard');
        if (!container) return;

        // 保留标题栏，替换内容区域
        const content = container.querySelector('.content-grid') || container;
        content.className = 'dashboard-grid';
        content.innerHTML = this.cards.map((card, index) => `
            <div class="dashboard-card ${card.type}" data-index="${index}" style="grid-column: span ${card.w}; grid-row: span ${card.h}">
                <div class="dashboard-card-header">
                    <h4>${card.title}</h4>
                    <div class="card-actions">
                        <button onclick="DashboardV2.refreshCard('${card.type}')">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button onclick="DashboardV2.removeCard(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="dashboard-card-body" id="card-${card.type}">
                    ${this.getCardContent(card.type)}
                </div>
            </div>
        `).join('');

        // 加载各卡片数据
        this.loadCardData();
    },

    getCardContent(type) {
        const loaders = {
            stats: '<div class="stats-grid" id="dash-stats">加载中...</div>',
            todo: '<div class="dash-todo-list" id="dash-todo">加载中...</div>',
            habit: '<div class="dash-habit-preview" id="dash-habit">加载中...</div>',
            pomodoro: '<div class="dash-pomodoro" id="dash-pomodoro">加载中...</div>',
            leetcode: '<div class="dash-leetcode" id="dash-leetcode">加载中...</div>',
            plan: '<div class="dash-plan" id="dash-plan">加载中...</div>',
            news: '<div class="dash-news" id="dash-news">加载中...</div>'
        };
        return loaders[type] || '<div>未知卡片</div>';
    },

    async loadCardData() {
        // 统计数据
        this.loadStatsCard();
        // 待办
        this.loadTodoCard();
        // 习惯
        this.loadHabitCard();
        // 番茄钟
        this.loadPomodoroCard();
        // LeetCode
        this.loadLeetCodeCard();
        // 学习计划
        this.loadPlanCard();
    },

    async loadStatsCard() {
        const container = document.getElementById('dash-stats');
        if (!container) return;

        const [tasks, habits, pomos] = await Promise.all([
            flowboardDB.getAll('tasks'),
            flowboardDB.getAll('habits'),
            flowboardDB.getAll('pomodoroRecords')
        ]);

        const today = new Date().toISOString().split('T')[0];
        const todayPomos = pomos.filter(p => new Date(p.startTime).toISOString().startsWith(today));

        container.innerHTML = `
            <div class="stat-box">
                <span class="stat-value">${tasks.filter(t => t.status !== 'done').length}</span>
                <span class="stat-label">待办任务</span>
            </div>
            <div class="stat-box">
                <span class="stat-value">${habits.length}</span>
                <span class="stat-label">追踪习惯</span>
            </div>
            <div class="stat-box">
                <span class="stat-value">${todayPomos.length}</span>
                <span class="stat-label">今日番茄</span>
            </div>
            <div class="stat-box">
                <span class="stat-value">${Math.floor(todayPomos.reduce((s, p) => s + p.duration, 0) / 60)}h</span>
                <span class="stat-label">专注时长</span>
            </div>
        `;
    },

    async loadTodoCard() {
        const container = document.getElementById('dash-todo');
        if (!container) return;

        const tasks = await flowboardDB.getAll('tasks');
        const todo = tasks.filter(t => t.status !== 'done').slice(0, 5);

        container.innerHTML = todo.length > 0 ? todo.map(t => `
            <div class="dash-todo-item">
                <input type="checkbox" onchange="DashboardV2.completeTask('${t.id}')">
                <span>${this.escapeHtml(t.title)}</span>
            </div>
        `).join('') : '<p class="empty-hint">暂无待办</p>';
    },

    async loadHabitCard() {
        const container = document.getElementById('dash-habit');
        if (!container) return;

        const habits = await flowboardDB.getAll('habits');
        const today = new Date().toISOString().split('T')[0];

        container.innerHTML = habits.slice(0, 3).map(h => {
            const isDone = HabitTracker.isCheckedOnDate?.(h.id, today) || false;
            return `
                <div class="dash-habit-item ${isDone ? 'done' : ''}">
                    <i class="fas ${h.icon}" style="color: ${h.color}"></i>
                    <span>${this.escapeHtml(h.name)}</span>
                    ${isDone ? '<i class="fas fa-check"></i>' : ''}
                </div>
            `;
        }).join('') || '<p class="empty-hint">暂无习惯</p>';
    },

    async loadPomodoroCard() {
        const container = document.getElementById('dash-pomodoro');
        if (!container) return;

        const stats = await PomodoroTimer.getStats('today');
        
        container.innerHTML = `
            <div class="pomodoro-stats-card">
                <div class="pomo-big-number">${stats.count}</div>
                <div class="pomo-label">今日完成番茄</div>
                <div class="pomo-goal">目标: 8</div>
                <div class="pomo-progress">
                    <div class="pomo-bar" style="width: ${Math.min(stats.count / 8 * 100, 100)}%"></div>
                </div>
            </div>
            <button class="btn-primary" onclick="PomodoroTimer.togglePanel()">
                <i class="fas fa-play"></i> 开始专注
            </button>
        `;
    },

    async loadLeetCodeCard() {
        const container = document.getElementById('dash-leetcode');
        if (!container) return;

        const submissions = JSON.parse(localStorage.getItem('leetcode_submissions') || '[]');
        const stats = { easy: 0, medium: 0, hard: 0 };
        
        // 简化的难度统计（实际需要更复杂逻辑）
        container.innerHTML = `
            <div class="leetcode-stats">
                <div class="lc-stat easy">
                    <span class="lc-count">${stats.easy}</span>
                    <span class="lc-label">简单</span>
                </div>
                <div class="lc-stat medium">
                    <span class="lc-count">${stats.medium}</span>
                    <span class="lc-label">中等</span>
                </div>
                <div class="lc-stat hard">
                    <span class="lc-count">${stats.hard}</span>
                    <span class="lc-label">困难</span>
                </div>
            </div>
            <div class="leetcode-total">
                总共解决: <strong>${submissions.length}</strong> 题
            </div>
        `;
    },

    async loadPlanCard() {
        const container = document.getElementById('dash-plan');
        if (!container) return;

        const plans = await flowboardDB.getAll('learningPlans');
        const active = plans.find(p => p.status === 'active');

        if (!active) {
            container.innerHTML = '<p class="empty-hint">暂无进行中的计划</p>';
            return;
        }

        container.innerHTML = `
            <div class="plan-progress-card">
                <h5>${this.escapeHtml(active.title)}</h5>
                <div class="plan-progress-bar">
                    <div class="plan-progress-fill" style="width: ${active.progress || 0}%"></div>
                </div>
                <div class="plan-progress-text">${active.progress || 0}% 完成</div>
            </div>
        `;
    },

    async completeTask(taskId) {
        const task = await flowboardDB.get('tasks', taskId);
        if (task) {
            task.status = 'done';
            await flowboardDB.put('tasks', task);
            this.loadTodoCard();
            this.loadStatsCard();
        }
    },

    refreshCard(type) {
        const loaders = {
            stats: () => this.loadStatsCard(),
            todo: () => this.loadTodoCard(),
            habit: () => this.loadHabitCard(),
            pomodoro: () => this.loadPomodoroCard(),
            leetcode: () => this.loadLeetCodeCard(),
            plan: () => this.loadPlanCard()
        };
        loaders[type]?.();
    },

    removeCard(index) {
        this.cards.splice(index, 1);
        this.saveLayout();
        this.render();
    },

    addCard(type) {
        const cardDefs = {
            stats: { title: '概览统计', w: 3, h: 1 },
            todo: { title: '待办事项', w: 1, h: 2 },
            habit: { title: '习惯追踪', w: 1, h: 2 },
            pomodoro: { title: '番茄钟', w: 1, h: 2 },
            leetcode: { title: '刷题进度', w: 2, h: 1 },
            plan: { title: '学习计划', w: 2, h: 1 },
            news: { title: '热榜资讯', w: 2, h: 2 }
        };

        const def = cardDefs[type];
        if (def) {
            this.cards.push({ type, ...def });
            this.saveLayout();
            this.render();
        }
    },

    startAutoUpdate() {
        // 每分钟自动刷新
        setInterval(() => this.loadCardData(), 60000);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出
window.DashboardV2 = DashboardV2;
