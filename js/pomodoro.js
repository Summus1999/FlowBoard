/**
 * FlowBoard - 番茄钟与专注模式 (功能7)
 * 计时器、专注模式、数据统计
 */

const PomodoroTimer = {
    // 配置
    settings: {
        workTime: 25,      // 工作时长（分钟）
        shortBreak: 5,     // 短休息（分钟）
        longBreak: 15,     // 长休息（分钟）
        longBreakInterval: 4, // 几个番茄后长休息
        sound: 'bell'      // 提示音
    },

    // 状态
    state: {
        timeRemaining: 25 * 60,  // 剩余秒数
        isRunning: false,
        mode: 'work',           // work, shortBreak, longBreak
        completedPomodoros: 0,
        currentSession: 0,
        timerId: null,
        startTime: null
    },

    async init() {
        await this.loadSettings();
        this.resetTimer();
        this.createPanel();
        this.restoreState();
    },

    async loadSettings() {
        const saved = await flowboardDB.getKV('pomodoro_settings');
        if (saved) {
            this.settings = { ...this.settings, ...saved };
        }
    },

    async saveSettings() {
        await flowboardDB.setKV('pomodoro_settings', this.settings);
    },

    createPanel() {
        // 创建番茄钟面板
        const panel = document.createElement('div');
        panel.id = 'pomodoroPanel';
        panel.className = 'pomodoro-panel';
        panel.innerHTML = `
            <div class="pomodoro-header">
                <span class="pomodoro-mode">专注模式</span>
                <button class="pomodoro-close" onclick="PomodoroTimer.togglePanel()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="pomodoro-display">
                <svg class="pomodoro-ring" viewBox="0 0 100 100">
                    <circle class="ring-bg" cx="50" cy="50" r="45"/>
                    <circle class="ring-progress" id="pomodoroRing" cx="50" cy="50" r="45"/>
                </svg>
                <div class="pomodoro-time" id="pomodoroTime">25:00</div>
            </div>
            <div class="pomodoro-info">
                <span id="pomodoroModeText">准备专注</span>
                <div class="pomodoro-stats">
                    <span class="pomodoro-count">
                        ${'🍅'.repeat(this.state.completedPomodoros) || '暂无完成'}
                    </span>
                </div>
            </div>
            <div class="pomodoro-controls">
                <button class="pomodoro-btn primary" id="pomodoroMainBtn" onclick="PomodoroTimer.toggle()">
                    <i class="fas fa-play"></i> 开始
                </button>
                <button class="pomodoro-btn" onclick="PomodoroTimer.reset()">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="pomodoro-btn" onclick="PomodoroTimer.skip()">
                    <i class="fas fa-step-forward"></i>
                </button>
                <button class="pomodoro-btn" onclick="PomodoroTimer.toggleFocusMode()">
                    <i class="fas fa-expand"></i> 全屏
                </button>
            </div>
            <div class="pomodoro-task">
                <select id="pomodoroTaskSelect" class="pomodoro-task-select">
                    <option value="">选择关联任务...</option>
                </select>
            </div>
        `;

        document.body.appendChild(panel);

        // 创建悬浮按钮
        const floatBtn = document.createElement('button');
        floatBtn.id = 'pomodoroFloatBtn';
        floatBtn.className = 'pomodoro-float-btn';
        floatBtn.innerHTML = '🍅';
        floatBtn.title = '番茄钟';
        floatBtn.onclick = () => this.togglePanel();
        document.body.appendChild(floatBtn);

        this.loadTasks();
    },

    togglePanel() {
        const panel = document.getElementById('pomodoroPanel');
        panel?.classList.toggle('active');
    },

    async loadTasks() {
        const tasks = await flowboardDB.getAll('tasks');
        const select = document.getElementById('pomodoroTaskSelect');
        if (!select) return;

        const todoTasks = tasks.filter(t => t.status === 'todo');
        select.innerHTML = `
            <option value="">选择关联任务...</option>
            ${todoTasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
        `;
    },

    toggle() {
        if (this.state.isRunning) {
            this.pause();
        } else {
            this.start();
        }
    },

    start() {
        this.state.isRunning = true;
        this.state.startTime = Date.now();
        
        this.state.timerId = setInterval(() => this.tick(), 1000);
        this.updateUI();
        this.saveState();

        // 更新按钮
        const btn = document.getElementById('pomodoroMainBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
        }

        // 发送通知
        NotificationManager.show({
            title: '番茄钟开始',
            body: `开始${this.state.mode === 'work' ? '专注' : '休息'}时间`
        });
    },

    pause() {
        this.state.isRunning = false;
        clearInterval(this.state.timerId);
        this.saveState();
        this.updateUI();

        const btn = document.getElementById('pomodoroMainBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-play"></i> 继续';
        }
    },

    reset() {
        this.pause();
        this.resetTimer();
        this.updateUI();
    },

    resetTimer() {
        const minutes = this.state.mode === 'work' ? this.settings.workTime :
                       this.state.mode === 'shortBreak' ? this.settings.shortBreak :
                       this.settings.longBreak;
        this.state.timeRemaining = minutes * 60;
    },

    skip() {
        this.pause();
        this.completePhase();
    },

    tick() {
        this.state.timeRemaining--;
        this.updateUI();

        if (this.state.timeRemaining <= 0) {
            this.completePhase();
        }
    },

    completePhase() {
        this.pause();
        this.playSound();

        if (this.state.mode === 'work') {
            this.state.completedPomodoros++;
            this.recordPomodoro();
            
            // 检查是否长休息
            if (this.state.completedPomodoros % this.settings.longBreakInterval === 0) {
                this.state.mode = 'longBreak';
            } else {
                this.state.mode = 'shortBreak';
            }
        } else {
            // 休息结束，回到工作
            this.state.mode = 'work';
        }

        this.resetTimer();
        this.updateUI();
        this.showPhaseCompleteNotification();
    },

    async recordPomodoro() {
        const record = {
            id: flowboardDB.generateId('pomo_'),
            startTime: this.state.startTime,
            endTime: Date.now(),
            duration: this.settings.workTime,
            taskId: document.getElementById('pomodoroTaskSelect')?.value,
            createdAt: Date.now()
        };

        await flowboardDB.put('pomodoroRecords', record);

        // 关联任务增加时间
        if (record.taskId) {
            const task = await flowboardDB.get('tasks', record.taskId);
            if (task) {
                task.actualHours = (task.actualHours || 0) + this.settings.workTime / 60;
                await flowboardDB.put('tasks', task);
            }
        }
    },

    showPhaseCompleteNotification() {
        const isWork = this.state.mode === 'work';
        NotificationManager.show({
            title: isWork ? '专注时间到！' : '休息结束',
            body: isWork ? '准备开始新的专注' : '该开始专注了！',
            onClick: () => this.togglePanel()
        });
    },

    playSound() {
        // 简单的提示音
        const audio = new Audio();
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'; // 简化版
        audio.play().catch(() => {});
    },

    updateUI() {
        const minutes = Math.floor(this.state.timeRemaining / 60);
        const seconds = this.state.timeRemaining % 60;
        const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const timeDisplay = document.getElementById('pomodoroTime');
        if (timeDisplay) {
            timeText.textContent = timeText;
        }

        // 更新圆环进度
        const totalTime = (this.state.mode === 'work' ? this.settings.workTime :
                          this.state.mode === 'shortBreak' ? this.settings.shortBreak :
                          this.settings.longBreak) * 60;
        const progress = (totalTime - this.state.timeRemaining) / totalTime;
        const ring = document.getElementById('pomodoroRing');
        if (ring) {
            const circumference = 2 * Math.PI * 45;
            ring.style.strokeDasharray = circumference;
            ring.style.strokeDashoffset = circumference * (1 - progress);
            ring.style.stroke = this.state.mode === 'work' ? '#ef4444' : '#22c55e';
        }

        // 更新模式文字
        const modeText = document.getElementById('pomodoroModeText');
        if (modeText) {
            modeText.textContent = {
                work: '专注中...',
                shortBreak: '短休息',
                longBreak: '长休息'
            }[this.state.mode];
        }
    },

    toggleFocusMode() {
        document.body.classList.toggle('focus-mode');
        
        if (document.body.classList.contains('focus-mode')) {
            // 隐藏侧边栏和其他干扰元素
            document.querySelector('.sidebar')?.classList.add('hidden');
            document.querySelector('.stats-header')?.classList.add('hidden');
        } else {
            document.querySelector('.sidebar')?.classList.remove('hidden');
            document.querySelector('.stats-header')?.classList.remove('hidden');
        }
    },

    saveState() {
        flowboardDB.setKV('pomodoro_state', {
            timeRemaining: this.state.timeRemaining,
            isRunning: this.state.isRunning,
            mode: this.state.mode,
            completedPomodoros: this.state.completedPomodoros
        });
    },

    async restoreState() {
        const saved = await flowboardDB.getKV('pomodoro_state');
        if (saved) {
            this.state.timeRemaining = saved.timeRemaining;
            this.state.mode = saved.mode;
            this.state.completedPomodoros = saved.completedPomodoros;
            this.updateUI();
        }
    },

    // 获取统计数据
    async getStats(period = 'today') {
        const records = await flowboardDB.getAll('pomodoroRecords');
        const now = new Date();
        
        let filtered = records;
        if (period === 'today') {
            const today = now.toISOString().split('T')[0];
            filtered = records.filter(r => new Date(r.startTime).toISOString().startsWith(today));
        } else if (period === 'week') {
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            filtered = records.filter(r => new Date(r.startTime) >= weekAgo);
        }

        return {
            count: filtered.length,
            totalMinutes: filtered.reduce((sum, r) => sum + r.duration, 0)
        };
    }
};

// 导出
window.PomodoroTimer = PomodoroTimer;
