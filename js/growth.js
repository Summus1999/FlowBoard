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
    studyRecords: JSON.parse(localStorage.getItem('growth_study_records') || '[]'),
    isStudying: false,
    studyStartTime: null,
    studyTimer: null
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
    
    if (file.name.endsWith('.pdf')) {
        // PDF 文件处理
        parseAndImportPDF(file);
    } else {
        // Markdown 或文本文件
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            importPlanContent(content, file.name);
        };
        reader.readAsText(file);
    }
}

// 导入学习计划内容
function importPlanContent(content, filename) {
    growthState.planContent = content;
    localStorage.setItem('growth_plan_content', content);
    renderGrowthPlan(content);
    showToast(`计划导入成功：${filename || '文件'}`);
    
    // 记录导入行为（算作5分钟学习）
    saveStudyRecord(5, 'planning');
}

// 解析并导入PDF文件
async function parseAndImportPDF(file) {
    // 检查 PDF.js 是否可用
    if (typeof pdfjsLib === 'undefined') {
        showToast('PDF 库未加载，请检查网络连接');
        return;
    }
    
    showToast('正在解析 PDF 文件...');
    
    try {
        // 设置 PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        const totalPages = pdf.numPages;
        
        // 遍历所有页面提取文本
        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
            
            // 释放页面资源
            page.cleanup();
        }
        
        // 尝试将文本转换为 Markdown 格式
        const markdownContent = convertTextToMarkdown(fullText, file.name);
        
        importPlanContent(markdownContent, file.name);
        
    } catch (error) {
        console.error('PDF 解析失败:', error);
        showToast('PDF 解析失败：' + (error.message || '未知错误'));
    }
}

// 将纯文本转换为 Markdown 格式（简单的启发式转换）
function convertTextToMarkdown(text, filename) {
    let lines = text.split('\n').map(line => line.trim()).filter(line => line);
    let markdown = `# ${filename.replace('.pdf', '')}\n\n`;
    
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] || '';
        
        // 检测标题（全大写、以数字开头、或下一行是短横线）
        if (/^\d+\.\s+/.test(line)) {
            // 数字编号标题
            const title = line.replace(/^\d+\.\s*/, '');
            markdown += `## ${title}\n\n`;
        } else if (/^[A-Z][A-Z\s]+$/.test(line) && line.length > 3 && line.length < 50) {
            // 全大写标题
            markdown += `## ${line}\n\n`;
        } else if (nextLine.startsWith('---') || nextLine.startsWith('===')) {
            // Markdown 风格的标题下划线
            markdown += `## ${line}\n\n`;
            i++; // 跳过下划线行
        } else if (line.startsWith('•') || line.startsWith('●') || line.startsWith('○')) {
            // 项目符号列表
            markdown += `- ${line.substring(1).trim()}\n`;
            inList = true;
        } else if (/^\d+\.\s/.test(line)) {
            // 有序列表
            markdown += `${line}\n`;
            inList = true;
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            // 已经是 Markdown 列表
            markdown += `${line}\n`;
            inList = true;
        } else {
            // 普通段落
            if (inList) {
                markdown += '\n';
                inList = false;
            }
            markdown += `${line}\n\n`;
        }
    }
    
    // 添加导入时间戳
    markdown += `\n---\n\n`;
    markdown += `*导入时间：${new Date().toLocaleString('zh-CN')}*`;
    
    return markdown;
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
// 学习记录与统计功能
// ========================================

// 保存学习记录
function saveStudyRecord(durationMinutes, category = 'general') {
    const record = {
        id: Date.now(),
        date: new Date().toISOString(),
        duration: durationMinutes,
        category: category
    };
    
    growthState.studyRecords.push(record);
    localStorage.setItem('growth_study_records', JSON.stringify(growthState.studyRecords));
    updateGrowthStats();
    updateSkillProgress(durationMinutes);
}

// 计算本周学习时长
function getWeekStudyHours() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekRecords = growthState.studyRecords.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= weekStart;
    });
    
    const totalMinutes = weekRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    return Math.round(totalMinutes / 60 * 10) / 10; // 保留一位小数
}

// 计算本月学习时长
function getMonthStudyHours() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthRecords = growthState.studyRecords.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= monthStart;
    });
    
    const totalMinutes = monthRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    return Math.round(totalMinutes / 60 * 10) / 10; // 保留一位小数
}

// 计算连续打卡天数
function getStreakDays() {
    if (growthState.studyRecords.length === 0) return 0;
    
    // 按日期分组，获取有学习记录的所有日期
    const studyDates = new Set();
    growthState.studyRecords.forEach(record => {
        const date = new Date(record.date).toDateString();
        studyDates.add(date);
    });
    
    const sortedDates = Array.from(studyDates).map(d => new Date(d)).sort((a, b) => b - a);
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 检查今天或昨天是否有记录
    const latestDate = sortedDates[0];
    latestDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today - latestDate) / (1000 * 60 * 60 * 24));
    
    // 如果最近学习是昨天或今天，开始计算连续天数
    if (diffDays <= 1) {
        streak = 1;
        
        for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(sortedDates[i - 1]);
            const currDate = new Date(sortedDates[i]);
            
            prevDate.setHours(0, 0, 0, 0);
            currDate.setHours(0, 0, 0, 0);
            
            const dayDiff = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));
            
            if (dayDiff === 1) {
                streak++;
            } else {
                break;
            }
        }
    }
    
    return streak;
}

