/**
 * FlowBoard - 自动化工作流引擎 (功能15)
 * IFTTT 风格的本地自动化规则
 */

const AutomationEngine = {
    workflows: [],
    isRunning: false,

    async init() {
        await this.loadWorkflows();
        this.renderWorkflowManager();
        this.startEngine();
    },

    async loadWorkflows() {
        this.workflows = await flowboardDB.getAll('workflows');
        
        // 如果没有工作流，创建默认示例
        if (this.workflows.length === 0) {
            await this.createDefaultWorkflows();
        }
    },

    async createDefaultWorkflows() {
        const defaults = [
            {
                id: 'wf_morning',
                name: '每日晨间计划',
                enabled: false,
                trigger: {
                    type: 'schedule',
                    config: { time: '08:00', days: [1, 2, 3, 4, 5] }
                },
                actions: [
                    { type: 'notification', config: { title: '早上好！', body: '查看今日任务清单' } },
                    { type: 'openPage', config: { page: 'tasks' } }
                ]
            },
            {
                id: 'wf_review',
                name: '周日复盘',
                enabled: false,
                trigger: {
                    type: 'schedule',
                    config: { time: '20:00', days: [0] }
                },
                actions: [
                    { type: 'notification', config: { title: '复盘时间', body: '生成本周学习复盘报告' } },
                    { type: 'generateReview', config: {} }
                ]
            },
            {
                id: 'wf_study_reminder',
                name: '学习提醒',
                enabled: false,
                trigger: {
                    type: 'schedule',
                    config: { time: '21:00', days: [0, 1, 2, 3, 4, 5, 6] }
                },
                actions: [
                    { type: 'checkAndNotify', config: { condition: 'noStudyToday', message: '今天还没有学习哦' } }
                ]
            }
        ];

        for (const wf of defaults) {
            await flowboardDB.put('workflows', wf);
        }
        this.workflows = defaults;
    },

    renderWorkflowManager() {
        const container = document.getElementById('workflowManager');
        if (!container) return;

        container.innerHTML = `
            <div class="workflow-header">
                <h3>自动化工作流</h3>
                <button class="btn-primary" onclick="AutomationEngine.showCreateModal()">
                    <i class="fas fa-plus"></i> 新建工作流
                </button>
            </div>
            <div class="workflow-list">
                ${this.workflows.map(wf => this.renderWorkflowCard(wf)).join('')}
            </div>
        `;
    },

    renderWorkflowCard(wf) {
        return `
            <div class="workflow-card ${wf.enabled ? 'enabled' : ''}">
                <div class="workflow-info">
                    <h4>${this.escapeHtml(wf.name)}</h4>
                    <div class="workflow-meta">
                        <span class="workflow-trigger">
                            <i class="fas ${this.getTriggerIcon(wf.trigger.type)}"></i>
                            ${this.describeTrigger(wf.trigger)}
                        </span>
                        <span class="workflow-actions-count">
                            ${wf.actions.length} 个动作
                        </span>
                    </div>
                </div>
                <div class="workflow-actions-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" ${wf.enabled ? 'checked' : ''} 
                               onchange="AutomationEngine.toggleWorkflow('${wf.id}')">
                        <span class="toggle-slider"></span>
                    </label>
                    <button onclick="AutomationEngine.editWorkflow('${wf.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="AutomationEngine.deleteWorkflow('${wf.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    getTriggerIcon(type) {
        const icons = {
            schedule: 'fa-clock',
            event: 'fa-bolt',
            condition: 'fa-code-branch'
        };
        return icons[type] || 'fa-circle';
    },

    describeTrigger(trigger) {
        if (trigger.type === 'schedule') {
            const days = trigger.config.days;
            const daysText = days.length === 7 ? '每天' : 
                           days.length === 5 && days.every((d, i) => d === i + 1) ? '工作日' :
                           days.length === 2 && days.includes(0) && days.includes(6) ? '周末' :
                           `每周 ${days.length} 天`;
            return `${daysText} ${trigger.config.time}`;
        }
        return trigger.type;
    },

    showCreateModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'createWorkflowModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('createWorkflowModal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>新建工作流</h3>
                    <button class="close-btn" onclick="document.getElementById('createWorkflowModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>名称</label>
                        <input type="text" id="wfName" class="form-control" placeholder="例如：每日提醒">
                    </div>
                    <div class="form-group">
                        <label>触发条件</label>
                        <select id="wfTrigger" class="form-control" onchange="AutomationEngine.onTriggerChange()">
                            <option value="schedule">定时触发</option>
                            <option value="event">事件触发</option>
                        </select>
                    </div>
                    <div id="triggerConfig">
                        <!-- 动态加载触发器配置 -->
                    </div>
                    <div class="form-group">
                        <label>执行动作</label>
                        <div id="wfActions">
                            <div class="action-item">
                                <select class="action-type form-control">
                                    <option value="notification">发送通知</option>
                                    <option value="openPage">打开页面</option>
                                    <option value="createTask">创建任务</option>
                                </select>
                            </div>
                        </div>
                        <button class="btn-text" onclick="AutomationEngine.addAction()">
                            <i class="fas fa-plus"></i> 添加动作
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('createWorkflowModal').remove()">取消</button>
                    <button class="btn-primary" onclick="AutomationEngine.createWorkflow()">创建</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.onTriggerChange();
    },

    onTriggerChange() {
        const type = document.getElementById('wfTrigger').value;
        const container = document.getElementById('triggerConfig');
        
        if (type === 'schedule') {
            container.innerHTML = `
                <div class="form-row">
                    <div class="form-group">
                        <label>时间</label>
                        <input type="time" id="wfTime" class="form-control" value="08:00">
                    </div>
                    <div class="form-group">
                        <label>重复</label>
                        <select id="wfDays" class="form-control" multiple>
                            <option value="1" selected>周一</option>
                            <option value="2" selected>周二</option>
                            <option value="3" selected>周三</option>
                            <option value="4" selected>周四</option>
                            <option value="5" selected>周五</option>
                            <option value="6">周六</option>
                            <option value="0">周日</option>
                        </select>
                    </div>
                </div>
            `;
        }
    },

    addAction() {
        const container = document.getElementById('wfActions');
        const div = document.createElement('div');
        div.className = 'action-item';
        div.innerHTML = `
            <select class="action-type form-control">
                <option value="notification">发送通知</option>
                <option value="openPage">打开页面</option>
                <option value="createTask">创建任务</option>
            </select>
            <button onclick="this.parentElement.remove()" class="btn-text">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(div);
    },

    async createWorkflow() {
        const name = document.getElementById('wfName').value.trim();
        if (!name) {
            showToast('请输入工作流名称');
            return;
        }

        const triggerType = document.getElementById('wfTrigger').value;
        const trigger = { type: triggerType, config: {} };

        if (triggerType === 'schedule') {
            trigger.config.time = document.getElementById('wfTime').value;
            const daysSelect = document.getElementById('wfDays');
            trigger.config.days = Array.from(daysSelect.selectedOptions).map(o => parseInt(o.value));
        }

        const actions = [];
        document.querySelectorAll('.action-item').forEach(item => {
            const type = item.querySelector('.action-type').value;
            actions.push({ type, config: {} });
        });

        const workflow = {
            id: flowboardDB.generateId('wf_'),
            name,
            enabled: false,
            trigger,
            actions,
            createdAt: Date.now()
        };

        await flowboardDB.put('workflows', workflow);
        this.workflows.push(workflow);
        
        document.getElementById('createWorkflowModal').remove();
        this.renderWorkflowManager();
        showToast('工作流创建成功');
    },

    async toggleWorkflow(id) {
        const wf = this.workflows.find(w => w.id === id);
        if (wf) {
            wf.enabled = !wf.enabled;
            await flowboardDB.put('workflows', wf);
            this.renderWorkflowManager();
        }
    },

    async deleteWorkflow(id) {
        if (!confirm('确定删除这个工作流吗？')) return;
        
        await flowboardDB.delete('workflows', id);
        this.workflows = this.workflows.filter(w => w.id !== id);
        this.renderWorkflowManager();
    },

    startEngine() {
        // 每分钟检查一次
        setInterval(() => this.checkWorkflows(), 60000);
        this.checkWorkflows();
    },

    async checkWorkflows() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDay = now.getDay();

        for (const wf of this.workflows) {
            if (!wf.enabled) continue;

            if (wf.trigger.type === 'schedule') {
                const { time, days } = wf.trigger.config;
                if (time === currentTime && days.includes(currentDay)) {
                    this.executeWorkflow(wf);
                }
            }
        }
    },

    async executeWorkflow(workflow) {
        console.log('[AutomationEngine] 执行工作流:', workflow.name);
        
        for (const action of workflow.actions) {
            try {
                await this.executeAction(action);
            } catch (error) {
                console.error('[AutomationEngine] 动作执行失败:', error);
            }
        }

        // 记录执行日志
        await flowboardDB.put('workflowLogs', {
            id: flowboardDB.generateId('wflog_'),
            workflowId: workflow.id,
            executedAt: Date.now(),
            success: true
        });
    },

    async executeAction(action) {
        switch (action.type) {
            case 'notification':
                NotificationManager.show({
                    title: action.config.title || '自动化通知',
                    body: action.config.body || '',
                    source: '自动化'
                });
                break;
            
            case 'openPage':
                if (action.config.page) {
                    showPage(action.config.page);
                }
                break;
            
            case 'createTask':
                await flowboardDB.put('tasks', {
                    id: flowboardDB.generateId('task_'),
                    title: action.config.title || '自动创建的任务',
                    status: 'todo',
                    createdAt: Date.now()
                });
                break;
            
            case 'generateReview':
                if (window.ReviewSystem) {
                    await ReviewSystem.generateWeeklyReview();
                }
                break;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出
window.AutomationEngine = AutomationEngine;
