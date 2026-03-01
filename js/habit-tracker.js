/**
 * FlowBoard - 习惯追踪与打卡系统 (功能10)
 * 习惯管理、打卡记录、热力图可视化
 */

const HabitTracker = {
    habits: [],
    records: {},

    async init() {
        await this.loadData();
        this.render();
    },

    async loadData() {
        this.habits = await flowboardDB.getAll('habits');
        const records = await flowboardDB.getAll('habitRecords');
        
        // 按习惯ID分组记录
        this.records = {};
        records.forEach(r => {
            if (!this.records[r.habitId]) {
                this.records[r.habitId] = [];
            }
            this.records[r.habitId].push(r);
        });
    },

    render() {
        const container = document.getElementById('habitTracker');
        if (!container) return;

        container.innerHTML = `
            <div class="habit-header">
                <h3>习惯追踪</h3>
                <button class="btn-primary" onclick="HabitTracker.showAddModal()">
                    <i class="fas fa-plus"></i> 添加习惯
                </button>
            </div>
            <div class="habit-list">
                ${this.habits.map(h => this.renderHabitCard(h)).join('')}
            </div>
            ${this.habits.length === 0 ? `
                <div class="habit-empty">
                    <i class="fas fa-calendar-check"></i>
                    <p>还没有习惯，添加一个开始追踪吧！</p>
                </div>
            ` : ''}
        `;
    },

    renderHabitCard(habit) {
        const today = new Date().toISOString().split('T')[0];
        const isCheckedToday = this.isCheckedOnDate(habit.id, today);
        const streak = this.calculateStreak(habit.id);
        const total = this.getTotalChecks(habit.id);
        
        return `
            <div class="habit-card ${isCheckedToday ? 'checked' : ''}" data-id="${habit.id}">
                <div class="habit-info">
                    <div class="habit-icon" style="background: ${habit.color}">
                        <i class="fas ${habit.icon}"></i>
                    </div>
                    <div class="habit-details">
                        <span class="habit-name">${this.escapeHtml(habit.name)}</span>
                        <span class="habit-streak">
                            <i class="fas fa-fire"></i> ${streak} 天连续
                        </span>
                    </div>
                </div>
                <div class="habit-stats">
                    <span class="habit-total">${total} 次</span>
                </div>
                <button class="habit-check-btn ${isCheckedToday ? 'checked' : ''}" 
                        onclick="HabitTracker.toggleCheck('${habit.id}')"
                        title="${isCheckedToday ? '已打卡' : '点击打卡'}">
                    <i class="fas ${isCheckedToday ? 'fa-check' : 'fa-circle'}"></i>
                </button>
                <div class="habit-actions">
                    <button onclick="HabitTracker.showDetail('${habit.id}')">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <button onclick="HabitTracker.deleteHabit('${habit.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    isCheckedOnDate(habitId, date) {
        const records = this.records[habitId] || [];
        return records.some(r => r.date === date);
    },

    calculateStreak(habitId) {
        const records = this.records[habitId] || [];
        if (records.length === 0) return 0;

        const dates = records.map(r => r.date).sort().reverse();
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        // 检查今天是否打卡，如果没有，从昨天开始算
        const today = currentDate.toISOString().split('T')[0];
        if (dates[0] !== today) {
            currentDate.setDate(currentDate.getDate() - 1);
        }

        for (const date of dates) {
            const checkDate = currentDate.toISOString().split('T')[0];
            if (date === checkDate) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (new Date(date) < currentDate) {
                break;
            }
        }

        return streak;
    },

    getTotalChecks(habitId) {
        return (this.records[habitId] || []).length;
    },

    async toggleCheck(habitId) {
        const today = new Date().toISOString().split('T')[0];
        const existing = (this.records[habitId] || []).find(r => r.date === today);

        if (existing) {
            // 取消打卡
            await flowboardDB.delete('habitRecords', existing.id);
            this.records[habitId] = this.records[habitId].filter(r => r.id !== existing.id);
        } else {
            // 打卡
            const record = {
                id: flowboardDB.generateId('habitrec_'),
                habitId,
                date: today,
                timestamp: Date.now()
            };
            await flowboardDB.put('habitRecords', record);
            
            if (!this.records[habitId]) {
                this.records[habitId] = [];
            }
            this.records[habitId].push(record);

            // 庆祝动画
            this.celebrate(habitId);
        }

        this.render();
    },

    celebrate(habitId) {
        // 简单的 confetti 效果
        const btn = document.querySelector(`.habit-card[data-id="${habitId}"] .habit-check-btn`);
        if (!btn) return;

        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti';
            particle.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: 50%;
                pointer-events: none;
                left: 50%;
                top: 50%;
            `;
            btn.style.position = 'relative';
            btn.appendChild(particle);

            const angle = (Math.PI * 2 * i) / 20;
            const velocity = 60 + Math.random() * 40;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            particle.animate([
                { transform: 'translate(-50%, -50%)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`, opacity: 0 }
            ], {
                duration: 600,
                easing: 'cubic-bezier(0, .9, .57, 1)'
            }).onfinish = () => particle.remove();
        }
    },

    showAddModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'addHabitModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('addHabitModal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>添加新习惯</h3>
                    <button class="close-btn" onclick="document.getElementById('addHabitModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>习惯名称</label>
                        <input type="text" id="habitName" class="form-control" placeholder="例如：每日阅读">
                    </div>
                    <div class="form-group">
                        <label>图标</label>
                        <div class="icon-selector-grid">
                            ${['fa-book', 'fa-code', 'fa-running', 'fa-meditation', 'fa-glass-water', 'fa-bed', 'fa-sun', 'fa-music']
                                .map(icon => `
                                <button class="icon-option" data-icon="${icon}" onclick="HabitTracker.selectIcon(this)">
                                    <i class="fas ${icon}"></i>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>颜色</label>
                        <div class="color-selector">
                            ${['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#6366f1']
                                .map(color => `
                                <button class="color-option" data-color="${color}" 
                                        style="background: ${color}"
                                        onclick="HabitTracker.selectColor(this)"></button>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('addHabitModal').remove()">取消</button>
                    <button class="btn-primary" onclick="HabitTracker.addHabit()">添加</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 默认选择
        modal.querySelector('.icon-option')?.classList.add('selected');
        modal.querySelector('.color-option')?.classList.add('selected');
    },

    selectedIcon: 'fa-book',
    selectedColor: '#22c55e',

    selectIcon(btn) {
        document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedIcon = btn.dataset.icon;
    },

    selectColor(btn) {
        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedColor = btn.dataset.color;
    },

    async addHabit() {
        const name = document.getElementById('habitName').value.trim();
        if (!name) {
            showToast('请输入习惯名称');
            return;
        }

        const habit = {
            id: flowboardDB.generateId('habit_'),
            name,
            icon: this.selectedIcon,
            color: this.selectedColor,
            createdAt: Date.now()
        };

        await flowboardDB.put('habits', habit);
        this.habits.push(habit);
        
        document.getElementById('addHabitModal').remove();
        this.render();
        showToast('习惯添加成功');
    },

    async deleteHabit(habitId) {
        if (!confirm('确定删除这个习惯吗？所有打卡记录也会被删除。')) return;

        await flowboardDB.delete('habits', habitId);
        
        // 删除相关记录
        const records = this.records[habitId] || [];
        for (const r of records) {
            await flowboardDB.delete('habitRecords', r.id);
        }

        this.habits = this.habits.filter(h => h.id !== habitId);
        delete this.records[habitId];
        
        this.render();
        showToast('习惯已删除');
    },

    showDetail(habitId) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'habitDetailModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('habitDetailModal').remove()"></div>
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3><i class="fas ${habit.icon}" style="color: ${habit.color}"></i> ${this.escapeHtml(habit.name)}</h3>
                    <button class="close-btn" onclick="document.getElementById('habitDetailModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="habit-heatmap">
                        ${this.renderHeatmap(habitId)}
                    </div>
                    <div class="habit-stats-detail">
                        <div class="stat-item">
                            <span class="stat-value">${this.calculateStreak(habitId)}</span>
                            <span class="stat-label">当前连续</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${this.getTotalChecks(habitId)}</span>
                            <span class="stat-label">总打卡</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${this.getLongestStreak(habitId)}</span>
                            <span class="stat-label">最长连续</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    renderHeatmap(habitId) {
        // 生成过去一年的热力图
        const records = this.records[habitId] || [];
        const dates = new Set(records.map(r => r.date));
        
        let html = '<div class="heatmap-grid">';
        const today = new Date();
        
        for (let i = 364; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const hasRecord = dates.has(dateStr);
            
            html += `<div class="heatmap-cell ${hasRecord ? 'active' : ''}" title="${dateStr}"></div>`;
        }
        
        html += '</div>';
        return html;
    },

    getLongestStreak(habitId) {
        const records = this.records[habitId] || [];
        if (records.length === 0) return 0;

        const dates = records.map(r => r.date).sort();
        let maxStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);

            if (diff === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }

        return maxStreak;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出
window.HabitTracker = HabitTracker;
