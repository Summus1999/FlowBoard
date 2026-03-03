# FlowBoard AI Service 架构文档

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FlowBoard Electron                          │
│                    Personal Growth UI Layer                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS + SSE
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI Orchestrator API                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     FastAPI Layer                           │   │
│  │  - Session API / Chat API / Plan API / RAG API / Tool API  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   LangGraph Runtime                         │   │
│  │  - Workflow State Machine                                  │   │
│  │  - Checkpoint & Human-in-Loop                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Agent Runtime                             │   │
│  │  - Planner Agent / Decomposer Agent / RAG QA Agent         │   │
│  │  - Reviewer Agent / Scheduler Agent                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ Model Gateway  │  │ Retrieval Layer  │  │  LangSmith         │
│ Qwen/Kimi/GLM  │  │ - Hybrid Search  │  │  - Trace/Eval      │
│ 硅基流动       │  │ - Rerank         │  │  - Prompt Version  │
│ Routing/Cost   │  │ - Citation       │  │                    │
└────────────────┘  └──────────────────┘  └────────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
      ┌──────────────────────────┐
      │   PostgreSQL + pgvector  │
      │   Redis                  │
      └──────────────────────────┘
```

## 模块职责

### 1. Core Layer (`app/core/`)

| 模块 | 职责 |
|------|------|
| `config.py` | 环境变量和配置管理 |
| `database.py` | PostgreSQL连接和会话管理 |
| `redis.py` | Redis连接和缓存封装 |
| `exceptions.py` | 自定义异常和错误码 |
| `logging.py` | 结构化日志配置 |

### 2. API Layer (`app/api/`)

| 模块 | 职责 |
|------|------|
| `routes/chat.py` | 聊天和流式输出接口 |
| `routes/session.py` | 会话管理接口 |
| `routes/plan.py` | 学习计划接口 |
| `routes/rag.py` | 文档索引和检索接口 |
| `routes/health.py` | 健康检查和监控 |
| `schemas.py` | Pydantic请求/响应模型 |
| `deps.py` | FastAPI依赖注入 |

### 3. Graph Layer (`app/graph/`)

| 模块 | 职责 |
|------|------|
| `state.py` | 工作流状态定义 |
| `nodes.py` | Agent节点实现 |
| `edges.py` | 状态转换条件 |
| `workflow.py` | 工作流组装和编译 |

### 4. Models Layer (`app/models/`)

| 模块 | 职责 |
|------|------|
| `base.py` | SQLAlchemy基础模型 |
| `session.py` | 会话和消息模型 |
| `memory.py` | 短期/长期记忆模型 |
| `plan.py` | 计划、版本、任务模型 |
| `rag.py` | 文档、分块、索引模型 |

### 5. Services Layer (`app/services/`)

| 模块 | 职责 |
|------|------|
| `model_gateway.py` | 模型网关（路由、降级、成本） |
| `session_service.py` | 会话业务逻辑 |

## 数据流

### 学习计划流程

```
User Input
    ↓
POST /plans/propose
    ↓
[LangGraph] load_context → classify_intent → planner_agent
    ↓
生成提案（保存到DB）
    ↓
返回提案（等待确认）
    ↓
POST /plans/{id}/confirm
    ↓
[LangGraph] user_confirm → execute_tools → memory_write
    ↓
执行完成（创建日历/待办）
```

### 知识问答流程

```
User Question
    ↓
POST /chat/stream
    ↓
[LangGraph] load_context → classify_intent → rag_qa_agent
    ↓
检索相关文档（pgvector）
    ↓
生成回答（带引用）
    ↓
[SSE] token → citation → risk → done
    ↓
reviewer_agent（质量检查）
    ↓
memory_write
```

## 技术选型说明

### 为什么选LangGraph？

1. **状态机编排**：原生支持复杂工作流
2. **Checkpoint**：内置持久化和恢复能力
3. **Human-in-Loop**：支持中断等待用户确认
4. **LangChain生态**：无缝集成现有组件

### 为什么选PostgreSQL+pgvector？

1. **一体化**：结构化数据和向量索引统一存储
2. **事务支持**：保证数据一致性
3. **混合检索**：支持BM25全文检索 + 向量检索
4. **运维简单**：成熟的监控和备份方案

### 为什么选FastAPI？

1. **异步支持**：原生async/await
2. **类型安全**：Pydantic模型验证
3. **自动文档**：OpenAPI/Swagger自动生成
4. **性能优秀**：基于Starlette和Uvicorn

## 扩展性设计

### 水平扩展

- 当前：单体架构
- 未来：可拆分为独立服务
  - `api-service`: API网关
  - `agent-service`: LangGraph工作流
  - `ingestion-service`: 文档处理

### 多租户支持

- 当前：单用户设计
- 未来：添加tenant_id字段即可支持多租户

### 模型扩展

- `model_gateway.py` 使用注册表模式，已支持 Qwen、Kimi、GLM、硅基流动
- 添加新的 Provider 只需：
  1. 在 `ModelProvider` 枚举和 `PROVIDER_REGISTRY` 添加配置
  2. 在 `config.py` 添加对应环境变量
  3. 前端 `AI_PROVIDERS` 添加配置

## 安全设计

### 多层防护

1. **输入层**：参数校验、注入防护
2. **模型层**：Prompt注入过滤
3. **工具层**：权限校验、二次确认
4. **输出层**：敏感信息过滤

### 数据安全

- API Key加密存储
- 数据库连接SSL
- 审计日志记录

## 监控体系

### 日志

- 结构化日志（JSON格式）
- trace_id贯穿全链路
- 支持ELK/Loki收集

### 指标

- 延迟：P50/P95/P99
- 成本：月度/每日统计
- 质量：置信度、命中率

### 追踪

- LangSmith集成
- 按trace_id回放
- Prompt版本管理

## 部署架构

### 开发环境

```
[Electron] ←→ [FastAPI (localhost:8000)] ←→ [PostgreSQL + Redis]
```

### 生产环境

```
[Electron] ←→ [Nginx] ←→ [FastAPI (Docker)] 
                              ↓
                    [PostgreSQL + Redis (Docker)]
```

## 代码规范

### 命名规范

- 模块：`snake_case.py`
- 类：`PascalCase`
- 函数/变量：`snake_case`
- 常量：`UPPER_SNAKE_CASE`

### 导入顺序

1. 标准库
2. 第三方库
3. 应用内模块（使用绝对导入）

### 文档规范

- 模块级：docstring说明职责
- 函数级：Args/Returns/Raises
- 复杂逻辑：行内注释

## 测试策略

### 单元测试

- 覆盖率目标：>80%
- 重点：model_gateway, nodes, edges

### 集成测试

- API端到端测试
- 数据库集成测试

### 性能测试

- 首token延迟 < 3s (P95)
- 并发处理能力

## 版本规划

| 版本 | 功能 | 预计时间 |
|------|------|----------|
| v0.1.0 | 基础底座 | 2026-03 |
| v0.2.0 | RAG接入 | 2026-04 |
| v0.3.0 | 检索与引用 | 2026-05 |
| v0.4.0 | Agent规划 | 2026-06 |
| v1.0.0 | 完整功能 | 2026-10 |
