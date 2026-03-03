# FlowBoard 测试配置说明

本文档详细说明 FlowBoard 项目的测试配置。

---

## 📦 package.json 测试脚本

位于项目根目录 `package.json`：

```json
{
  "scripts": {
    "test": "npm run test:unit",
    "test:unit": "npm run test:unit:frontend && npm run test:unit:backend",
    "test:unit:frontend": "jest --config tests/setup/jest.config.js",
    "test:unit:backend": "pytest tests/unit/backend -c tests/setup/pytest.ini",
    "test:watch": "jest --config tests/setup/jest.config.js --watch",
    "test:coverage": "jest --config tests/setup/jest.config.js --coverage",
    "test:ci": "jest --config tests/setup/jest.config.js --ci --coverage --reporters=default --reporters=jest-junit"
  }
}
```

### 脚本说明

| 脚本 | 说明 |
|-----|------|
| `npm test` | 运行所有测试（前端+后端） |
| `npm run test:unit` | 同上 |
| `npm run test:unit:frontend` | 仅运行前端单元测试 |
| `npm run test:unit:backend` | 仅运行后端单元测试 |
| `npm run test:watch` | 前端测试监视模式 |
| `npm run test:coverage` | 生成前端覆盖率报告 |
| `npm run test:ci` | CI模式运行前端测试 |

---

## ⚙️ Jest 配置 (前端)

文件：`tests/setup/jest.config.js`

```javascript
module.exports = {
  // 根目录（项目根目录）
  rootDir: '../..',
  
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/tests/unit/frontend/**/*.test.js'
  ],
  
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json'],
  
  // 转换器配置（使用 Babel 转译 ES6+）
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // 模块名称映射（简化导入路径）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1'
  },
  
  // 测试初始化文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  
  // 覆盖率配置
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.min.js',
    '!js/**/languages.js',
    '!js/**/code-snippets.js'
  ],
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // 测试超时（10秒）
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
  
  // 清除模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 忽略路径
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/ai_service/'
  ]
};
```

### 关键配置项

| 配置项 | 说明 | 值 |
|-------|------|-----|
| `testEnvironment` | 测试环境 | `jsdom`（模拟浏览器） |
| `testMatch` | 测试文件匹配 | `tests/unit/frontend/**/*.test.js` |
| `transform` | 文件转译 | 使用 `babel-jest` |
| `setupFilesAfterEnv` | 测试初始化 | `jest.setup.js` |
| `coverageDirectory` | 覆盖率输出目录 | `tests/coverage` |
| `testTimeout` | 测试超时时间 | 10000ms |

---

## ⚙️ Babel 配置

文件：`.babelrc`

```json
{
  "presets": [
    ["@babel/preset-env", { "targets": { "node": "current" } }]
  ]
}
```

用于将 ES6+ 代码转译为 Jest 可运行的代码。

---

## ⚙️ pytest 配置 (后端)

文件：`tests/setup/pytest.ini`

```ini
[pytest]
# 测试目录
testpaths = tests/unit/backend

# 测试文件匹配模式
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# 异步测试支持
asyncio_mode = auto

# 标记配置
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests

# 覆盖率配置
addopts = 
    -v
    --tb=short
    --strict-markers
    --cov=ai_service
    --cov-report=term-missing
    --cov-report=html:tests/coverage/html
    --cov-report=xml:tests/coverage/coverage.xml

# 忽略路径
norecursedirs = .git node_modules dist build .tox .eggs

# 日志配置
log_cli = true
log_cli_level = INFO
log_cli_format = %(asctime)s [%(levelname)s] %(message)s
log_cli_date_format = %Y-%m-%d %H:%M:%S

# 环境变量
env =
    PYTHONPATH=ai_service
    TESTING=true
```

### 关键配置项

| 配置项 | 说明 | 值 |
|-------|------|-----|
| `testpaths` | 测试目录 | `tests/unit/backend` |
| `python_files` | 测试文件模式 | `test_*.py` |
| `asyncio_mode` | 异步模式 | `auto` |
| `addopts` | 默认选项 | 详细输出、覆盖率等 |

