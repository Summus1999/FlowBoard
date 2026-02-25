/**
 * FlowBoard - 个人提升计划模块
 * 支持 Markdown/PDF 导入和定时提醒
 */

// ========================================
// 全局状态
// ========================================

let growthState = {
    planContent: localStorage.getItem('growth_plan_content') || '',
    reminders: JSON.parse(localStorage.getItem('growth_reminders') || '[]'),
    studyStats: JSON.parse(localStorage.getItem('growth_study_stats') || '{"week": 0, "month": 0, "streak": 0}')
};

// 预设模板
const growthTemplates = {
    frontend: `# 前端开发进阶计划

## 第一阶段：基础巩固 (2周)

### HTML/CSS
- [ ] 语义化标签掌握
- [ ] Flexbox 布局实战
- [ ] Grid 布局实战
- [ ] 响应式设计原理

### JavaScript
- [ ] ES6+ 新特性
- [ ] 闭包与作用域
- [ ] 原型与继承
- [ ] 异步编程 (Promise/async-await)

## 第二阶段：框架学习 (3周)

### React
- [ ] 组件化思想
- [ ] Hooks 深入理解
- [ ] 状态管理 (Redux/Zustand)
- [ ] 性能优化

### Vue
- [ ] 响应式原理
- [ ] Composition API
- [ ] Pinia 状态管理

## 第三阶段：工程化 (2周)
- [ ] Webpack/Vite 配置
- [ ] CI/CD 流程
- [ ] 单元测试
- [ ] 性能监控

## 每日学习安排
- **上午 9:00-11:00**: 理论学习
- **下午 14:00-17:00**: 实战练习
- **晚上 20:00-21:00**: 复盘总结`,

    algorithm: `# 算法训练计划

## 数组与字符串
- [ ] 两数之和
- [ ] 三数之和
- [ ] 滑动窗口技巧
- [ ] 前缀和应用

## 链表
- [ ] 反转链表
- [ ] 合并有序链表
- [ ] 环形链表检测
- [ ] LRU 缓存

## 树与图
- [ ] 二叉树遍历
- [ ] 二叉搜索树
- [ ] 图的 BFS/DFS
- [ ] 最短路径算法

## 动态规划
- [ ] 斐波那契数列
- [ ] 背包问题
- [ ] 最长子序列
- [ ] 股票买卖问题

## 每日目标
- 每天至少 2 道题
- 理解解题思路
- 总结类似题目`,

    system: `# 系统设计学习计划

## 基础概念
- [ ] CAP 定理
- [ ] 一致性模型
- [ ] 负载均衡
- [ ] 缓存策略

## 数据库
- [ ] 索引设计
- [ ] 分库分表
- [ ] 读写分离
- [ ] NoSQL 应用

## 微服务
- [ ] 服务拆分
- [ ] 服务发现
- [ ] 熔断降级
- [ ] 链路追踪

## 实战项目
- [ ] 设计短链接系统
- [ ] 设计即时通讯系统
- [ ] 设计推荐系统

## 推荐资源
- 《Designing Data-Intensive Applications》
- System Design Primer (GitHub)`
};

// ========================================
// 初始化
// ========================================

function initGrowth() {
    // 如果有保存的计划，显示它
    if (growthState.planContent) {
        renderGrowthPlan(growthState.planContent);
    }
    
    // 更新统计数据
    updateGrowthStats();
    
    // 初始化提醒
    initGrowthReminders();
}

// ========================================
// 文件导入
// ========================================

function handlePlanFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    if (file.name.endsWith('.pdf')) {
        // PDF 文件处理（简化版，实际需要 PDF.js 库）
        showToast('PDF 解析需要额外支持，请先转换为 Markdown');
        return;
    } else {
        // Markdown 或文本文件
        reader.onload = function(e) {
            const content = e.target.result;
            growthState.planContent = content;
            localStorage.setItem('growth_plan_content', content);
            renderGrowthPlan(content);
            showToast('计划导入成功');
        };
        reader.readAsText(file);
    }
}

