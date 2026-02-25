/**
 * FlowBoard - 日程管理模块 - 炫酷升级版
 * 支持日历视图、日程增删改查、粒子动效
 */

// ========================================
// 全局状态
// ========================================

let calendarState = {
    currentDate: new Date(),
    selectedDate: new Date(),
    events: [],
    editingEventId: null,
    selectedEventType: 'work'
};

// 事件类型配置 - 升级配色
const eventTypes = {
    work: { name: '工作', color: '#3b82f6', icon: 'fas fa-briefcase', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
    study: { name: '学习', color: '#22c55e', icon: 'fas fa-book-open', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)' },
    leisure: { name: '休闲', color: '#f59e0b', icon: 'fas fa-coffee', gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    other: { name: '其他', color: '#9ca3af', icon: 'fas fa-circle', gradient: 'linear-gradient(135deg, #9ca3af, #d1d5db)' }
};

// 粒子系统配置
let particleCanvas = null;
let particleCtx = null;
let particles = [];
let animationId = null;

// ========================================
// 初始化
// ========================================

function initCalendar() {
    loadEventsFromStorage();
    
    // 如果没有事件，添加示例事件
    if (calendarState.events.length === 0) {
        addSampleEvents();
    }
    
    renderCalendar();
    renderEventsList();
    initParticleEffect();
}

// ========================================
// 粒子动效系统
// ========================================

function initParticleEffect() {
    // 为日历主区域添加粒子画布
    const calendarMain = document.querySelector('.calendar-main');
    if (!calendarMain || calendarMain.querySelector('.particle-canvas')) return;
    
    particleCanvas = document.createElement('canvas');
    particleCanvas.className = 'particle-canvas';
    particleCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        opacity: 0.4;
    `;
    calendarMain.style.position = 'relative';
    calendarMain.insertBefore(particleCanvas, calendarMain.firstChild);
    
    particleCtx = particleCanvas.getContext('2d');
    resizeParticleCanvas();
    
    // 创建粒子
    createParticles();
    
    // 开始动画
    animateParticles();
    
    // 监听窗口大小变化
    window.addEventListener('resize', resizeParticleCanvas);
}

function resizeParticleCanvas() {
    if (!particleCanvas) return;
    const rect = particleCanvas.parentElement.getBoundingClientRect();
    particleCanvas.width = rect.width;
    particleCanvas.height = rect.height;
}

function createParticles() {
    particles = [];
    const particleCount = 25;
    
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * particleCanvas.width,
            y: Math.random() * particleCanvas.height,
            size: Math.random() * 3 + 1,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            opacity: Math.random() * 0.5 + 0.2,
            color: `rgba(59, 130, 246, ${Math.random() * 0.5 + 0.2})`
        });
    }
}

function animateParticles() {
    if (!particleCtx || !particleCanvas) return;
    
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    
    particles.forEach((particle, index) => {
        // 更新位置
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // 边界检查
        if (particle.x < 0 || particle.x > particleCanvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > particleCanvas.height) particle.speedY *= -1;
        
        // 绘制粒子
        particleCtx.beginPath();
        particleCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        particleCtx.fillStyle = particle.color;
        particleCtx.fill();
        
        // 绘制连线
        particles.slice(index + 1).forEach(other => {
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 100) {
                particleCtx.beginPath();
                particleCtx.moveTo(particle.x, particle.y);
                particleCtx.lineTo(other.x, other.y);
                particleCtx.strokeStyle = `rgba(59, 130, 246, ${0.15 * (1 - distance / 100)})`;
                particleCtx.lineWidth = 0.5;
                particleCtx.stroke();
            }
        });
    });
    
    animationId = requestAnimationFrame(animateParticles);
}

function destroyParticleEffect() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (particleCanvas) {
        particleCanvas.remove();
        particleCanvas = null;
    }
    particles = [];
}

function addSampleEvents() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    calendarState.events = [
        {
            id: Date.now(),
            title: '项目进度会议',
            date: formatDateISO(today),
            time: '10:00',
            type: 'work',
            desc: '与团队讨论本周项目进度'
        },
        {
            id: Date.now() + 1,
            title: '健身运动',
            date: formatDateISO(today),
            time: '18:00',
            type: 'study',
            desc: '去健身房锻炼1小时'
        },
        {
            id: Date.now() + 2,
            title: '提交月度报告',
            date: formatDateISO(tomorrow),
            time: '17:00',
            type: 'leisure',
            desc: '记得提交本月的月度工作报告'
        }
    ];
    
    saveEventsToStorage();
}

// ========================================
// 数据持久化
// ========================================

function loadEventsFromStorage() {
    try {
        const stored = localStorage.getItem('flowboard_events');
        if (stored) {
            calendarState.events = JSON.parse(stored);
        }
    } catch (error) {
        console.error('加载日程失败:', error);
        calendarState.events = [];
    }
}

function saveEventsToStorage() {
    try {
        localStorage.setItem('flowboard_events', JSON.stringify(calendarState.events));
    } catch (error) {
        console.error('保存日程失败:', error);
    }
}

// ========================================
// 日历渲染
// ========================================

function renderCalendar() {
    const year = calendarState.currentDate.getFullYear();
    const month = calendarState.currentDate.getMonth();
    
    // 更新标题 - 带动画效果
    const yearEl = document.getElementById('calendarYear');
    const monthEl = document.getElementById('calendarMonth');
    
    if (yearEl && monthEl) {
        animateNumberChange(yearEl, year);
        animateNumberChange(monthEl, month + 1);
    }
    
    // 获取该月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    // 获取上个月的最后几天
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const calendarDays = document.getElementById('calendarDays');
    if (!calendarDays) return;
    calendarDays.innerHTML = '';
    
    // 上个月的日期
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayDiv = createDayElement(prevMonthLastDay - i, true);
        calendarDays.appendChild(dayDiv);
    }
    
    // 当月的日期
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = formatDateISO(new Date(year, month, day));
        const isToday = today.getFullYear() === year && 
                       today.getMonth() === month && 
                       today.getDate() === day;
        const isSelected = calendarState.selectedDate.getFullYear() === year &&
                          calendarState.selectedDate.getMonth() === month &&
                          calendarState.selectedDate.getDate() === day;
        
        const dayEvents = calendarState.events.filter(e => e.date === dateStr);
        const dayDiv = createDayElement(day, false, isToday, isSelected, dayEvents);
        calendarDays.appendChild(dayDiv);
    }
    
    // 下个月的日期（填满网格）
    const remainingCells = 42 - (startDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = createDayElement(day, true);
        calendarDays.appendChild(dayDiv);
    }
}

function createDayElement(day, isOtherMonth, isToday = false, isSelected = false, events = []) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    if (isOtherMonth) dayDiv.classList.add('other-month');
    if (isToday) dayDiv.classList.add('today');
    if (isSelected) dayDiv.classList.add('selected');
    
    // 添加延迟动画
    const delay = Math.random() * 0.3;
    dayDiv.style.animation = `fadeInUp 0.5s ease ${delay}s both`;
    
    const dateStr = isOtherMonth ? '' : getDateStrForDay(day);
    dayDiv.onclick = () => selectDate(day, isOtherMonth);
    
    let html = `<span class="day-number">${day}</span>`;
    
    // 显示事件点 - 带发光效果
    if (events.length > 0) {
        html += '<div class="event-dots">';
        const displayEvents = events.slice(0, 4);
        displayEvents.forEach((event, index) => {
            const delay = index * 0.1;
            html += `<span class="event-dot ${event.type}" style="animation: fadeInUp 0.3s ease ${delay}s both"></span>`;
        });
        html += '</div>';
        
        if (events.length > 4) {
            html += `<span class="more-events">+${events.length - 4}</span>`;
        }
    }
    
    dayDiv.innerHTML = html;
    return dayDiv;
}

// 数字变化动画
function animateNumberChange(element, newValue) {
    const oldValue = parseInt(element.textContent) || 0;
    if (oldValue === newValue) {
        element.textContent = newValue;
        return;
    }
    
    element.style.transform = 'scale(0.8)';
    element.style.opacity = '0';
    
    setTimeout(() => {
        element.textContent = newValue;
        element.style.transform = 'scale(1)';
        element.style.opacity = '1';
    }, 150);
}

function getDateStrForDay(day) {
    const year = calendarState.currentDate.getFullYear();
    const month = calendarState.currentDate.getMonth();
    return formatDateISO(new Date(year, month, day));
}

// ========================================
// 日期选择
// ========================================

function selectDate(day, isOtherMonth) {
    if (isOtherMonth) return;
    
    const year = calendarState.currentDate.getFullYear();
    const month = calendarState.currentDate.getMonth();
    calendarState.selectedDate = new Date(year, month, day);
    
    renderCalendar();
    renderEventsList();
}

function changeMonth(delta) {
    calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + delta);
    renderCalendar();
}

// ========================================
// 事件列表渲染
// ========================================

function renderEventsList() {
    const dateStr = formatDateISO(calendarState.selectedDate);
    const dayEvents = calendarState.events
        .filter(e => e.date === dateStr)
        .sort((a, b) => a.time.localeCompare(b.time));
    
    // 更新标题
    const dateTitle = document.getElementById('selectedDateTitle');
    const dateFull = document.getElementById('selectedDateFull');
    const today = new Date();
    const isToday = formatDateISO(today) === dateStr;
    
    if (dateTitle) dateTitle.textContent = isToday ? '今日日程' : '当日日程';
    if (dateFull) dateFull.textContent = formatDateFull(calendarState.selectedDate);
    
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    if (dayEvents.length === 0) {
        eventsList.innerHTML = `
            <div class="events-empty">
                <i class="fas fa-calendar-day"></i>
                <p>暂无日程安排</p>
            </div>
        `;
        return;
    }
    
    eventsList.innerHTML = dayEvents.map((event, index) => {
        const type = eventTypes[event.type] || eventTypes.other;
        const delay = index * 0.1;
        return `
            <div class="event-item ${event.type}" onclick="editEvent(${event.id})" style="animation: fadeInRight 0.4s ease ${delay}s both">
                <div class="event-time">
                    <i class="far fa-clock" style="color: ${type.color}"></i> ${event.time}
                </div>
                <div class="event-title">${escapeHtml(event.title)}</div>
                ${event.desc ? `<div class="event-desc">${escapeHtml(event.desc)}</div>` : ''}
            </div>
        `;
    }).join('');
}

// ========================================
// 事件操作
// ========================================

function openEventModal() {
    calendarState.editingEventId = null;
    calendarState.selectedEventType = 'work';
    
    // 填充默认日期
    const dateStr = formatDateISO(calendarState.selectedDate);
    const titleInput = document.getElementById('eventTitleInput');
    const dateInput = document.getElementById('eventDateInput');
    const timeInput = document.getElementById('eventTimeInput');
    const descInput = document.getElementById('eventDescInput');
    
    if (titleInput) titleInput.value = '';
    if (dateInput) dateInput.value = dateStr;
    if (timeInput) timeInput.value = '09:00';
    if (descInput) descInput.value = '';
    
    // 重置类型选择
    document.querySelectorAll('.event-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === 'work') {
            btn.classList.add('active');
        }
    });
    
    // 隐藏删除按钮
    const deleteBtn = document.getElementById('deleteEventBtn');
    const modalTitle = document.getElementById('eventModalTitle');
    const modal = document.getElementById('eventModal');
    
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (modalTitle) modalTitle.textContent = '添加日程';
    if (modal) modal.classList.add('active');
}

function closeEventModal() {
    const modal = document.getElementById('eventModal');
    if (modal) modal.classList.remove('active');
    calendarState.editingEventId = null;
}

function selectEventType(type) {
    calendarState.selectedEventType = type;
    document.querySelectorAll('.event-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });
}

function saveEvent() {
    const titleInput = document.getElementById('eventTitleInput');
    const dateInput = document.getElementById('eventDateInput');
    const timeInput = document.getElementById('eventTimeInput');
    const descInput = document.getElementById('eventDescInput');
    
    const title = titleInput ? titleInput.value.trim() : '';
    const date = dateInput ? dateInput.value : '';
    const time = timeInput ? timeInput.value : '';
    const desc = descInput ? descInput.value.trim() : '';
    
    if (!title) {
        showToast('请输入日程标题');
        return;
    }
    if (!date) {
        showToast('请选择日期');
        return;
    }
    
    if (calendarState.editingEventId) {
        // 编辑模式
        const event = calendarState.events.find(e => e.id === calendarState.editingEventId);
        if (event) {
            event.title = title;
            event.date = date;
            event.time = time;
            event.type = calendarState.selectedEventType;
            event.desc = desc;
        }
        showToast('日程已更新 ✨');
    } else {
        // 添加模式
        const newEvent = {
            id: Date.now(),
            title,
            date,
            time,
            type: calendarState.selectedEventType,
            desc
        };
        calendarState.events.push(newEvent);
        showToast('日程已添加 ✨');
    }
    
    saveEventsToStorage();
    renderCalendar();
    renderEventsList();
    closeEventModal();
}

function editEvent(id) {
    const event = calendarState.events.find(e => e.id === id);
    if (!event) return;
    
    calendarState.editingEventId = id;
    calendarState.selectedEventType = event.type;
    
    const titleInput = document.getElementById('eventTitleInput');
    const dateInput = document.getElementById('eventDateInput');
    const timeInput = document.getElementById('eventTimeInput');
    const descInput = document.getElementById('eventDescInput');
    
    if (titleInput) titleInput.value = event.title;
    if (dateInput) dateInput.value = event.date;
    if (timeInput) timeInput.value = event.time;
    if (descInput) descInput.value = event.desc || '';
    
    // 更新类型选择
    document.querySelectorAll('.event-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === event.type) {
            btn.classList.add('active');
        }
    });
    
    // 显示删除按钮
    const deleteBtn = document.getElementById('deleteEventBtn');
    const modalTitle = document.getElementById('eventModalTitle');
    const modal = document.getElementById('eventModal');
    
    if (deleteBtn) deleteBtn.style.display = 'flex';
    if (modalTitle) modalTitle.textContent = '编辑日程';
    if (modal) modal.classList.add('active');
}

function deleteCurrentEvent() {
    if (!calendarState.editingEventId) return;
    
    if (!confirm('确定要删除这个日程吗？')) return;
    
    const index = calendarState.events.findIndex(e => e.id === calendarState.editingEventId);
    if (index > -1) {
        calendarState.events.splice(index, 1);
        saveEventsToStorage();
        renderCalendar();
        renderEventsList();
        closeEventModal();
        showToast('日程已删除 🗑️');
    }
}

// ========================================
// 工具函数
// ========================================

function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateFull(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日 ${weekday}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('日程管理模块已加载 📅');
