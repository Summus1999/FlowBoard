/**
 * FlowBoard - 本地备份与数据管理 (功能11 - 纯本地版)
 * 数据导出、导入、本地备份
 */

const BackupManager = {
    async init() {
        this.createBackupSection();
    },

    createBackupSection() {
        // 在设置页面添加备份区域
        const settingsContainer = document.querySelector('.settings-grid');
        if (!settingsContainer) return;

        const backupCard = document.createElement('div');
        backupCard.className = 'settings-card';
        backupCard.innerHTML = `
            <h3><i class="fas fa-database"></i> 数据管理</h3>
            <div class="backup-section">
                <div class="backup-info">
                    <p>所有数据存储在本地，定期备份可以防止数据丢失。</p>
                </div>
                <div class="backup-actions">
                    <button class="btn-primary" onclick="BackupManager.exportAll()">
                        <i class="fas fa-download"></i> 导出全部数据
                    </button>
                    <button class="btn-secondary" onclick="BackupManager.importData()">
                        <i class="fas fa-upload"></i> 导入数据
                    </button>
                    <button class="btn-secondary" onclick="BackupManager.createLocalBackup()">
                        <i class="fas fa-save"></i> 创建本地备份
                    </button>
                </div>
                <div class="backup-list" id="backupList">
                    <h4>备份历史</h4>
                    <div class="backup-items" id="backupItems">
                        加载中...
                    </div>
                </div>
            </div>
        `;

        settingsContainer.appendChild(backupCard);
        this.loadBackupList();
    },

    async exportAll() {
        showToast('正在准备导出...');

        try {
            const data = await this.gatherAllData();
            const exportObj = {
                version: '2.0',
                exportDate: new Date().toISOString(),
                data
            };

            const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `flowboard-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('导出完成');
        } catch (error) {
            console.error('[BackupManager] 导出失败:', error);
            showToast('导出失败: ' + error.message);
        }
    },

    async gatherAllData() {
        const stores = [
            'passwords', 'tasks', 'chatSessions', 'chatMessages',
            'knowledgeDocs', 'knowledgeChunks', 'vectors',
            'learningPlans', 'planVersions', 'habits', 'habitRecords',
            'notifications', 'codeSnippets', 'reviews', 'studyRecords',
            'interviewRecordings', 'interviewAnalyses', 'pomodoroRecords'
        ];

        const data = {};
        for (const store of stores) {
            try {
                data[store] = await flowboardDB.getAll(store);
            } catch (e) {
                data[store] = [];
            }
        }

        // 包含 localStorage 数据
        data.localStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('flowboard')) {
                data.localStorage[key] = localStorage.getItem(key);
            }
        }

        return data;
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const importObj = JSON.parse(text);

                if (!importObj.data) {
                    throw new Error('无效的备份文件');
                }

                if (!confirm('导入将覆盖现有数据，确定继续吗？')) return;

                showToast('正在导入数据...');
                await this.restoreData(importObj.data);
                showToast('导入完成，请刷新页面');

            } catch (error) {
                console.error('[BackupManager] 导入失败:', error);
                showToast('导入失败: ' + error.message);
            }
        };
        input.click();
    },

    async restoreData(data) {
        // 清空并恢复各个存储
        for (const [storeName, items] of Object.entries(data)) {
            if (storeName === 'localStorage') continue;
            if (!Array.isArray(items)) continue;

            try {
                await flowboardDB.clear(storeName);
                for (const item of items) {
                    await flowboardDB.put(storeName, item);
                }
            } catch (e) {
                console.warn(`[BackupManager] 恢复 ${storeName} 失败:`, e);
            }
        }

        // 恢复 localStorage
        if (data.localStorage) {
            for (const [key, value] of Object.entries(data.localStorage)) {
                localStorage.setItem(key, value);
            }
        }
    },

    async createLocalBackup() {
        try {
            const data = await this.gatherAllData();
            const backup = {
                id: flowboardDB.generateId('backup_'),
                createdAt: Date.now(),
                size: JSON.stringify(data).length,
                data
            };

            // 保存到 IndexedDB
            await flowboardDB.put('backups', backup);

            // 限制备份数量（保留最近10个）
            const backups = await flowboardDB.getAll('backups');
            backups.sort((a, b) => b.createdAt - a.createdAt);
            
            if (backups.length > 10) {
                for (const b of backups.slice(10)) {
                    await flowboardDB.delete('backups', b.id);
                }
            }

            showToast('本地备份创建成功');
            this.loadBackupList();

        } catch (error) {
            showToast('备份失败: ' + error.message);
        }
    },

    async loadBackupList() {
        const container = document.getElementById('backupItems');
        if (!container) return;

        try {
            const backups = await flowboardDB.getAll('backups');
            backups.sort((a, b) => b.createdAt - a.createdAt);

            if (backups.length === 0) {
                container.innerHTML = '<p class="empty-hint">暂无备份</p>';
                return;
            }

            container.innerHTML = backups.map(b => `
                <div class="backup-item">
                    <div class="backup-info">
                        <span class="backup-date">${new Date(b.createdAt).toLocaleString()}</span>
                        <span class="backup-size">${this.formatSize(b.size)}</span>
                    </div>
                    <div class="backup-actions">
                        <button onclick="BackupManager.restoreFromBackup('${b.id}')">恢复</button>
                        <button onclick="BackupManager.deleteBackup('${b.id}')">删除</button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            container.innerHTML = '<p class="error">加载失败</p>';
        }
    },

    async restoreFromBackup(backupId) {
        if (!confirm('确定从这个备份恢复吗？当前数据将被覆盖。')) return;

        try {
            const backup = await flowboardDB.get('backups', backupId);
            if (!backup || !backup.data) {
                throw new Error('备份不存在');
            }

            await this.restoreData(backup.data);
            showToast('恢复完成，请刷新页面');

        } catch (error) {
            showToast('恢复失败: ' + error.message);
        }
    },

    async deleteBackup(backupId) {
        if (!confirm('确定删除这个备份吗？')) return;

        await flowboardDB.delete('backups', backupId);
        this.loadBackupList();
        showToast('备份已删除');
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    // 导出特定模块数据
    async exportModule(moduleName) {
        const data = await flowboardDB.getAll(moduleName);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowboard-${moduleName}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// 导出
window.BackupManager = BackupManager;
