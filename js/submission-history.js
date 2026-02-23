/**
 * 提交历史记录管理模块
 */

class SubmissionHistory {
    constructor() {
        this.storageKey = 'leetcode_submissions';
        this.maxHistory = 1000; // 最大保存记录数
        this.submissions = this.loadFromStorage();
    }

    // ========================================
    // 存储管理
    // ========================================

    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load submission history:', error);
            return [];
        }
    }

    saveToStorage() {
        try {
            // 限制存储数量
            if (this.submissions.length > this.maxHistory) {
                this.submissions = this.submissions.slice(-this.maxHistory);
            }
            localStorage.setItem(this.storageKey, JSON.stringify(this.submissions));
        } catch (error) {
            console.error('Failed to save submission history:', error);
        }
    }

    // ========================================
    // 提交记录操作
    // ========================================

    /**
     * 添加新的提交记录
     */
    addSubmission(submission) {
        const record = {
            id: this.generateId(),
            problemId: submission.problemId,
            problemTitle: submission.problemTitle,
            problemTitleSlug: submission.problemTitleSlug,
            language: submission.language,
            code: submission.code,
            status: submission.status, // 'accepted', 'wrong_answer', 'time_limit_exceeded', etc.
            runtime: submission.runtime,
            memory: submission.memory,
            timestamp: new Date().toISOString(),
            notes: submission.notes || '',
            isFavorite: false,
            tags: submission.tags || []
        };

        this.submissions.unshift(record);
        this.saveToStorage();
        
        return record;
    }

    /**
     * 获取所有提交记录
     */
    getAllSubmissions(filters = {}) {
        let result = [...this.submissions];

        // 按题目筛选
        if (filters.problemId) {
            result = result.filter(s => s.problemId === filters.problemId);
        }

        // 按语言筛选
        if (filters.language) {
            result = result.filter(s => s.language === filters.language);
        }

        // 按状态筛选
        if (filters.status) {
            result = result.filter(s => s.status === filters.status);
        }

        // 按收藏筛选
        if (filters.isFavorite !== undefined) {
            result = result.filter(s => s.isFavorite === filters.isFavorite);
        }

        // 搜索
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(s => 
                s.problemTitle.toLowerCase().includes(searchLower) ||
                s.code.toLowerCase().includes(searchLower)
            );
        }

        // 日期范围
        if (filters.startDate) {
            result = result.filter(s => new Date(s.timestamp) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            result = result.filter(s => new Date(s.timestamp) <= new Date(filters.endDate));
        }

        // 排序
        const sortField = filters.sortBy || 'timestamp';
        const sortOrder = filters.sortOrder || 'desc';
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'timestamp':
                    comparison = new Date(a.timestamp) - new Date(b.timestamp);
                    break;
                case 'runtime':
                    comparison = (a.runtime || 0) - (b.runtime || 0);
                    break;
                case 'memory':
                    comparison = (a.memory || 0) - (b.memory || 0);
                    break;
                case 'problemId':
                    comparison = a.problemId - b.problemId;
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }

    /**
     * 获取单个提交记录
     */
    getSubmission(id) {
        return this.submissions.find(s => s.id === id);
    }

    /**
     * 更新提交记录
     */
    updateSubmission(id, updates) {
        const index = this.submissions.findIndex(s => s.id === id);
        if (index !== -1) {
            this.submissions[index] = { ...this.submissions[index], ...updates };
            this.saveToStorage();
            return this.submissions[index];
        }
        return null;
    }

    /**
     * 删除提交记录
     */
    deleteSubmission(id) {
        const index = this.submissions.findIndex(s => s.id === id);
        if (index !== -1) {
            this.submissions.splice(index, 1);
            this.saveToStorage();
            return true;
        }
        return false;
    }

    /**
     * 切换收藏状态
     */
    toggleFavorite(id) {
        const submission = this.getSubmission(id);
        if (submission) {
            submission.isFavorite = !submission.isFavorite;
            this.saveToStorage();
            return submission.isFavorite;
        }
        return false;
    }

    /**
     * 添加笔记
     */
    addNotes(id, notes) {
        return this.updateSubmission(id, { notes });
    }

    /**
     * 添加标签
     */
    addTags(id, tags) {
        const submission = this.getSubmission(id);
        if (submission) {
            const newTags = [...new Set([...submission.tags, ...tags])];
            return this.updateSubmission(id, { tags: newTags });
        }
        return null;
    }

    /**
     * 移除标签
     */
    removeTag(id, tag) {
        const submission = this.getSubmission(id);
        if (submission) {
            const newTags = submission.tags.filter(t => t !== tag);
            return this.updateSubmission(id, { tags: newTags });
        }
        return null;
    }

    // ========================================
    // 统计功能
    // ========================================

    /**
     * 获取统计数据
     */
    getStats() {
        const stats = {
            total: this.submissions.length,
            accepted: 0,
            wrongAnswer: 0,
            timeLimitExceeded: 0,
            memoryLimitExceeded: 0,
            runtimeError: 0,
            compileError: 0,
            byLanguage: {},
            byDate: {},
            favorites: 0,
            averageRuntime: 0,
            averageMemory: 0
        };

        let totalRuntime = 0;
        let totalMemory = 0;
        let runtimeCount = 0;
        let memoryCount = 0;

        this.submissions.forEach(sub => {
            // 状态统计
            switch (sub.status) {
                case 'accepted':
                    stats.accepted++;
                    break;
                case 'wrong_answer':
                    stats.wrongAnswer++;
                    break;
                case 'time_limit_exceeded':
                    stats.timeLimitExceeded++;
                    break;
                case 'memory_limit_exceeded':
                    stats.memoryLimitExceeded++;
                    break;
                case 'runtime_error':
                    stats.runtimeError++;
                    break;
                case 'compile_error':
                    stats.compileError++;
                    break;
            }

            // 语言统计
            stats.byLanguage[sub.language] = (stats.byLanguage[sub.language] || 0) + 1;

            // 日期统计
            const date = new Date(sub.timestamp).toISOString().split('T')[0];
            stats.byDate[date] = (stats.byDate[date] || 0) + 1;

            // 收藏统计
            if (sub.isFavorite) {
                stats.favorites++;
            }

            // 平均用时和内存
            if (sub.runtime) {
                totalRuntime += sub.runtime;
                runtimeCount++;
            }
            if (sub.memory) {
                totalMemory += sub.memory;
                memoryCount++;
            }
        });

        if (runtimeCount > 0) {
            stats.averageRuntime = Math.round(totalRuntime / runtimeCount);
        }
        if (memoryCount > 0) {
            stats.averageMemory = Math.round(totalMemory / memoryCount);
        }

        return stats;
    }

    /**
     * 获取连续打卡天数
     */
    getStreakDays() {
        const dates = [...new Set(this.submissions.map(s => 
            new Date(s.timestamp).toISOString().split('T')[0]
        ))].sort().reverse();

        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // 检查今天或昨天是否有提交
        if (dates[0] === today || dates[0] === yesterday) {
            streak = 1;
            
            for (let i = 1; i < dates.length; i++) {
                const current = new Date(dates[i - 1]);
                const prev = new Date(dates[i]);
                const diff = (current - prev) / (1000 * 60 * 60 * 24);
                
                if (diff === 1) {
                    streak++;
                } else {
                    break;
                }
            }
        }

        return streak;
    }

    /**
     * 获取某个题目的最佳提交
     */
    getBestSubmission(problemId) {
        const submissions = this.submissions.filter(s => 
            s.problemId === problemId && s.status === 'accepted'
        );

        if (submissions.length === 0) return null;

        // 按运行时排序，返回最优的
        return submissions.sort((a, b) => {
            if (a.runtime && b.runtime) {
                return a.runtime - b.runtime;
            }
            return new Date(b.timestamp) - new Date(a.timestamp);
        })[0];
    }

    /**
     * 获取最近提交
     */
    getRecentSubmissions(limit = 10) {
        return this.submissions.slice(0, limit);
    }

    /**
     * 获取收藏列表
     */
    getFavorites() {
        return this.submissions.filter(s => s.isFavorite);
    }

    // ========================================
    // 导出功能
    // ========================================

    /**
     * 导出为 JSON
     */
    exportToJSON() {
        return JSON.stringify(this.submissions, null, 2);
    }

    /**
     * 导入 JSON
     */
    importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                this.submissions = data;
                this.saveToStorage();
                return true;
            }
        } catch (error) {
            console.error('Failed to import submissions:', error);
        }
        return false;
    }

    /**
     * 导出为 Markdown
     */
    exportToMarkdown() {
        let md = '# LeetCode 提交记录\n\n';
        md += `生成时间: ${new Date().toLocaleString()}\n\n`;
        md += `总提交数: ${this.submissions.length}\n\n`;
        md += '---\n\n';

        const grouped = this.groupByProblem();
        
        for (const [problemId, submissions] of Object.entries(grouped)) {
            const first = submissions[0];
            md += `## ${problemId}. ${first.problemTitle}\n\n`;
            
            submissions.forEach(sub => {
                const date = new Date(sub.timestamp).toLocaleString();
                const status = this.getStatusEmoji(sub.status);
                md += `- ${status} **${sub.language}** | ${date}\n`;
                if (sub.runtime) {
                    md += `  - 执行用时: ${sub.runtime} ms\n`;
                }
                if (sub.memory) {
                    md += `  - 内存消耗: ${sub.memory} MB\n`;
                }
                if (sub.notes) {
                    md += `  - 备注: ${sub.notes}\n`;
                }
                md += '\n';
            });
        }

        return md;
    }

    /**
     * 按题目分组
     */
    groupByProblem() {
        return this.submissions.reduce((acc, sub) => {
            if (!acc[sub.problemId]) {
                acc[sub.problemId] = [];
            }
            acc[sub.problemId].push(sub);
            return acc;
        }, {});
    }

    // ========================================
    // 辅助方法
    // ========================================

    generateId() {
        return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getStatusEmoji(status) {
        const emojis = {
            'accepted': '✅',
            'wrong_answer': '❌',
            'time_limit_exceeded': '⏱️',
            'memory_limit_exceeded': '💾',
            'runtime_error': '💥',
            'compile_error': '🔧',
            'pending': '⏳'
        };
        return emojis[status] || '❓';
    }

    getStatusText(status) {
        const texts = {
            'accepted': '通过',
            'wrong_answer': '解答错误',
            'time_limit_exceeded': '超时',
            'memory_limit_exceeded': '内存超限',
            'runtime_error': '运行错误',
            'compile_error': '编译错误',
            'pending': '等待中'
        };
        return texts[status] || status;
    }

    /**
     * 清空历史
     */
    clearAll() {
        if (confirm('确定要清空所有提交历史吗？此操作不可恢复。')) {
            this.submissions = [];
            this.saveToStorage();
            return true;
        }
        return false;
    }
}

// 创建全局实例
const submissionHistory = new SubmissionHistory();

console.log('提交历史模块已加载，当前记录数:', submissionHistory.submissions.length);
