/**
 * FlowBoard - 通知中心与智能提醒 (功能9)
 * 统一管理通知、智能提醒设置
 */

const NotificationManager = {
    notifications: [],
    maxNotifications: 500,
    
    async init() {
        await this.loadNotifications();
        this.createCenter();
        this.requestPermission();
        this.startReminderLoop();
    },

    async loadNotifications() {
        this.notifications = await flowboardDB.getAll('notifications');
        this.notifications.sort((a, b) => b.timestamp - a.timestamp);
        this.updateBadge();
    },

    createCenter() {
        // 创建通知中心入口
        const header = document.querySelector('.stats-header');
        if (header) {
            const bell = document.createElement('div');
            bell.className = 'notification-bell';
            bell.innerHTML = `
                <i class="fas fa-bell"></i>
                <span class="notification-badge" id="notifBadge" style="display: none;">0</span>
            `;
            bell.onclick = () => this.toggleCenter();
            header.appendChild(bell);
        }

        // 创建通知中心面板
        const panel = document.createElement('div');
        panel.id = 'notificationCenter';
        panel.className = 'notification-center';
        panel.innerHTML = `
            <div class="notification-center-overlay" onclick="NotificationManager.closeCenter()"></div>
            <div class="notification-center-panel">
                <div class="notification-center-header">
                    <h3>通知中心</h3>
                    <div class="notification-center-actions">
                        <button class="btn-text" onclick="NotificationManager.markAllRead()">
                            全部已读
                        </button>
                        <button class="btn-text" onclick="NotificationManager.closeCenter()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="notification-center-tabs">
                    <button class="active" onclick="NotificationManager.switchTab('all')">全部</button>
                    <button onclick="NotificationManager.switchTab('unread')">未读</button>
                    <button onclick="NotificationManager.switchTab('archived')">已归档</button>
                </div>
                <div class="notification-center-list" id="notificationList">
                    <!-- 通知列表 -->
                </div>
            </div>
        `;
        document.body.appendChild(panel);
    },

    toggleCenter() {
        const panel = document.getElementById('notificationCenter');
        panel?.classList.toggle('active');
        if (panel?.classList.contains('active')) {
            this.renderNotifications();
        }
    },

    closeCenter() {
        document.getElementById('notificationCenter')?.classList.remove('active');
    },

    switchTab(tab) {
        document.querySelectorAll('.notification-center-tabs button').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        this.currentTab = tab;
        this.renderNotifications();
    },

    async add(notification) {
        const notif = {
            id: flowboardDB.generateId('notif_'),
            title: notification.title,
            body: notification.body,
            type: notification.type || 'info',
            source: notification.source || 'system',
            timestamp: Date.now(),
            read: false,
            archived: false,
            action: notification.action,
            data: notification.data
        };

        await flowboardDB.put('notifications', notif);
        this.notifications.unshift(notif);

        // 限制数量
        if (this.notifications.length > this.maxNotifications) {
            const toRemove = this.notifications.slice(this.maxNotifications);
            for (const n of toRemove) {
                await flowboardDB.delete('notifications', n.id);
            }
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        this.updateBadge();
        this.showToast(notif);

        // 桌面通知
        if (notification.desktop !== false) {
            this.showDesktop(notif);
        }

        return notif;
    },

    async markAsRead(id) {
        const notif = await flowboardDB.get('notifications', id);
        if (notif) {
            notif.read = true;
            await flowboardDB.put('notifications', notif);
            
            const localNotif = this.notifications.find(n => n.id === id);
            if (localNotif) localNotif.read = true;
            
            this.updateBadge();
            this.renderNotifications();
        }
    },

    async markAllRead() {
        for (const notif of this.notifications) {
            if (!notif.read) {
                notif.read = true;
                await flowboardDB.put('notifications', notif);
            }
        }
        this.updateBadge();
        this.renderNotifications();
    },

    async archive(id) {
        const notif = await flowboardDB.get('notifications', id);
        if (notif) {
            notif.archived = true;
            await flowboardDB.put('notifications', notif);
            this.renderNotifications();
        }
    },

    updateBadge() {
        const unread = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }
    },

    renderNotifications() {
        const container = document.getElementById('notificationList');
        if (!container) return;

        let filtered = this.notifications;
        if (this.currentTab === 'unread') {
            filtered = filtered.filter(n => !n.read);
        } else if (this.currentTab === 'archived') {
            filtered = filtered.filter(n => n.archived);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="notification-empty">
                    <i class="fas fa-inbox"></i>
                    <p>暂无通知</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(n => `
            <div class="notification-item ${n.read ? 'read' : ''} ${n.archived ? 'archived' : ''}" data-id="${n.id}">
                <div class="notification-icon ${n.type}">
                    <i class="fas ${this.getIcon(n)}"></i>
                </div>
                <div class="notification-content" onclick="NotificationManager.onClick('${n.id}')">
                    <div class="notification-title">${n.title}</div>
                    <div class="notification-body">${n.body}</div>
                    <div class="notification-meta">
                        <span class="notification-source">${n.source}</span>
                        <span class="notification-time">${this.formatTime(n.timestamp)}</span>
                    </div>
                </div>
                <div class="notification-actions">
                    ${!n.read ? `<button onclick="NotificationManager.markAsRead('${n.id}'); event.stopPropagation();">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                    <button onclick="NotificationManager.archive('${n.id}'); event.stopPropagation();">
                        <i class="fas fa-archive"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    getIcon(notification) {
        const icons = {
            info: 'fa-info-circle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle',
            task: 'fa-check-circle',
            schedule: 'fa-clock',
            pomodoro: 'fa-clock',
            ai: 'fa-robot'
        };
        return icons[notification.type] || 'fa-bell';
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        return date.toLocaleDateString();
    },

    async onClick(id) {
        const notif = this.notifications.find(n => n.id === id);
        if (!notif) return;

        await this.markAsRead(id);

        if (notif.action) {
            notif.action();
        } else if (notif.data?.page) {
            showPage(notif.data.page);
        }

        this.closeCenter();
    },

    showToast(notification) {
        // 创建临时提示
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.innerHTML = `
            <div class="notification-toast-content">
                <strong>${notification.title}</strong>
                <p>${notification.body}</p>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);

        toast.onclick = () => {
            this.onClick(notification.id);
            toast.remove();
        };
    },

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    showDesktop(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.body,
                icon: './assets/icon.png'
            });
        }
    },

    // 智能提醒循环
    startReminderLoop() {
        // 每分钟检查一次
        setInterval(() => this.checkReminders(), 60000);
        this.checkReminders();
    },

    async checkReminders() {
        const now = new Date();
        const settings = await flowboardDB.getKV('notification_settings') || {};

        // 检查日程提醒
        await this.checkScheduleReminders(now, settings);

        // 检查任务截止提醒
        await this.checkTaskDeadlines(now, settings);

        // 检查番茄钟提醒
        await this.checkPomodoroReminders(now, settings);

        // 检查学习节奏（连续3天未学习）
        await this.checkStudyStreak(now, settings);
    },

    async checkScheduleReminders(now, settings) {
        // 从日程数据检查
        const eventsStr = localStorage.getItem('flowboard_events');
        if (!eventsStr) return;

        try {
            const events = JSON.parse(eventsStr);
            for (const event of events) {
                const eventTime = new Date(event.date + 'T' + (event.time || '00:00'));
                const reminderMinutes = event.reminder || 15;
                const reminderTime = new Date(eventTime - reminderMinutes * 60000);

                if (Math.abs(now - reminderTime) < 60000) {
                    this.add({
                        title: '日程提醒',
                        body: `${event.title} 将在 ${reminderMinutes} 分钟后开始`,
                        type: 'schedule',
                        source: '日程管理',
                        data: { page: 'calendar' }
                    });
                }
            }
        } catch (e) {}
    },

    async checkTaskDeadlines(now, settings) {
        const tasks = await flowboardDB.getAll('tasks');
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        for (const task of tasks) {
            if (task.status === 'done' || !task.dueDate) continue;

            const due = new Date(task.dueDate);
            if (due.toDateString() === tomorrow.toDateString()) {
                this.add({
                    title: '任务即将到期',
                    body: `「${task.title}」明天到期`,
                    type: 'task',
                    source: '任务看板',
                    data: { page: 'tasks' }
                });
            }
        }
    },

    async checkPomodoroReminders(now, settings) {
        // 每小时提醒休息
        if (now.getMinutes() === 0) {
            const records = await flowboardDB.getAll('pomodoroRecords');
            const today = now.toISOString().split('T')[0];
            const todayCount = records.filter(r => 
                new Date(r.startTime).toISOString().startsWith(today)
            ).length;

            if (todayCount > 0 && todayCount % 4 === 0) {
                this.add({
                    title: '番茄钟提醒',
                    body: '你已经完成了 4 个番茄，建议休息一下',
                    type: 'pomodoro',
                    source: '番茄钟'
                });
            }
        }
    },

    async checkStudyStreak(now, settings) {
        // 每天 21:00 检查
        if (now.getHours() !== 21 || now.getMinutes() !== 0) return;

        const records = await flowboardDB.getByIndex('studyRecords', 'date');
        const today = now.toISOString().split('T')[0];
        
        // 检查今天是否有记录
        const hasToday = records.some(r => r.date === today);
        if (hasToday) return;

        // 检查连续未学习天数
        let streak = 0;
        for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];
            if (!records.some(r => r.date === dateStr)) {
                streak++;
            } else {
                break;
            }
        }

        if (streak >= 3) {
            this.add({
                title: '学习提醒',
                body: `你已经 ${streak} 天没有学习了，今天也来学习一会儿吧！`,
                type: 'warning',
                source: '智能提醒',
                data: { page: 'growth' }
            });
        }
    }
};

// 导出
window.NotificationManager = NotificationManager;
