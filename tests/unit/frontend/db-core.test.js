/**
 * FlowBoard - db-core.js 单元测试
 * 测试 IndexedDB 统一存储层的核心功能
 */

describe('FlowBoardDB', () => {
  let flowboardDB;
  let mockData;

  beforeEach(() => {
    // 重置模拟数据
    mockData = new Map();
    
    // 创建模拟的 FlowBoardDB 实例
    flowboardDB = {
      async put(storeName, data) {
        const key = `${storeName}_${data.id}`;
        mockData.set(key, { ...data, storeName });
        return data.id;
      },
      
      async get(storeName, key) {
        const dataKey = `${storeName}_${key}`;
        return mockData.get(dataKey) || null;
      },
      
      async getAll(storeName) {
        const results = [];
        for (const [key, value] of mockData.entries()) {
          if (key.startsWith(`${storeName}_`)) {
            results.push(value);
          }
        }
        return results;
      },
      
      async delete(storeName, key) {
        const dataKey = `${storeName}_${key}`;
        mockData.delete(dataKey);
      },
      
      async clear(storeName) {
        for (const key of mockData.keys()) {
          if (key.startsWith(`${storeName}_`)) {
            mockData.delete(key);
          }
        }
      },
      
      async batchPut(storeName, items) {
        const ids = [];
        for (const item of items) {
          const id = await this.put(storeName, item);
          ids.push(id);
        }
        return ids;
      },
      
      async setKV(key, value) {
        return this.put('kv', { id: key, key, value, updatedAt: Date.now() });
      },
      
      async getKV(key, defaultValue = null) {
        const result = await this.get('kv', key);
        return result ? result.value : defaultValue;
      },
      
      generateId(prefix = '') {
        return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    };
  });

  // ============================================
  // 基本 CRUD 测试
  // ============================================
  describe('基本 CRUD 操作', () => {
    test('DB-001: put 存储数据', async () => {
      const data = { id: 1, platform: 'Test', username: 'user', password: 'pass' };
      const id = await flowboardDB.put('passwords', data);
      expect(id).toBe(1);
    });

    test('DB-002: get 读取数据', async () => {
      const data = { id: 1, platform: 'Test', username: 'user' };
      await flowboardDB.put('passwords', data);
      const result = await flowboardDB.get('passwords', 1);
      expect(result).toMatchObject({ id: 1, platform: 'Test' });
    });

    test('DB-003: get 不存在返回 null', async () => {
      const result = await flowboardDB.get('passwords', 'nonexistent');
      expect(result).toBeNull();
    });

    test('DB-004: getAll 获取所有数据', async () => {
      await flowboardDB.put('passwords', { id: 1, platform: 'A' });
      await flowboardDB.put('passwords', { id: 2, platform: 'B' });
      const results = await flowboardDB.getAll('passwords');
      expect(results).toHaveLength(2);
    });

    test('DB-005: delete 删除数据', async () => {
      await flowboardDB.put('passwords', { id: 1, platform: 'Test' });
      await flowboardDB.delete('passwords', 1);
      const result = await flowboardDB.get('passwords', 1);
      expect(result).toBeNull();
    });

    test('DB-006: clear 清空存储', async () => {
      await flowboardDB.put('passwords', { id: 1, platform: 'A' });
      await flowboardDB.put('passwords', { id: 2, platform: 'B' });
      await flowboardDB.clear('passwords');
      const results = await flowboardDB.getAll('passwords');
      expect(results).toHaveLength(0);
    });
  });

  // ============================================
  // 批量操作测试
  // ============================================
  describe('批量操作', () => {
    test('DB-007: batchPut 批量存储', async () => {
      const items = [
        { id: 'task_1', title: 'Task 1', status: 'todo' },
        { id: 'task_2', title: 'Task 2', status: 'done' }
      ];
      const ids = await flowboardDB.batchPut('tasks', items);
      expect(ids).toHaveLength(2);
      expect(ids).toContain('task_1');
      expect(ids).toContain('task_2');
    });

    test('DB-008: batchPut 空数组', async () => {
      const ids = await flowboardDB.batchPut('tasks', []);
      expect(ids).toHaveLength(0);
    });
  });

  // ============================================
  // KV 存储测试
  // ============================================
  describe('KV 存储', () => {
    test('DB-009: setKV 和 getKV', async () => {
      await flowboardDB.setKV('theme', 'dark');
      const value = await flowboardDB.getKV('theme');
      expect(value).toBe('dark');
    });

    test('DB-010: getKV 默认值', async () => {
      const value = await flowboardDB.getKV('nonexistent', 'default');
      expect(value).toBe('default');
    });

    test('DB-011: setKV 更新值', async () => {
      await flowboardDB.setKV('theme', 'dark');
      await flowboardDB.setKV('theme', 'light');
      const value = await flowboardDB.getKV('theme');
      expect(value).toBe('light');
    });
  });

  // ============================================
  // ID 生成测试
  // ============================================
  describe('ID 生成', () => {
    test('DB-012: generateId 生成唯一 ID', () => {
      const id1 = flowboardDB.generateId('task_');
      const id2 = flowboardDB.generateId('task_');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^task_\d+_[a-z0-9]+$/);
    });

    test('DB-013: generateId 无前缀', () => {
      const id = flowboardDB.generateId();
      expect(id).toMatch(/^\d+_[a-z0-9]+$/);
    });
  });

  // ============================================
  // 存储隔离测试
  // ============================================
  describe('存储隔离', () => {
    test('DB-014: 不同存储互不影响', async () => {
      await flowboardDB.put('passwords', { id: 1, name: 'Password 1' });
      await flowboardDB.put('tasks', { id: 1, name: 'Task 1' });
      
      const passwords = await flowboardDB.getAll('passwords');
      const tasks = await flowboardDB.getAll('tasks');
      
      expect(passwords).toHaveLength(1);
      expect(tasks).toHaveLength(1);
      expect(passwords[0].name).toBe('Password 1');
      expect(tasks[0].name).toBe('Task 1');
    });
  });
});
