/**
 * FlowBoard - 任务看板 (功能3)
 * 拖拽管理、状态流转、计划关联
 */

const TaskBoardUI = {
    columns: [
        { id: 'todo', title: '待办', color: '#6b7280' },
        { id: 'doing', title: '进行中', color: '#3b82f6' },
        { id: 'review', title: '待复盘', color: '#f59e0b' },
        { id: 'done', title: '已完成', color: '#22c55e' }
    ],
    draggedTask: null,
    
    init() {
        this.renderBoard();
        this.loadTasks();
    },

    async loadTasks() {
        const tasks = await flowboardDB.getAll('tasks');
        this.renderTasks(tasks);
    },

    renderBoard() {
        const container = document.getElementById('taskBoard');
        if (!container) return;

        container.innerHTML = this.columns.map(col => `
            <div class="task-column" data-column="${col.id}">
                <div class="task-column-header" style="border-color: ${col.color}">
                    <span class="task-column-title">${col.title}</span>
                    <span class="task-column-count" id="count-${col.id}">0</span>
                </div>
                <div class="task-column-body" data-status="${col.id}"
                     ondragover="TaskBoardUI.onDragOver(event)"
                     ondrop="TaskBoardUI.onDrop(event, '${col.id}')">
                    <!-- 任务卡片 -->
                </div>
                <div class="task-column-footer">
                    <button class="btn-text" onclick="TaskBoardUI.showAddTaskModal('${col.id}')">
                        <i class="fas fa-plus"></i> 添加任务
                    </button>
                </div>
            </div>
        `).join('');
    },

    renderTasks(tasks) {
        // 清空所有列
        this.columns.forEach(col => {
            const body = document.querySelector(`.task-column-body[data-status="${col.id}"]`);
            if (body) body.innerHTML = '';
        });

        // 统计
        const counts = { todo: 0, doing: 0, review: 0, done: 0 };

        tasks.forEach(task => {
            const column = document.querySelector(`.task-column-body[data-status="${task.status}"]`);
            if (column) {
                column.appendChild(this.createTaskCard(task));
                counts[task.status] = (counts[task.status] || 0) + 1;
            }
        });

        // 更新计数
        Object.entries(counts).forEach(([status, count]) => {
            const el = document.getElementById(`count-${status}`);
            if (el) el.textContent = count;
        });
    },

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.draggable = true;
        card.dataset.id = task.id;
        
        const difficultyColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
        const difficultyLabels = { easy: '简单', medium: '中等', hard: '困难' };

        card.innerHTML = `
            <div class="task-card-header">
                <span class="task-tag ${task.difficulty}" 
                      style="background: ${difficultyColors[task.difficulty] || '#6b7280'}20; 
                             color: ${difficultyColors[task.difficulty] || '#6b7280'}">
                    ${difficultyLabels[task.difficulty] || ''}
                </span>
                ${task.planId ? '<span class="task-plan-badge"><i class="fas fa-link"></i> 计划</span>' : ''}
            </div>
            <div class="task-card-title">${this.escapeHtml(task.title)}</div>
            ${task.description ? `<div class="task-card-desc">${this.escapeHtml(task.description.slice(0, 60))}</div>` : ''}
            <div class="task-card-footer">
                <span class="task-card-time">
                    ${task.estimatedHours ? `<i class="fas fa-clock"></i> ${task.estimatedHours}h` : ''}
                </span>
                <div class="task-card-actions">
                    <button onclick="TaskBoardUI.editTask('${task.id}')"><i class="fas fa-edit"></i></button>
                    <button onclick="TaskBoardUI.deleteTask('${task.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;

        card.ondragstart = (e) => this.onDragStart(e, task);
        card.ondragend = () => this.onDragEnd();

        return card;
    },

    onDragStart(e, task) {
        this.draggedTask = task;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    },

    onDragEnd() {
        document.querySelectorAll('.task-card').forEach(c => c.classList.remove('dragging'));
        this.draggedTask = null;
    },

    onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },

    async onDrop(e, newStatus) {
        e.preventDefault();
        if (!this.draggedTask) return;

        if (this.draggedTask.status !== newStatus) {
            this.draggedTask.status = newStatus;
            await flowboardDB.put('tasks', this.draggedTask);
            
            // 同步更新学习计划中的任务状态
            if (this.draggedTask.planId) {
                await this.syncPlanTaskStatus(this.draggedTask);
            }
            
            await this.loadTasks();
        }
    },

    async syncPlanTaskStatus(task) {
        const plan = await flowboardDB.get('learningPlans', task.planId);
        if (plan) {
            for (const stage of plan.stages || []) {
                const t = stage.tasks?.find(t => t.id === task.id);
                if (t) {
                    t.done = task.status === 'done';
                    await flowboardDB.put('learningPlans', plan);
                    break;
                }
            }
        }
    },

    showAddTaskModal(status = 'todo') {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'addTaskModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('addTaskModal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>添加任务</h3>
                    <button class="close-btn" onclick="document.getElementById('addTaskModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>任务标题</label>
                        <input type="text" id="taskTitle" class="form-control" placeholder="输入任务标题">
                    </div>
                    <div class="form-group">
                        <label>描述</label>
                        <textarea id="taskDesc" class="form-control" rows="2" placeholder="可选"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>难度</label>
                            <select id="taskDifficulty" class="form-control">
                                <option value="easy">简单</option>
                                <option value="medium" selected>中等</option>
                                <option value="hard">困难</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>预估耗时(小时)</label>
                            <input type="number" id="taskHours" class="form-control" min="0" step="0.5">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('addTaskModal').remove()">取消</button>
                    <button class="btn-primary" onclick="TaskBoardUI.addTask('${status}')">添加</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async addTask(status) {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) {
            showToast('请输入任务标题');
            return;
        }

        const task = {
            id: flowboardDB.generateId('task_'),
            title,
            description: document.getElementById('taskDesc').value,
            difficulty: document.getElementById('taskDifficulty').value,
            estimatedHours: parseFloat(document.getElementById('taskHours').value) || 0,
            status,
            boardId: 'default',
            createdAt: Date.now()
        };

        await flowboardDB.put('tasks', task);
        document.getElementById('addTaskModal').remove();
        await this.loadTasks();
        showToast('任务已添加');
    },

    async editTask(taskId) {
        const task = await flowboardDB.get('tasks', taskId);
        if (!task) return;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'editTaskModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('editTaskModal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header"><h3>编辑任务</h3></div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>任务标题</label>
                        <input type="text" id="editTaskTitle" class="form-control" value="${this.escapeHtml(task.title)}">
                    </div>
                    <div class="form-group">
                        <label>描述</label>
                        <textarea id="editTaskDesc" class="form-control" rows="2">${this.escapeHtml(task.description || '')}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('editTaskModal').remove()">取消</button>
                    <button class="btn-primary" onclick="TaskBoardUI.saveTask('${taskId}')">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveTask(taskId) {
        const task = await flowboardDB.get('tasks', taskId);
        if (task) {
            task.title = document.getElementById('editTaskTitle').value;
            task.description = document.getElementById('editTaskDesc').value;
            await flowboardDB.put('tasks', task);
            document.getElementById('editTaskModal').remove();
            await this.loadTasks();
        }
    },

    async deleteTask(taskId) {
        if (!confirm('确定删除这个任务吗？')) return;
        await flowboardDB.delete('tasks', taskId);
        await this.loadTasks();
        showToast('任务已删除');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

function initTaskBoard() {
    TaskBoardUI.init();
}

window.TaskBoardUI = TaskBoardUI;
window.initTaskBoard = initTaskBoard;
