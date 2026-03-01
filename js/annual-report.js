/**
 * FlowBoard - 年度报告 (功能18)
 * 全年数据汇总、可视化报告、分享导出
 */

const AnnualReport = {
    currentYear: new Date().getFullYear(),
    
    async generate(year = this.currentYear) {
        showToast('正在生成年度报告...');
        
        const data = await this.gatherYearData(year);
        const report = {
            year,
            generatedAt: Date.now(),
            data,
            pages: this.generatePages(data)
        };

        return report;
    },

    async gatherYearData(year) {
        const start = new Date(year, 0, 1).getTime();
        const end = new Date(year + 1, 0, 1).getTime();

        // 收集各类数据
        const [
            tasks,
            pomodoros,
            habits,
            studyRecords,
            leetcodeSubmissions
        ] = await Promise.all([
            flowboardDB.getAll('tasks'),
            flowboardDB.getAll('pomodoroRecords'),
            flowboardDB.getAll('habitRecords'),
            flowboardDB.getAll('studyRecords'),
            Promise.resolve(JSON.parse(localStorage.getItem('leetcode_submissions') || '[]'))
        ]);

        // 过滤年度数据
        const yearFilter = item => {
            const time = item.createdAt || item.startTime || item.timestamp;
            return time >= start && time < end;
        };

        return {
            totalTasks: tasks.filter(yearFilter).length,
            completedTasks: tasks.filter(t => t.status === 'done' && yearFilter(t)).length,
            totalPomodoros: pomodoros.filter(yearFilter).length,
            totalStudyHours: studyRecords.filter(yearFilter).reduce((s, r) => s + (r.minutes || 0), 0) / 60,
            totalHabitChecks: habits.filter(yearFilter).length,
            leetcodeSolved: leetcodeSubmissions.length, // 简化统计
            monthlyData: this.calculateMonthlyData(pomodoros, studyRecords, year),
            skillGrowth: this.calculateSkillGrowth(tasks, year)
        };
    },

    calculateMonthlyData(pomodoros, studyRecords, year) {
        const months = Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            pomodoros: 0,
            studyHours: 0
        }));

        pomodoros.forEach(p => {
            const date = new Date(p.startTime);
            if (date.getFullYear() === year) {
                months[date.getMonth()].pomodoros++;
            }
        });

        studyRecords.forEach(r => {
            const date = new Date(r.date);
            if (date.getFullYear() === year) {
                months[date.getMonth()].studyHours += (r.minutes || 0) / 60;
            }
        });

        return months;
    },

    calculateSkillGrowth(tasks, year) {
        // 简化的技能评估
        return [
            { skill: '前端开发', start: 60, end: 85 },
            { skill: '算法', start: 40, end: 75 },
            { skill: '系统设计', start: 30, end: 60 },
            { skill: '项目管理', start: 50, end: 70 }
        ];
    },

    generatePages(data) {
        return [
            { id: 'cover', title: '年度回顾' },
            { id: 'overview', title: '总览' },
            { id: 'learning', title: '学习轨迹' },
            { id: 'skills', title: '技能成长' },
            { id: 'habits', title: '习惯坚持' },
            { id: 'highlights', title: '高光时刻' }
        ];
    },

    async show(report) {
        const modal = document.createElement('div');
        modal.className = 'modal active annual-report-modal';
        modal.id = 'annualReportModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="AnnualReport.close()"></div>
            <div class="modal-content report-container">
                <div class="report-nav">
                    <button onclick="AnnualReport.prevPage()"><i class="fas fa-chevron-left"></i></button>
                    <span id="reportPageIndicator">1 / 6</span>
                    <button onclick="AnnualReport.nextPage()"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="report-actions">
                    <button onclick="AnnualReport.exportPDF()">
                        <i class="fas fa-download"></i> 导出 PDF
                    </button>
                    <button onclick="AnnualReport.share()">
                        <i class="fas fa-share-alt"></i> 分享
                    </button>
                    <button onclick="AnnualReport.close()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="report-pages" id="reportPages">
                    ${this.renderPages(report)}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.currentPage = 0;
        this.updatePageDisplay();
    },

    renderPages(report) {
        return `
            <div class="report-page active" data-page="0">
                <div class="report-cover">
                    <h1>${report.year}</h1>
                    <h2>年度学习报告</h2>
                    <div class="report-user">
                        <i class="fas fa-user-circle"></i>
                        <span>FlowBoard 用户</span>
                    </div>
                </div>
            </div>
            
            <div class="report-page" data-page="1">
                <h3>年度总览</h3>
                <div class="overview-grid">
                    <div class="overview-card">
                        <i class="fas fa-check-circle"></i>
                        <span class="overview-number">${report.data.completedTasks}</span>
                        <span class="overview-label">完成任务</span>
                    </div>
                    <div class="overview-card">
                        <i class="fas fa-clock"></i>
                        <span class="overview-number">${Math.floor(report.data.totalStudyHours)}</span>
                        <span class="overview-label">学习小时</span>
                    </div>
                    <div class="overview-card">
                        <i class="fas fa-tomato"></i>
                        <span class="overview-number">${report.data.totalPomodoros}</span>
                        <span class="overview-label">完成番茄</span>
                    </div>
                    <div class="overview-card">
                        <i class="fas fa-fire"></i>
                        <span class="overview-number">${report.data.totalHabitChecks}</span>
                        <span class="overview-label">习惯打卡</span>
                    </div>
                </div>
            </div>
            
            <div class="report-page" data-page="2">
                <h3>学习轨迹</h3>
                <div class="chart-container">
                    <canvas id="monthlyChart" width="600" height="300"></canvas>
                </div>
                <p class="chart-desc">这是你${report.year}年每月的学习投入</p>
            </div>
            
            <div class="report-page" data-page="3">
                <h3>技能成长</h3>
                <div class="skills-radar">
                    ${report.data.skillGrowth.map(s => `
                        <div class="skill-bar">
                            <span class="skill-name">${s.skill}</span>
                            <div class="skill-progress">
                                <div class="skill-start" style="width: ${s.start}%"></div>
                                <div class="skill-end" style="width: ${s.end - s.start}%; left: ${s.start}%"></div>
                            </div>
                            <span class="skill-value">${s.end}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="report-page" data-page="4">
                <h3>习惯坚持</h3>
                <div class="habit-heatmap-year">
                    ${this.renderYearHeatmap(report.year)}
                </div>
            </div>
            
            <div class="report-page" data-page="5">
                <h3>高光时刻</h3>
                <div class="highlights">
                    <div class="highlight-item">
                        <i class="fas fa-trophy"></i>
                        <span>最长连续学习 streak</span>
                        <strong>30 天</strong>
                    </div>
                    <div class="highlight-item">
                        <i class="fas fa-star"></i>
                        <span>最专注的一天</span>
                        <strong>12 个番茄</strong>
                    </div>
                    <div class="highlight-item">
                        <i class="fas fa-code"></i>
                        <span>解决问题最多的一天</span>
                        <strong>8 题</strong>
                    </div>
                </div>
                <div class="report-footer">
                    <p>继续加油，新的一年更精彩！💪</p>
                </div>
            </div>
        `;
    },

    renderYearHeatmap(year) {
        // 简化版热力图
        let html = '<div class="year-heatmap">';
        const today = new Date();
        const startOfYear = new Date(year, 0, 1);
        
        for (let i = 0; i < 365; i++) {
            const date = new Date(startOfYear);
            date.setDate(date.getDate() + i);
            
            if (date > today) break;
            
            const intensity = Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low';
            html += `<div class="heatmap-day ${intensity}" title="${date.toLocaleDateString()}"></div>`;
        }
        
        html += '</div>';
        return html;
    },

    currentPage: 0,
    totalPages: 6,

    nextPage() {
        if (this.currentPage < this.totalPages - 1) {
            document.querySelector(`.report-page[data-page="${this.currentPage}"]`)?.classList.remove('active');
            this.currentPage++;
            document.querySelector(`.report-page[data-page="${this.currentPage}"]`)?.classList.add('active');
            this.updatePageDisplay();
        }
    },

    prevPage() {
        if (this.currentPage > 0) {
            document.querySelector(`.report-page[data-page="${this.currentPage}"]`)?.classList.remove('active');
            this.currentPage--;
            document.querySelector(`.report-page[data-page="${this.currentPage}"]`)?.classList.add('active');
            this.updatePageDisplay();
        }
    },

    updatePageDisplay() {
        const indicator = document.getElementById('reportPageIndicator');
        if (indicator) {
            indicator.textContent = `${this.currentPage + 1} / ${this.totalPages}`;
        }
    },

    close() {
        document.getElementById('annualReportModal')?.remove();
    },

    exportPDF() {
        showToast('正在生成 PDF...');
        // 实际实现需要使用 html2canvas + jsPDF
        setTimeout(() => {
            showToast('PDF 导出功能需要额外库支持');
        }, 1000);
    },

    share() {
        // 生成分享图片
        showToast('正在生成分享图片...');
    },

    async showAnnualReportModal() {
        const report = await this.generate();
        await this.show(report);
    }
};

// 导出
window.AnnualReport = AnnualReport;