---

## 🛠️ Jest 初始化脚本

文件：`tests/setup/jest.setup.js`

此文件在每次测试前运行，设置全局模拟：

### 1. localStorage 模拟

```javascript
global.localStorageMock = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};
Object.defineProperty(global, 'localStorage', {
  value: global.localStorageMock
});
```

### 2. IndexedDB 模拟

```javascript
global.indexedDB = {
  open: jest.fn(() => {
    // 返回模拟的 IDBRequest
  })
};
```

### 3. Electron API 模拟

```javascript
global.window.electronAPI = {
  getPlatform: jest.fn(() => Promise.resolve('win32')),
  saveData: jest.fn(() => Promise.resolve({ success: true })),
  loadData: jest.fn(() => Promise.resolve({ success: true, data: null })),
  // ... 其他方法
};
```

### 4. Monaco Editor 模拟

```javascript
global.monaco = {
  editor: {
    create: jest.fn(() => ({ ... })),
    defineTheme: jest.fn(),
    setTheme: jest.fn()
  }
};
```

### 5. 全局工具函数

```javascript
// 创建 DOM 元素辅助函数
global.createMockElement = (tag, attrs = {}) => { ... };

// 等待异步操作完成
global.flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// 重置所有模拟
global.resetAllMocks = () => { ... };
```

---

## 📦 Python 测试依赖

文件：`ai_service/requirements.txt`

```
# Testing
pytest==8.3.0
pytest-asyncio==0.24.0
pytest-cov==6.0.0
```

安装命令：
```bash
cd ai_service
pip install -r requirements.txt
```

---

## 📦 Node.js 测试依赖

文件：`package.json` 的 `devDependencies`

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "jest-junit": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/dom": "^9.3.4",
    "babel-jest": "^29.7.0",
    "@babel/core": "^7.24.0",
    "@babel/preset-env": "^7.24.0"
  }
}
```

安装命令：
```bash
npm install
```

---

## 🔧 自定义配置

### 修改 Jest 超时时间

编辑 `tests/setup/jest.config.js`：

```javascript
module.exports = {
  // 改为 30 秒
  testTimeout: 30000,
};
```

### 修改测试匹配模式

```javascript
module.exports = {
  // 只测试特定文件
  testMatch: [
    '<rootDir>/tests/unit/frontend/db-core.test.js'
  ],
};
```

### 修改覆盖率阈值

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,    // 从 70 提高到 80
      functions: 85,   // 从 75 提高到 85
      lines: 85,       // 从 75 提高到 85
      statements: 85   // 从 75 提高到 85
    }
  },
};
```

### 添加 pytest 标记

编辑 `tests/setup/pytest.ini`：

```ini
[pytest]
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
    unit: marks tests as unit tests
    e2e: marks tests as end-to-end tests
```

使用标记运行特定测试：
```bash
# 只运行非慢速测试
cd ai_service && python -m pytest ../tests/unit/backend -v -m "not slow"

# 只运行单元测试
cd ai_service && python -m pytest ../tests/unit/backend -v -m "unit"
```

---

## 📁 配置文件清单

| 文件 | 说明 |
|-----|------|
| `package.json` | npm 脚本和 Node.js 依赖 |
| `.babelrc` | Babel 转译配置 |
| `tests/setup/jest.config.js` | Jest 测试框架配置 |
| `tests/setup/jest.setup.js` | Jest 初始化脚本 |
| `tests/setup/pytest.ini` | pytest 测试框架配置 |
| `tests/setup/conftest.py` | pytest 共享 Fixture |
| `ai_service/requirements.txt` | Python 依赖 |

---

## 🔗 相关文档

- [测试运行指南](./RUN_TESTS.md) - 如何运行测试
- [测试架构概述](./README.md) - 测试项目结构
- [测试计划](./TEST_PLAN.md) - 测试用例设计

---

**最后更新**: 2026-03-04
