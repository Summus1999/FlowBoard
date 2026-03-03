# FlowBoard 测试运行指南

本文档说明如何在 FlowBoard 项目中运行测试套件。

## 📋 目录

- [环境准备](#环境准备)
- [快速开始](#快速开始)
- [运行测试](#运行测试)
- [测试架构](#测试架构)
- [编写测试](#编写测试)
- [常见问题](#常见问题)

---

## 环境准备

### 1. 前端测试依赖

确保已安装 Node.js 依赖：

```bash
# 在项目根目录
npm install
```

需要的依赖（已包含在 package.json）：
- `jest` - 测试框架
- `jest-environment-jsdom` - DOM 模拟环境
- `@testing-library/jest-dom` - DOM 断言扩展
- `babel-jest` - JavaScript 转译

### 2. 后端测试依赖

确保已安装 Python 依赖：

```bash
# 进入 AI 服务目录
cd ai_service

# 安装依赖（包含测试依赖）
pip install -r requirements.txt
```

需要的依赖（已包含在 requirements.txt）：
- `pytest` - 测试框架
- `pytest-asyncio` - 异步测试支持
- `pytest-cov` - 覆盖率报告

---

## 快速开始

### 一键运行所有测试

```bash
npm test
```

这会依次运行前端和后端测试。

---

## 运行测试

### 前端测试（JavaScript）

```bash
# 运行所有前端测试
npm run test:unit:frontend

# 监视模式（代码变更自动重跑）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage

# CI 模式（用于自动化构建）
npm run test:ci
```

### 后端测试（Python）

```bash
# 方法 1：通过 npm 脚本（推荐）
npm run test:unit:backend

# 方法 2：直接运行 pytest
cd ai_service
python -m pytest ../tests/unit/backend -v

# 生成覆盖率报告
cd ai_service
python -m pytest ../tests/unit/backend -v --cov=app --cov-report=html

# 仅运行特定测试文件
cd ai_service
python -m pytest ../tests/unit/backend/test_model_gateway.py -v

# 仅运行特定测试类
cd ai_service
python -m pytest ../tests/unit/backend -v -k "TestModelGateway"

# 仅运行特定测试方法
cd ai_service
python -m pytest ../tests/unit/backend -v -k "test_mg_001"
```

### 分别运行测试文件

```bash
# 仅运行 sidebar 测试
npx jest tests/unit/frontend/sidebar-registry.test.js

# 仅运行 db-core 测试
npx jest tests/unit/frontend/db-core.test.js

# 仅运行 config API 测试
cd ai_service && python -m pytest ../tests/unit/backend/test_config_api.py -v
```

---

## 测试架构

### 目录结构

```
tests/
├── README.md              # 测试概述文档
├── RUN_TESTS.md           # 本文档 - 运行指南
├── TEST_PLAN.md           # 完整测试计划
│
├── setup/                 # 测试配置
│   ├── jest.config.js     # Jest 配置文件
│   ├── jest.setup.js      # Jest 初始化脚本（全局 mock）
│   └── pytest.ini         # pytest 配置文件
│
├── mocks/                 # 测试桩数据
│   └── mock-data.js       # 前端 mock 数据
│
├── unit/                  # 单元测试
│   ├── frontend/          # 前端单元测试
│   │   ├── db-core.test.js
│   │   └── sidebar-registry.test.js
│   └── backend/           # 后端单元测试
│       ├── test_config_api.py
│       ├── test_model_gateway.py
│       └── test_retrieval_service.py
│
├── integration/           # 集成测试（待扩展）
└── e2e/                   # E2E 测试（待扩展）
```

### 前端测试配置

- **框架**: Jest + jsdom
- **匹配模式**: `tests/unit/frontend/**/*.test.js`
- **环境**: 模拟浏览器 DOM
- **全局模拟**: localStorage、IndexedDB、Electron API、Monaco Editor

### 后端测试配置

- **框架**: pytest
- **匹配模式**: `tests/unit/backend/test_*.py`
- **异步支持**: pytest-asyncio
- **覆盖率**: pytest-cov

---

## 编写测试

### 前端测试示例

创建 `tests/unit/frontend/my-feature.test.js`：

```javascript
/**
 * 功能模块测试
 */

describe('MyFeature', () => {
  beforeEach(() => {
    // 清理 mock 数据
    localStorageMock.clear();
  });

  test('应该正确执行某个功能', () => {
    // Arrange - 准备数据
    const input = { id: 1, name: 'test' };
    
    // Act - 执行操作
    const result = myFunction(input);
    
    // Assert - 验证结果
    expect(result).toEqual({ id: 1, name: 'test', processed: true });
  });

  test('异步操作应该返回正确结果', async () => {
    // 使用 async/await 测试异步代码
    const result = await myAsyncFunction();
    expect(result).toBeTruthy();
  });
});
```

### 后端测试示例

创建 `tests/unit/backend/test_my_module.py`：

```python
"""
模块测试
"""

import pytest
from unittest.mock import Mock, AsyncMock


class TestMyModule:
    """测试 MyModule 功能"""

    @pytest.fixture
    def service(self):
        """创建 mock 服务"""
        service = Mock()
        service.get_data = Mock(return_value={"id": 1, "name": "test"})
        return service

    def test_sync_function(self, service):
        """测试同步函数"""
        result = service.get_data()
        assert result["id"] == 1
        assert result["name"] == "test"

    @pytest.mark.asyncio
    async def test_async_function(self, service):
        """测试异步函数"""
        service.fetch_data = AsyncMock(return_value={"data": "value"})
        
        result = await service.fetch_data()
        assert result["data"] == "value"
```

---

## 常见问题

### 前端测试问题

#### Q1: `jest: command not found`

**原因**: Jest 未安装  
**解决**:
```bash
npm install
```

#### Q2: `Cannot find module '@testing-library/jest-dom'`

**原因**: 测试库依赖缺失  
**解决**:
```bash
npm install --save-dev @testing-library/jest-dom
```

#### Q3: 测试超时

**原因**: 异步操作未正确处理  
**解决**:
```javascript
// 增加超时时间
test('异步测试', async () => {
  const result = await slowFunction();
  expect(result).toBeDefined();
}, 10000); // 10秒超时
```

### 后端测试问题

#### Q1: `ModuleNotFoundError: No module named 'pytest'`

**原因**: pytest 未安装  
**解决**:
```bash
pip install pytest pytest-asyncio
```

#### Q2: `pytest-asyncio mode is not set`

**原因**: 异步模式未配置  
**解决**: 已在 `tests/setup/pytest.ini` 中配置：
```ini
[pytest]
asyncio_mode = auto
```

#### Q3: 导入错误 `No module named 'app'`

**原因**: Python 路径未正确设置  
**解决**: 确保在 `ai_service` 目录运行测试，或设置 `PYTHONPATH`：
```bash
cd ai_service
python -m pytest ../tests/unit/backend -v
```

#### Q4: 异步测试失败

**原因**: 缺少 `@pytest.mark.asyncio` 装饰器  
**解决**:
```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    result = await my_async_function()
    assert result is not None
```

---

## 覆盖率报告

### 前端覆盖率

```bash
npm run test:coverage
```

报告将生成在 `tests/coverage/` 目录：
- `lcov-report/index.html` - HTML 格式报告
- `coverage-final.json` - JSON 格式数据

### 后端覆盖率

```bash
cd ai_service
python -m pytest ../tests/unit/backend -v --cov=app --cov-report=html
```

报告将生成在 `ai_service/htmlcov/` 目录：
- `index.html` - HTML 格式报告

---

## 持续集成

在 GitHub Actions 中使用：

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # 前端测试
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit:frontend
      
      # 后端测试
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: pip install -r ai_service/requirements.txt
      - run: npm run test:unit:backend
```

---

## 调试测试

### 前端调试

```bash
# 使用 --verbose 查看详细输出
npx jest --verbose

# 使用 --no-coverage 跳过覆盖率
npx jest --no-coverage

# 调试特定测试
debugger; // 在测试代码中添加断点
```

### 后端调试

```bash
# 使用 --pdb 进入调试器
cd ai_service
python -m pytest ../tests/unit/backend -v --pdb

# 在代码中添加断点
import pytest; pytest.set_trace()
```

---

## 相关文档

- [测试概述](./README.md) - 测试架构总览
- [测试计划](./TEST_PLAN.md) - 完整测试用例设计
- [配置说明](./CONFIG.md) - 详细的配置文件说明
- [项目 README](../README.md) - 项目整体说明

---

**最后更新**: 2026-03-04