// 更新技能进度（基于学习时长增加进度）
function updateSkillProgress(durationMinutes) {
    const skillBars = document.querySelectorAll('.skill-item');
    
    skillBars.forEach(skillItem => {
        const progressBar = skillItem.querySelector('.skill-progress');
        const percentText = skillItem.querySelector('.skill-percent');
        
        if (progressBar && percentText) {
            let currentPercent = parseInt(percentText.textContent) || 0;
            // 每学习30分钟增加1%进度，最多到100%
            const increment = Math.floor(durationMinutes / 30);
            const newPercent = Math.min(100, currentPercent + increment);
            
            progressBar.style.width = newPercent + '%';
            percentText.textContent = newPercent + '%';
        }
    });
}

// 更新统计UI
function updateGrowthStats() {
    const weekHours = getWeekStudyHours();
    const monthHours = getMonthStudyHours();
    const streak = getStreakDays();
    
    const weekEl = document.getElementById('growthWeekHours');
    const monthEl = document.getElementById('growthMonthHours');
    const streakEl = document.getElementById('growthStreak');
    
    if (weekEl) weekEl.textContent = weekHours + ' 小时';
    if (monthEl) monthEl.textContent = monthHours + ' 小时';
    if (streakEl) streakEl.textContent = streak + ' 天';
}

// 开始学习计时
function startStudyTimer() {
    if (growthState.isStudying) return;
    
    growthState.isStudying = true;
    growthState.studyStartTime = Date.now();
    
    // 更新UI
    updateStudyTimerUI();
    
    // 每秒更新显示
    growthState.studyTimer = setInterval(() => {
        updateStudyTimerDisplay();
    }, 1000);
    
    showToast('开始学习计时，加油！');
}

// 停止学习计时并保存记录
function stopStudyTimer(category = 'general') {
    if (!growthState.isStudying) return;
    
    clearInterval(growthState.studyTimer);
    
    const duration = Math.floor((Date.now() - growthState.studyStartTime) / 60000); // 分钟
    
    if (duration >= 1) { // 至少学习1分钟才记录
        saveStudyRecord(duration, category);
        showToast(`本次学习 ${duration} 分钟，已记录！`);
    } else {
        showToast('学习时间太短，未记录');
    }
    
    growthState.isStudying = false;
    growthState.studyStartTime = null;
    growthState.studyTimer = null;
    
    // 重置UI
    updateStudyTimerUI();
}

// 切换学习计时状态
function toggleStudyTimer() {
    if (growthState.isStudying) {
        stopStudyTimer();
    } else {
        startStudyTimer();
    }
}

// 更新学习计时UI
function updateStudyTimerUI() {
    const btn = document.getElementById('studyTimerBtn');
    const display = document.getElementById('studyTimerDisplay');
    
    if (!btn || !display) return;
    
    if (growthState.isStudying) {
        btn.innerHTML = '<i class="fas fa-stop"></i> 停止学习';
        btn.classList.add('recording');
        display.style.display = 'block';
    } else {
        btn.innerHTML = '<i class="fas fa-play"></i> 开始学习';
        btn.classList.remove('recording');
        display.style.display = 'none';
        display.textContent = '00:00';
    }
}

// 更新计时显示
function updateStudyTimerDisplay() {
    const display = document.getElementById('studyTimerDisplay');
    if (!display || !growthState.isStudying) return;
    
    const elapsed = Math.floor((Date.now() - growthState.studyStartTime) / 1000); // 秒
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 手动添加学习记录
function addManualStudyRecord() {
    const minutes = prompt('请输入学习时长（分钟）：', '30');
    if (minutes && !isNaN(minutes)) {
        addStudyRecord(parseInt(minutes));
    }
}

// 添加学习记录（手动添加）
function addStudyRecord(durationMinutes, category = 'general') {
    if (durationMinutes > 0) {
        saveStudyRecord(durationMinutes, category);
        showToast(`已添加 ${durationMinutes} 分钟学习记录`);
    }
}

// 获取学习记录历史
function getStudyHistory(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return growthState.studyRecords
        .filter(r => new Date(r.date) >= cutoff)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// 清除所有学习记录（调试用）
function clearStudyRecords() {
    if (confirm('确定要清除所有学习记录吗？')) {
        growthState.studyRecords = [];
        localStorage.removeItem('growth_study_records');
        updateGrowthStats();
        showToast('学习记录已清除');
    }
}

console.log('个人提升计划模块已加载 📈');
