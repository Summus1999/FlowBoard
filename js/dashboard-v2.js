/**
 * FlowBoard - Dashboard V2
 * Modern card-based dashboard with visual data presentation
 */

const DashboardV2 = {
    cards: [],
    defaultLayout: [
        { type: 'stats', title: '概览统计', icon: 'fa-chart-pie', w: 3, h: 1 },
        { type: 'todo', title: '待办事项', icon: 'fa-check-circle', w: 1, h: 2 },
        { type: 'habit', title: '习惯追踪', icon: 'fa-calendar-check', w: 1, h: 2 },
        { type: 'pomodoro', title: '番茄钟', icon: 'fa-clock', w: 1, h: 2 },
        { type: 'leetcode', title: '刷题进度', icon: 'fa-code', w: 2, h: 1 },
        { type: 'plan', title: '学习计划', icon: 'fa-clipboard-list', w: 2, h: 1 }
    ],

    _iconMap: {
        stats: 'fa-chart-pie',
        todo: 'fa-check-circle',
        habit: 'fa-calendar-check',
        pomodoro: 'fa-clock',
        leetcode: 'fa-code',
        plan: 'fa-clipboard-list',
        news: 'fa-newspaper'
    },

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

        const content = container.querySelector('.content-grid') || container;
        content.className = 'dashboard-grid';
        content.innerHTML = this.cards.map((card, index) => `
            <div class="dashboard-card ${card.type}" data-index="${index}"
                 style="grid-column: span ${card.w}; grid-row: span ${card.h}">
                <div class="dashboard-card-header">
                    <div class="card-title-area">
                        <div class="card-icon">
                            <i class="fas ${card.icon || this._iconMap[card.type] || 'fa-square'}"></i>
                        </div>
                        <h4>${card.title}</h4>
                    </div>
                    <div class="card-actions">
                        <button onclick="DashboardV2.refreshCard('${card.type}')" title="刷新">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button onclick="DashboardV2.removeCard(${index})" title="移除">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="dashboard-card-body" id="card-${card.type}">
                    <div class="dash-empty"><i class="fas fa-spinner fa-pulse"></i></div>
                </div>
            </div>
        `).join('');

        this.loadCardData();
    },

    async loadCardData() {
        await Promise.allSettled([
            this.loadStatsCard(),
            this.loadTodoCard(),
            this.loadHabitCard(),
            this.loadPomodoroCard(),
            this.loadLeetCodeCard(),
            this.loadPlanCard()
        ]);
    },

    // ---- Stats ----
    async loadStatsCard() {
        const el = document.getElementById('card-stats');
        if (!el) return;

        const [tasks, habits, pomos] = await Promise.all([
            flowboardDB.getAll('tasks'),
            flowboardDB.getAll('habits'),
            flowboardDB.getAll('pomodoroRecords')
        ]);

        const today = new Date().toISOString().split('T')[0];
        const todayPomos = pomos.filter(p => new Date(p.startTime).toISOString().startsWith(today));
        const focusMin = todayPomos.reduce((s, p) => s + (p.duration || 25), 0);
        const pending = tasks.filter(t => t.status !== 'done').length;

        el.innerHTML = `
            <div class="dash-stats-grid">
                <div class="dash-stat-item">
                    <div class="stat-icon-mini tasks"><i class="fas fa-tasks"></i></div>
                    <div class="stat-number">${pending}</div>
                    <div class="stat-label">待办任务</div>
                </div>
                <div class="dash-stat-item">
                    <div class="stat-icon-mini habits"><i class="fas fa-fire"></i></div>
                    <div class="stat-number">${habits.length}</div>
                    <div class="stat-label">追踪习惯</div>
                </div>
                <div class="dash-stat-item">
                    <div class="stat-icon-mini pomos"><i class="fas fa-stopwatch"></i></div>
                    <div class="stat-number">${todayPomos.length}</div>
                    <div class="stat-label">今日番茄</div>
                </div>
                <div class="dash-stat-item">
                    <div class="stat-icon-mini hours"><i class="fas fa-hourglass-half"></i></div>
                    <div class="stat-number">${focusMin >= 60 ? (focusMin / 60).toFixed(1) + 'h' : focusMin + 'm'}</div>
                    <div class="stat-label">专注时长</div>
                </div>
            </div>
        `;
    },

    // ---- Todo ----
    async loadTodoCard() {
        const el = document.getElementById('card-todo');
        if (!el) return;

        const tasks = await flowboardDB.getAll('tasks');
        const todo = tasks.filter(t => t.status !== 'done').slice(0, 6);

        if (todo.length === 0) {
            el.innerHTML = `
                <div class="dash-empty">
                    <i class="fas fa-check-double"></i>
                    <span>全部完成，太棒了!</span>
                    <button class="dash-empty-action" onclick="showPage('tasks')">查看任务看板</button>
                </div>`;
            return;
        }

        el.innerHTML = `<div class="dash-todo-list">${todo.map(t => {
            const diff = t.difficulty || 'medium';
            return `
                <div class="dash-todo-item">
                    <input type="checkbox" onchange="DashboardV2.completeTask('${t.id}')">
                    <span>${this.esc(t.title)}</span>
                    <div class="todo-priority ${diff}"></div>
                </div>`;
        }).join('')}</div>`;
    },

    // ---- Habit ----
    async loadHabitCard() {
        const el = document.getElementById('card-habit');
        if (!el) return;

        const habits = await flowboardDB.getAll('habits');
        const today = new Date().toISOString().split('T')[0];

        if (habits.length === 0) {
            el.innerHTML = `
                <div class="dash-empty">
                    <i class="fas fa-seedling"></i>
                    <span>还没有习惯</span>
                    <button class="dash-empty-action" onclick="showPage('growth')">添加习惯</button>
                </div>`;
            return;
        }

        el.innerHTML = `<div class="dash-habit-preview">${habits.slice(0, 4).map(h => {
            const done = typeof HabitTracker !== 'undefined' && HabitTracker.isCheckedOnDate?.(h.id, today);
            const streak = typeof HabitTracker !== 'undefined' ? (HabitTracker.calculateStreak?.(h.id) || 0) : 0;
            return `
                <div class="dash-habit-row ${done ? 'done' : ''}">
                    <div class="habit-icon-sm" style="background: ${h.color}30; color: ${h.color};">
                        <i class="fas ${h.icon}"></i>
                    </div>
                    <div class="habit-info">
                        <span class="habit-name">${this.esc(h.name)}</span>
                        ${streak > 0 ? `<span class="habit-streak-sm"><i class="fas fa-fire"></i> ${streak} 天</span>` : ''}
                    </div>
                    <div class="habit-check-sm">
                        <i class="fas fa-check"></i>
                    </div>
                </div>`;
        }).join('')}</div>`;
    },

    // ---- Pomodoro ----
    async loadPomodoroCard() {
        const el = document.getElementById('card-pomodoro');
        if (!el) return;

        const stats = typeof PomodoroTimer !== 'undefined'
            ? await PomodoroTimer.getStats('today')
            : { count: 0, totalMinutes: 0 };
        const goal = 8;
        const pct = Math.min(stats.count / goal, 1);
        const circumference = 2 * Math.PI * 46;
        const offset = circumference * (1 - pct);

        el.innerHTML = `
            <div class="dash-pomo-container">
                <div class="dash-pomo-ring">
                    <svg viewBox="0 0 100 100">
                        <circle class="ring-track" cx="50" cy="50" r="46"/>
                        <circle class="ring-fill" cx="50" cy="50" r="46"
                                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"/>
                    </svg>
                    <div class="dash-pomo-count">
                        <div class="pomo-num">${stats.count}</div>
                        <div class="pomo-unit">番茄</div>
                    </div>
                </div>
                <div class="dash-pomo-meta">
                    <span class="dash-pomo-goal">目标 ${goal} 个 · 已完成 ${Math.round(pct * 100)}%</span>
                </div>
                <button class="dash-pomo-btn" onclick="PomodoroTimer.togglePanel()">
                    <i class="fas fa-play"></i> 开始专注
                </button>
            </div>`;
    },

    // ---- LeetCode ----
    async loadLeetCodeCard() {
        const el = document.getElementById('card-leetcode');
        if (!el) return;

        const submissions = JSON.parse(localStorage.getItem('leetcode_submissions') || '[]');
        const easy = submissions.filter(s => s.difficulty === 'Easy').length;
        const medium = submissions.filter(s => s.difficulty === 'Medium').length;
        const hard = submissions.filter(s => s.difficulty === 'Hard').length;
        const total = submissions.length;

        const c = 2 * Math.PI * 40;
        const eLen = total > 0 ? (easy / total) * c : 0;
        const mLen = total > 0 ? (medium / total) * c : 0;
        const hLen = total > 0 ? (hard / total) * c : 0;

        el.innerHTML = `
            <div class="dash-lc-container">
                <div class="dash-lc-donut">
                    <svg viewBox="0 0 100 100">
                        <circle class="donut-track" cx="50" cy="50" r="40"/>
                        <circle class="donut-easy" cx="50" cy="50" r="40"
                                style="stroke-dasharray: ${eLen} ${c - eLen}; stroke-dashoffset: 0;"/>
                        <circle class="donut-medium" cx="50" cy="50" r="40"
                                style="stroke-dasharray: ${mLen} ${c - mLen}; stroke-dashoffset: ${-eLen};"/>
                        <circle class="donut-hard" cx="50" cy="50" r="40"
                                style="stroke-dasharray: ${hLen} ${c - hLen}; stroke-dashoffset: ${-(eLen + mLen)};"/>
                    </svg>
                    <div class="dash-lc-total">
                        <div class="lc-num">${total}</div>
                        <div class="lc-unit">已解决</div>
                    </div>
                </div>
                <div class="dash-lc-breakdown">
                    <div class="dash-lc-row">
                        <div class="lc-dot easy"></div>
                        <span class="lc-label">简单</span>
                        <span class="lc-value">${easy}</span>
                    </div>
                    <div class="dash-lc-row">
                        <div class="lc-dot medium"></div>
                        <span class="lc-label">中等</span>
                        <span class="lc-value">${medium}</span>
                    </div>
                    <div class="dash-lc-row">
                        <div class="lc-dot hard"></div>
                        <span class="lc-label">困难</span>
                        <span class="lc-value">${hard}</span>
                    </div>
                </div>
            </div>`;
    },

    // ---- Plan ----
    async loadPlanCard() {
        const el = document.getElementById('card-plan');
        if (!el) return;

        const plans = await flowboardDB.getAll('learningPlans');
        const active = plans.find(p => p.status === 'active');

        if (!active) {
            el.innerHTML = `
                <div class="dash-empty">
                    <i class="fas fa-map-signs"></i>
                    <span>暂无进行中的计划</span>
                    <button class="dash-empty-action" onclick="showPage('growth')">创建学习计划</button>
                </div>`;
            return;
        }

        const stageCount = active.stages?.length || 0;
        const progress = active.progress || 0;

        el.innerHTML = `
            <div class="dash-plan-container">
                <div class="dash-plan-title">${this.esc(active.title)}</div>
                <div class="dash-plan-bar-wrap">
                    <div class="dash-plan-bar-fill" style="width: ${progress}%"></div>
                </div>
                <div class="dash-plan-meta">
                    <span class="dash-plan-percent">${progress}%</span>
                    <span class="dash-plan-stages">${stageCount} 个阶段</span>
                </div>
            </div>`;
    },

    // ---- Actions ----
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
        const fn = {
            stats: () => this.loadStatsCard(),
            todo: () => this.loadTodoCard(),
            habit: () => this.loadHabitCard(),
            pomodoro: () => this.loadPomodoroCard(),
            leetcode: () => this.loadLeetCodeCard(),
            plan: () => this.loadPlanCard()
        };
        fn[type]?.();
    },

    removeCard(index) {
        this.cards.splice(index, 1);
        this.saveLayout();
        this.render();
    },

    addCard(type) {
        const defs = {
            stats: { title: '概览统计', w: 3, h: 1 },
            todo: { title: '待办事项', w: 1, h: 2 },
            habit: { title: '习惯追踪', w: 1, h: 2 },
            pomodoro: { title: '番茄钟', w: 1, h: 2 },
            leetcode: { title: '刷题进度', w: 2, h: 1 },
            plan: { title: '学习计划', w: 2, h: 1 },
            news: { title: '热榜资讯', w: 2, h: 2 }
        };
        const def = defs[type];
        if (def) {
            this.cards.push({ type, icon: this._iconMap[type], ...def });
            this.saveLayout();
            this.render();
        }
    },

    startAutoUpdate() {
        setInterval(() => this.loadCardData(), 60000);
    },

    esc(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }
};

window.DashboardV2 = DashboardV2;
