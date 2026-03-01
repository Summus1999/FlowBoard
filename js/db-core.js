/**
 * FlowBoard - IndexedDB 统一存储层
 * 纯本地架构核心基础设施
 */

const DB_NAME = 'FlowBoardDB';
const DB_VERSION = 3;

// 存储定义
const STORE_SCHEMA = {
    // 账户密码 (从 localStorage 迁移)
    passwords: { keyPath: 'id' },
    
    // 任务/待办整合 (功能3)
    tasks: { 
        keyPath: 'id', 
        indexes: [
            { name: 'status', keyPath: 'status' },
            { name: 'boardId', keyPath: 'boardId' },
            { name: 'dueDate', keyPath: 'dueDate' },
            { name: 'planId', keyPath: 'planId' },
            { name: 'createdAt', keyPath: 'createdAt' }
        ]
    },
    
    // AI 对话 (功能1)
    chatSessions: { 
        keyPath: 'id', 
        indexes: [
            { name: 'updatedAt', keyPath: 'updatedAt' },
            { name: 'isPinned', keyPath: 'isPinned' }
        ]
    },
    chatMessages: { 
        keyPath: 'id', 
        indexes: [
            { name: 'sessionId', keyPath: 'sessionId' },
            { name: 'timestamp', keyPath: 'timestamp' }
        ]
    },
    
    // 知识库 (功能4)
    knowledgeDocs: { 
        keyPath: 'id', 
        indexes: [
            { name: 'status', keyPath: 'status' },
            { name: 'importedAt', keyPath: 'importedAt' },
            { name: 'fileName', keyPath: 'fileName' }
        ]
    },
    knowledgeChunks: { 
        keyPath: 'id', 
        indexes: [
            { name: 'docId', keyPath: 'docId' }
        ]
    },
    // 向量存储 - 使用 ArrayBuffer 存储 Float32Array
    vectors: { keyPath: 'chunkId' },
    
    // 学习计划 (功能2)
    learningPlans: { 
        keyPath: 'id', 
        indexes: [
            { name: 'status', keyPath: 'status' },
            { name: 'createdAt', keyPath: 'createdAt' }
        ]
    },
    planVersions: { 
        keyPath: 'id', 
        indexes: [
            { name: 'planId', keyPath: 'planId' },
            { name: 'version', keyPath: 'version' }
        ]
    },
    
    // 习惯追踪 (功能10 - 预留)
    habits: { keyPath: 'id' },
    habitRecords: { 
        keyPath: 'id', 
        indexes: [
            { name: 'habitId', keyPath: 'habitId' },
            { name: 'date', keyPath: 'date' }
        ]
    },
    
    // 通知中心 (功能9 - 预留)
    notifications: { 
        keyPath: 'id', 
        indexes: [
            { name: 'read', keyPath: 'read' },
            { name: 'timestamp', keyPath: 'timestamp' }
        ]
    },
    
    // 代码片段 (功能12 - 预留)
    codeSnippets: { 
        keyPath: 'id', 
        indexes: [
            { name: 'category', keyPath: 'category' },
            { name: 'language', keyPath: 'language' }
        ]
    },
    
    // P1 功能存储
    // 复盘报告 (功能5)
    reviews: {
        keyPath: 'id',
        indexes: [
            { name: 'type', keyPath: 'type' },
            { name: 'createdAt', keyPath: 'createdAt' }
        ]
    },
    
    // 学习记录 (功能5)
    studyRecords: {
        keyPath: 'id',
        indexes: [
            { name: 'date', keyPath: 'date' }
        ]
    },
    
    // 面试录音 (功能6)
    interviewRecordings: {
        keyPath: 'id',
        indexes: [
            { name: 'startTime', keyPath: 'startTime' }
        ]
    },
    
    // 面试分析报告 (功能6)
    interviewAnalyses: {
        keyPath: 'id',
        indexes: [
            { name: 'recordingId', keyPath: 'recordingId' }
        ]
    },
    
    // 番茄钟记录 (功能7)
    pomodoroRecords: {
        keyPath: 'id',
        indexes: [
            { name: 'startTime', keyPath: 'startTime' }
        ]
    },
    
    // P2 功能存储
    // 复盘报告 (功能5)
    reviews: {
        keyPath: 'id',
        indexes: [
            { name: 'type', keyPath: 'type' },
            { name: 'createdAt', keyPath: 'createdAt' }
        ]
    },
    studyRecords: {
        keyPath: 'id',
        indexes: [
            { name: 'date', keyPath: 'date' }
        ]
    },
    interviewRecordings: {
        keyPath: 'id',
        indexes: [
            { name: 'startTime', keyPath: 'startTime' }
        ]
    },
    interviewAnalyses: {
        keyPath: 'id',
        indexes: [
            { name: 'recordingId', keyPath: 'recordingId' }
        ]
    },
    
    // 习惯追踪 (功能10)
    habits: {
        keyPath: 'id'
    },
    habitRecords: {
        keyPath: 'id',
        indexes: [
            { name: 'habitId', keyPath: 'habitId' },
            { name: 'date', keyPath: 'date' }
        ]
    },
    
    // 代码片段 (功能12)
    codeSnippets: {
        keyPath: 'id',
        indexes: [
            { name: 'category', keyPath: 'category' },
            { name: 'language', keyPath: 'language' }
        ]
    },
    
    // P3 功能存储
    // 插件 (功能13)
    plugins: {
        keyPath: 'id'
    },
    
    // 工作流 (功能15)
    workflows: {
        keyPath: 'id'
    },
    workflowLogs: {
        keyPath: 'id',
        indexes: [
            { name: 'workflowId', keyPath: 'workflowId' },
            { name: 'executedAt', keyPath: 'executedAt' }
        ]
    },
    
    // 工作区 (功能16)
    workspaces: {
        keyPath: 'id'
    },
    
    // 书签 (功能17)
    bookmarks: {
        keyPath: 'id',
        indexes: [
            { name: 'category', keyPath: 'category' },
            { name: 'status', keyPath: 'status' }
        ]
    },
    
    // 本地备份 (功能11)
    backups: {
        keyPath: 'id',
        indexes: [
            { name: 'createdAt', keyPath: 'createdAt' }
        ]
    },
    
    // 通用 KV 存储
    kv: { keyPath: 'key' }
};

