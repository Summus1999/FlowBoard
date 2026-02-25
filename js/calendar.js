/**
 * FlowBoard - 日程管理模块
 * 支持日历视图、日程增删改查
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

// 事件类型配置
const eventTypes = {
    work: { name: '工作', color: '#1677FF', icon: 'fas fa-briefcase' },
    study: { name: '学习', color: '#07C160', icon: 'fas fa-book-open' },
    leisure: { name: '休闲', color: '#FF8C00', icon: 'fas fa-coffee' },
    other: { name: '其他', color: '#999', icon: 'fas fa-circle' }
};

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
    
    // 更新标题
    document.getElementById('calendarYear').textContent = year;
    document.getElementById('calendarMonth').textContent = month + 1;
    
    // 获取该月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    // 获取上个月的最后几天
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    const calendarDays = document.getElementById('calendarDays');
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
    
    const dateStr = isOtherMonth ? '' : getDateStrForDay(day);
    dayDiv.onclick = () => selectDate(day, isOtherMonth);
    
    let html = `<span class="day-number">${day}</span>`;
    
    // 显示事件点
    if (events.length > 0) {
        html += '<div class="event-dots">';
        const displayEvents = events.slice(0, 4);
        displayEvents.forEach(event => {
            html += `<span class="event-dot ${event.type}"></span>`;
        });
        html += '</div>';
        
        if (events.length > 4) {
            html += `<span class="more-events">+${events.length - 4}</span>`;
        }
    }
    
    dayDiv.innerHTML = html;
    return dayDiv;
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
    
    dateTitle.textContent = isToday ? '今日日程' : '当日日程';
    dateFull.textContent = formatDateFull(calendarState.selectedDate);
    
    const eventsList = document.getElementById('eventsList');
    
    if (dayEvents.length === 0) {
        eventsList.innerHTML = `
            <div class="events-empty">
                <i class="fas fa-calendar-day"></i>
                <p>暂无日程安排</p>
            </div>
        `;
        return;
    }
    
    eventsList.innerHTML = dayEvents.map(event => {
        const type = eventTypes[event.type] || eventTypes.other;
        return `
            <div class="event-item ${event.type}" onclick="editEvent(${event.id})">
                <div class="event-time">
                    <i class="far fa-clock"></i> ${event.time}
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
    document.getElementById('eventTitleInput').value = '';
    document.getElementById('eventDateInput').value = dateStr;
    document.getElementById('eventTimeInput').value = '09:00';
    document.getElementById('eventDescInput').value = '';
    
    // 重置类型选择
    document.querySelectorAll('.event-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === 'work') {
            btn.classList.add('active');
        }
    });
    
    // 隐藏删除按钮
    document.getElementById('deleteEventBtn').style.display = 'none';
    document.getElementById('eventModalTitle').textContent = '添加日程';
    
    document.getElementById('eventModal').classList.add('active');
}

function closeEventModal() {
    document.getElementById('eventModal').classList.remove('active');
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
    const title = document.getElementById('eventTitleInput').value.trim();
    const date = document.getElementById('eventDateInput').value;
    const time = document.getElementById('eventTimeInput').value;
    const desc = document.getElementById('eventDescInput').value.trim();
    
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
        showToast('日程已更新');
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
        showToast('日程已添加');
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
    
    document.getElementById('eventTitleInput').value = event.title;
    document.getElementById('eventDateInput').value = event.date;
    document.getElementById('eventTimeInput').value = event.time;
    document.getElementById('eventDescInput').value = event.desc || '';
    
    // 更新类型选择
    document.querySelectorAll('.event-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === event.type) {
            btn.classList.add('active');
        }
    });
    
    // 显示删除按钮
    document.getElementById('deleteEventBtn').style.display = 'flex';
    document.getElementById('eventModalTitle').textContent = '编辑日程';
    
    document.getElementById('eventModal').classList.add('active');
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
        showToast('日程已删除');
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
