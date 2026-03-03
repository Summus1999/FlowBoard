# FlowBoard 测试文档

## 📚 文档导航

| 文档 | 说明 |
|-----|------|
| [RUN_TESTS.md](./RUN_TESTS.md) | **测试运行指南** - 如何运行测试 |
| [TEST_PLAN.md](./TEST_PLAN.md) | **测试计划** - 完整测试用例设计 |
| [CONFIG.md](./CONFIG.md) | **配置说明** - 详细的配置文件说明 |
| 本文档 | **测试架构概述** - 项目结构和规范 |

---

## 🚀 快速开始

```bash
# 运行所有测试
npm test

# 仅前端测试
npm run test:unit:frontend

# 仅后端测试
npm run test:unit:backend
```

详细说明请查看 [RUN_TESTS.md](./RUN_TESTS.md)

---

## 📁 测试架构

```
tests/
├── README.md              # 本文档 - 架构概述
├── RUN_TESTS.md           # 运行指南
├── TEST_PLAN.md           # 测试计划
│
├── setup/                 # 测试配置
│   ├── jest.config.js     # Jest 配置（前端）
│   ├── jest.setup.js      # Jest 初始化脚本
│   ├── pytest.ini         # pytest 配置（后端）
│   └── conftest.py        # pytest 共享 Fixture
│
├── mocks/                 # 测试桩数据
│   └── mock-data.js       # 前端 Mock 数据
│
├── unit/                  # 单元测试
│   ├── frontend/          # 前端单元测试
│   │   ├── db-core.test.js           (14 tests)
│   │   └── sidebar-registry.test.js  (27 tests)
│   └── backend/           # 后端单元测试
│       ├── test_config_api.py        (10 tests)
│       ├── test_model_gateway.py     (10 tests)
│       └── test_retrieval_service.py (10 tests)
│
├── integration/           # 集成测试（待扩展）
└── e2e/                   # E2E 测试（待扩展）
```

---

## 📊 测试覆盖

### 前端测试（Jest + jsdom）

| 模块 | 文件 | 用例数 | 覆盖功能 |
|------|------|-------|---------|
| IndexedDB 存储层 | db-core.test.js | 14 | CRUD、批量操作、KV存储 |
| 侧边栏注册中心 | sidebar-registry.test.js | 27 | 注册、启用/禁用、事件、渲染 |

**合计**: 41 个测试

### 后端测试（pytest）

| 模块 | 文件 | 用例数 | 覆盖功能 |
|------|------|-------|---------|
| 配置 API | test_config_api.py | 10 | Provider配置、访问控制、Token验证 |
| 模型网关 | test_model_gateway.py | 10 | 初始化、热重载、多Provider路由 |
| 检索服务 | test_retrieval_service.py | 10 | 混合检索、RRF融合、rerank、降级 |

**合计**: 30 个测试

---

## 🎯 测试规范

### 前端测试规范

1. **文件命名**: `{module-name}.test.js`
2. **测试结构**: `describe` → `test` (或 `it`)
3. **Mock 数据**: 使用 `tests/mocks/mock-data.js`
4. **DOM 测试**: 使用 `jest.setup.js` 中提供的全局模拟

```javascript
describe('MyModule', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('should work correctly', async () => {
    // Arrange
    const input = { id: 1, name: 'test' };
    
    // Act
    const result = await myFunction(input);
    
    // Assert
    expect(result).toEqual(expected);
  });
});
```

### 后端测试规范

1. **文件命名**: `test_{module_name}.py`
2. **测试类命名**: `Test{ModuleName}`
3. **Fixture**: 使用 `conftest.py` 中的共享 Fixture
4. **异步测试**: 使用 `@pytest.mark.asyncio`

```python
class TestMyModule:
    @pytest.fixture
    def service(self):
        return Mock()

    @pytest.mark.asyncio
    async def test_should_work(self, service):
        # Arrange
        service.method = AsyncMock(return_value="result")
        
        # Act
        result = await service.method()
        
        # Assert
        assert result == "result"
```

---

## 📈 覆盖率目标

| 模块类型 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 |
|---------|-----------|-----------|-----------|
| 核心存储层 (db-core) | ≥ 85% | ≥ 80% | ≥ 90% |
| 侧边栏注册中心 | ≥ 80% | ≥ 75% | ≥ 85% |
| 模型网关 | ≥ 90% | ≥ 85% | ≥ 90% |
| 检索服务 | ≥ 85% | ≥ 80% | ≥ 85% |

---

## 🔧 技术栈

### 前端
- **测试框架**: Jest 29.x
- **测试环境**: jsdom
- **断言库**: Jest 内置 + @testing-library/jest-dom
- **转译**: Babel

### 后端
- **测试框架**: pytest 8.x
- **异步支持**: pytest-asyncio
- **覆盖率**: pytest-cov
- **Mock**: unittest.mock

---

## 📝 编写新测试

### 添加前端测试

1. 创建文件: `tests/unit/frontend/my-feature.test.js`
2. 导入 mock 数据: `import { mockData } from '../../mocks/mock-data'`
3. 遵循 AAA 模式: Arrange → Act → Assert

### 添加后端测试

1. 创建文件: `tests/unit/backend/test_my_module.py`
2. 使用 pytest fixture 准备测试数据
3. 异步测试添加 `@pytest.mark.asyncio` 装饰器

---

## 🔗 相关链接

- [测试运行指南](./RUN_TESTS.md) - 详细运行说明
- [测试计划](./TEST_PLAN.md) - 测试用例设计
- [项目根目录 README](../README.md) - 项目整体说明

---

**最后更新**: 2026-03-04