class FlowBoardDB {
    constructor() {
        this.db = null;
        this.initPromise = null;
    }

    async init() {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[FlowBoardDB] 数据库初始化成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                Object.entries(STORE_SCHEMA).forEach(([storeName, schema]) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { 
                            keyPath: schema.keyPath 
                        });
                        
                        // 创建索引
                        if (schema.indexes) {
                            schema.indexes.forEach(idx => {
                                store.createIndex(idx.name, idx.keyPath);
                            });
                        }
                        console.log(`[FlowBoardDB] 创建对象存储: ${storeName}`);
                    }
                });
            };
        });

        return this.initPromise;
    }

    // 通用 CRUD 操作
    async put(storeName, data) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName, query = null) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = query ? store.getAll(query) : store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // KV 快捷操作
    async setKV(key, value) {
        return this.put('kv', { key, value, updatedAt: Date.now() });
    }

    async getKV(key, defaultValue = null) {
        const result = await this.get('kv', key);
        return result ? result.value : defaultValue;
    }

    // 批量操作
    async batchPut(storeName, items) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            
            items.forEach(item => store.put(item));
            
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // 生成唯一 ID
    generateId(prefix = '') {
        return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 单例导出
const flowboardDB = new FlowBoardDB();

// 兼容旧存储的迁移工具
const MigrationTool = {
    async migrateAll() {
        const migrated = await flowboardDB.getKV('migration_completed');
        if (migrated) {
            console.log('[Migration] 数据已迁移，跳过');
            return;
        }

        console.log('[Migration] 开始数据迁移...');
        
        try {
            await this.migratePasswords();
            await this.migrateTodos();
            await this.migrateNotes();
            await this.migrateEvents();
            await this.migrateApps();
            await this.migrateSettings();
            
            await flowboardDB.setKV('migration_completed', true);
            await flowboardDB.setKV('migration_date', Date.now());
            
            console.log('[Migration] 数据迁移完成');
        } catch (error) {
            console.error('[Migration] 迁移失败:', error);
            throw error;
        }
    },

    async migratePasswords() {
        const key = 'flowboard_passwords_v1';
        const data = localStorage.getItem(key);
        if (!data) return;

        try {
            const passwords = JSON.parse(data);
            if (Array.isArray(passwords)) {
                for (const pwd of passwords) {
                    await flowboardDB.put('passwords', {
                        ...pwd,
                        migratedAt: Date.now()
                    });
                }
                console.log(`[Migration] 迁移 ${passwords.length} 条密码记录`);
            }
        } catch (e) {
            console.error('[Migration] 密码迁移失败:', e);
        }
    },

    async migrateTodos() {
        const key = 'todos';
        const data = localStorage.getItem(key);
        if (!data) return;

        try {
            const todos = JSON.parse(data);
            if (Array.isArray(todos)) {
                for (const todo of todos) {
                    // 转换为新任务格式
                    await flowboardDB.put('tasks', {
                        id: `task_${todo.id}`,
                        title: todo.text,
                        status: todo.completed ? 'done' : 'todo',
                        boardId: 'default',
                        tag: todo.tag || 'normal',
                        createdAt: Date.now(),
                        migratedFrom: 'todos'
                    });
                }
                console.log(`[Migration] 迁移 ${todos.length} 条待办记录`);
            }
        } catch (e) {
            console.error('[Migration] 待办迁移失败:', e);
        }
    },

    async migrateNotes() {
        const key = 'flowboard_notes';
        const data = localStorage.getItem(key);
        if (!data) return;

        // 笔记先存到 KV，后续功能开发时再细化
        await flowboardDB.setKV('legacy_notes', data);
        console.log('[Migration] 笔记数据已暂存');
    },

    async migrateEvents() {
        const key = 'flowboard_events';
        const data = localStorage.getItem(key);
        if (!data) return;

        await flowboardDB.setKV('legacy_events', data);
        console.log('[Migration] 日程数据已暂存');
    },

    async migrateApps() {
        const key = 'flowboard_apps';
        const data = localStorage.getItem(key);
        if (!data) return;

        await flowboardDB.setKV('legacy_apps', data);
        console.log('[Migration] 应用中心数据已暂存');
    },

    async migrateSettings() {
        const settings = {
            theme: localStorage.getItem('theme'),
            user_profile: localStorage.getItem('user_profile'),
            user_avatar: localStorage.getItem('user_avatar'),
            github_username: localStorage.getItem('github_username'),
            leetcode_submissions: localStorage.getItem('leetcode_submissions')
        };

        for (const [key, value] of Object.entries(settings)) {
            if (value) {
                await flowboardDB.setKV(`legacy_${key}`, value);
            }
        }
        console.log('[Migration] 设置数据已暂存');
    }
};

// 导出到全局
window.FlowBoardDB = flowboardDB;
window.FlowBoardMigration = MigrationTool;
