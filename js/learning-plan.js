/**
 * FlowBoard - 智能学习规划引擎 (功能2)
 * AI 生成学习计划、版本管理、任务同步
 */

const LearningPlanUI = {
    currentPlan: null,
    
    init() {
        this.bindEvents();
        this.loadCurrentPlan();
    },

    bindEvents() {
        setTimeout(() => {
            document.getElementById('btnGeneratePlan')?.addEventListener('click', () => this.showGenerateModal());
            document.getElementById('btnViewVersions')?.addEventListener('click', () => this.showVersionsModal());
        }, 100);
    },

    async loadCurrentPlan() {
        const plans = await flowboardDB.getAll('learningPlans');
        const active = plans.find(p => p.status === 'active');
        
        if (active) {
            this.currentPlan = active;
            this.renderPlan();
        } else {
            this.renderEmptyState();
        }
    },

    renderEmptyState() {
        const container = document.getElementById('learningPlanContent');
        if (!container) return;
        
        container.innerHTML = `
            <div class="plan-empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>暂无学习计划</h3>
                <p>使用 AI 生成个性化的学习计划，让学习更高效</p>
                <button class="btn-primary" onclick="LearningPlanUI.showGenerateModal()">
                    <i class="fas fa-magic"></i> AI 生成计划
                </button>
            </div>
        `;
    },

    renderPlan() {
        const container = document.getElementById('learningPlanContent');
        if (!container || !this.currentPlan) return;

        const plan = this.currentPlan;
        
        container.innerHTML = `
            <div class="plan-header">
                <div class="plan-title-section">
                    <h3>${this.escapeHtml(plan.title)}</h3>
                    <span class="plan-status-badge ${plan.status}">${this.getStatusText(plan.status)}</span>
                </div>
                <div class="plan-actions">
                    <button class="btn-secondary" onclick="LearningPlanUI.showEditModal()">
                        <i class="fas fa-edit"></i> 修改
                    </button>
                    <button class="btn-secondary" onclick="LearningPlanUI.exportPlan()">
                        <i class="fas fa-download"></i> 导出
                    </button>
                </div>
            </div>
            
            <div class="plan-progress-section">
                <div class="plan-progress-bar">
                    <div class="plan-progress-fill" style="width: ${plan.progress || 0}%"></div>
                </div>
                <span class="plan-progress-text">${plan.progress || 0}% 完成</span>
            </div>

            <div class="plan-content">
                ${plan.stages?.map((stage, idx) => `
                    <div class="plan-stage">
                        <div class="plan-stage-header">
                            <span class="plan-stage-number">阶段 ${idx + 1}</span>
                            <h4>${this.escapeHtml(stage.title)}</h4>
                            <span class="plan-stage-duration">${stage.duration}</span>
                        </div>
                        <div class="plan-stage-content">
                            <p>${this.escapeHtml(stage.description)}</p>
                            <div class="plan-stage-tasks">
                                ${stage.tasks?.map(task => `
                                    <div class="plan-task-item">
                                        <input type="checkbox" ${task.done ? 'checked' : ''} 
                                               onchange="LearningPlanUI.toggleTask('${stage.id}', '${task.id}')">
                                        <span class="${task.done ? 'done' : ''}">${this.escapeHtml(task.title)}</span>
                                    </div>
                                `).join('') || ''}
                            </div>
                            <button class="btn-text" onclick="LearningPlanUI.decomposeStage('${stage.id}')">
                                <i class="fas fa-sitemap"></i> AI 拆解任务
                            </button>
                        </div>
                    </div>
                `).join('') || '<p>计划内容为空</p>'}
            </div>
        `;
    },

    showGenerateModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'generatePlanModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('generatePlanModal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-magic"></i> AI 生成学习计划</h3>
                    <button class="close-btn" onclick="document.getElementById('generatePlanModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>学习目标 <span class="required">*</span></label>
                        <textarea id="planGoal" class="form-control" rows="3" 
                            placeholder="例如：三个月内掌握 Go 语言后端开发，能独立开发 REST API 服务"></textarea>
                    </div>
                    <div class="form-group">
                        <label>当前水平</label>
                        <select id="planLevel" class="form-control">
                            <option value="beginner">零基础</option>
                            <option value="elementary">有基础</option>
                            <option value="intermediate">进阶</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>每周可投入时间</label>
                        <input type="range" id="planHours" min="5" max="40" value="10" 
                               oninput="document.getElementById('hoursValue').textContent = this.value + ' 小时'">
                        <span id="hoursValue">10 小时</span>
                    </div>
                    <div class="form-group">
                        <label>截止日期（可选）</label>
                        <input type="date" id="planDeadline" class="form-control">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('generatePlanModal').remove()">取消</button>
                    <button class="btn-primary" onclick="LearningPlanUI.generatePlan()">
                        <i class="fas fa-wand-magic-sparkles"></i> 生成计划
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async generatePlan() {
        const goal = document.getElementById('planGoal').value.trim();
        if (!goal) {
            showToast('请输入学习目标');
            return;
        }

        const level = document.getElementById('planLevel').value;
        const hours = document.getElementById('planHours').value;
        const deadline = document.getElementById('planDeadline').value;

        document.getElementById('generatePlanModal').remove();
        showToast('AI 正在生成学习计划...');

        try {
            const client = llmManager.getClient();
            const prompt = PromptTemplates.learningPlan(goal, level, hours, deadline);
            
            const response = await client.chat([
                { role: 'user', content: prompt }
            ]);

            // 解析 AI 返回的 Markdown 内容
            const plan = this.parsePlanFromMarkdown(response.content, goal);
            
            // 保存计划
            plan.status = 'draft';
            await flowboardDB.put('learningPlans', plan);
            
            this.currentPlan = plan;
            this.showConfirmModal(plan);

        } catch (error) {
            console.error('[LearningPlan] 生成失败:', error);
            showToast('生成计划失败: ' + error.message);
        }
    },

    parsePlanFromMarkdown(markdown, goal) {
        // 简化解析：提取阶段信息
        const stages = [];
        const stageRegex = /##?\s*阶段\s*(\d+)[：:](.+?)\n/g;
        let match;
        
        while ((match = stageRegex.exec(markdown)) !== null) {
            stages.push({
                id: flowboardDB.generateId('stage_'),
                title: match[2].trim(),
                duration: '待定',
                description: '',
                tasks: []
            });
        }

        return {
            id: flowboardDB.generateId('plan_'),
            title: goal.slice(0, 30) + (goal.length > 30 ? '...' : ''),
            goal,
            stages: stages.length > 0 ? stages : [{
                id: flowboardDB.generateId('stage_'),
                title: '默认阶段',
                duration: '待定',
                description: markdown.slice(0, 500),
                tasks: []
            }],
            progress: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    },

    showConfirmModal(plan) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'confirmPlanModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('confirmPlanModal').remove()"></div>
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>计划预览</h3>
                    <button class="close-btn" onclick="document.getElementById('confirmPlanModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="plan-preview">
                        <h4>${this.escapeHtml(plan.title)}</h4>
                        ${plan.stages.map((s, i) => `
                            <div class="plan-preview-stage">
                                <strong>阶段 ${i+1}:</strong> ${this.escapeHtml(s.title)}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('confirmPlanModal').remove()">放弃</button>
                    <button class="btn-primary" onclick="LearningPlanUI.activatePlan()">
                        <i class="fas fa-check"></i> 确认执行
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async activatePlan() {
        document.getElementById('confirmPlanModal').remove();
        
        if (this.currentPlan) {
            // 将其他计划置为 archived
            const plans = await flowboardDB.getAll('learningPlans');
            for (const p of plans) {
                if (p.status === 'active') {
                    p.status = 'archived';
                    await flowboardDB.put('learningPlans', p);
                }
            }
            
            this.currentPlan.status = 'active';
            await flowboardDB.put('learningPlans', this.currentPlan);
            
            // 同步到任务看板
            await this.syncToBoard();
            
            this.renderPlan();
            showToast('学习计划已激活');
        }
    },

    async syncToBoard() {
        // 将计划任务同步到任务看板
        for (const stage of this.currentPlan.stages || []) {
            for (const task of stage.tasks || []) {
                await flowboardDB.put('tasks', {
                    id: flowboardDB.generateId('task_'),
                    title: task.title,
                    description: `${stage.title}: ${task.title}`,
                    status: task.done ? 'done' : 'todo',
                    boardId: 'plan',
                    planId: this.currentPlan.id,
                    createdAt: Date.now()
                });
            }
        }
    },

    async decomposeStage(stageId) {
        const stage = this.currentPlan.stages.find(s => s.id === stageId);
        if (!stage) return;

        showToast('AI 正在拆解任务...');

        try {
            const client = llmManager.getClient();
            const prompt = PromptTemplates.taskDecomposition(stage.title, stage.description, stage.duration);
            
            const response = await client.chat([
                { role: 'user', content: prompt }
            ]);

            // 解析 JSON 任务列表
            let tasks = [];
            try {
                const match = response.content.match(/\[[\s\S]*\]/);
                if (match) {
                    tasks = JSON.parse(match[0]);
                }
            } catch (e) {
                console.error('解析任务失败:', e);
            }

            stage.tasks = tasks.map(t => ({
                id: flowboardDB.generateId('task_'),
                title: t.title,
                description: t.description,
                estimatedHours: t.estimatedHours,
                difficulty: t.difficulty,
                done: false
            }));

            await flowboardDB.put('learningPlans', this.currentPlan);
            this.renderPlan();
            showToast('任务拆解完成');

        } catch (error) {
            showToast('拆解失败: ' + error.message);
        }
    },

    async toggleTask(stageId, taskId) {
        const stage = this.currentPlan.stages.find(s => s.id === stageId);
        const task = stage?.tasks.find(t => t.id === taskId);
        if (task) {
            task.done = !task.done;
            await flowboardDB.put('learningPlans', this.currentPlan);
            this.renderPlan();
        }
    },

    getStatusText(status) {
        const map = { draft: '草稿', active: '执行中', archived: '已归档' };
        return map[status] || status;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

function initLearningPlan() {
    LearningPlanUI.init();
}

window.LearningPlanUI = LearningPlanUI;
window.initLearningPlan = initLearningPlan;