function loadGrowthTemplate(type) {
    const template = growthTemplates[type];
    if (template) {
        growthState.planContent = template;
        localStorage.setItem('growth_plan_content', template);
        renderGrowthPlan(template);
        showToast('模板加载成功');
    }
}

// ========================================
// 渲染计划
// ========================================

function renderGrowthPlan(content) {
    const viewer = document.getElementById('growthPlanViewer');
    
    // 简单 Markdown 渲染
    const html = markdownToHtml(content);
    
    viewer.innerHTML = `
        <div class="growth-content">
            ${html}
        </div>
    `;
}

function markdownToHtml(markdown) {
    return markdown
        // 标题
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // 复选框
        .replace(/\[ \] (.*)/g, '<label class="checklist-item"><input type="checkbox"> <span>$1</span></label>')
        .replace(/\[x\] (.*)/gi, '<label class="checklist-item"><input type="checkbox" checked> <span>$1</span></label>')
        // 加粗
        .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
        // 斜体
        .replace(/\*(.*)\*/g, '<em>$1</em>')
        // 代码
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 列表项
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        // 段落
        .replace(/\n\n/g, '</p><p>')
        // 包装
        .replace(/^(.+)$/gim, '<p>$1</p>')
        // 清理空标签
        .replace(/<p><\/p>/g, '');
}

// ========================================
// 提醒功能
// ========================================

function openGrowthReminderModal() {
    document.getElementById('growthReminderModal').classList.add('active');
}

function closeGrowthReminderModal() {
    document.getElementById('growthReminderModal').classList.remove('active');
}

function saveGrowthReminder() {
    const time = document.getElementById('growthReminderTime').value;
    const content = document.getElementById('growthReminderContent').value;
    const notificationEnabled = document.getElementById('growthNotificationToggle').checked;
    
    if (!time || !content) {
        showToast('请填写完整信息');
        return;
    }
    
    const reminder = {
        id: Date.now(),
        time,
        content,
        notificationEnabled,
        days: getSelectedDays(),
        enabled: true
    };
    
    growthState.reminders.push(reminder);
    localStorage.setItem('growth_reminders', JSON.stringify(growthState.reminders));
    
    // 设置提醒
    scheduleReminder(reminder);
    
    showToast('提醒设置已保存');
    closeGrowthReminderModal();
    updateReminderList();
}

function getSelectedDays() {
    const checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const selected = [];
    
    checkboxes.forEach((cb, index) => {
        if (cb.checked) {
            selected.push(days[index]);
        }
    });
    
    return selected;
}

function scheduleReminder(reminder) {
    // 这里使用简单的定时器，实际应用中应该使用更精确的调度
    const now = new Date();
    const [hours, minutes] = reminder.time.split(':');
    
    let nextTime = new Date();
    nextTime.setHours(parseInt(hours), parseInt(minutes), 0);
    
    if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
    }
    
    const delay = nextTime - now;
    
    setTimeout(() => {
        if (reminder.enabled && reminder.notificationEnabled) {
            showNotification('学习提醒', reminder.content);
        }
    }, delay);
}

function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
    } else {
        showToast(`${title}: ${body}`);
    }
}

function initGrowthReminders() {
    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // 重新调度所有提醒
    growthState.reminders.forEach(reminder => {
        if (reminder.enabled) {
            scheduleReminder(reminder);
        }
    });
    
    updateReminderList();
}

function updateReminderList() {
    const list = document.getElementById('growthReminderList');
    if (!list || growthState.reminders.length === 0) return;
    
    // 显示前两个提醒
    const reminders = growthState.reminders.slice(0, 2);
    
    list.innerHTML = reminders.map(r => `
        <div class="reminder-item">
            <i class="fas fa-clock"></i>
            <span>${r.time} - ${r.content}</span>
        </div>
    `).join('');
}

// ========================================
// 统计功能
// ========================================

function updateGrowthStats() {
    // 这里可以从实际学习记录中计算
    // 简化版：使用模拟数据
    document.getElementById('growthWeekHours').textContent = '12 小时';
    document.getElementById('growthMonthHours').textContent = '48 小时';
    document.getElementById('growthStreak').textContent = '5 天';
}

console.log('个人提升计划模块已加载 📈');
