# FlowBoard AI 服务架构文档

> 版本：v2.1.0  
> 更新日期：2026-03-05  
> 架构师：FlowBoard Team

---

## 目录

1. [架构概览](#架构概览)
2. [核心组件](#核心组件)
3. [CrewAI 多智能体系统](#crewai-多智能体系统)
4. [数据流](#数据流)
5. [配置说明](#配置说明)
6. [扩展指南](#扩展指南)

---

## 架构概览

FlowBoard AI 服务是一个基于 FastAPI 的 Python 后端服务，集成了 CrewAI 多智能体系统、LangGraph 工作流、RAG 检索增强生成等先进 AI 技术。

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FlowBoard Electron App                             │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  AI Chat    │  │   Plan      │  │    Task     │  │  Knowledge  │         │
│  │  Interface  │  │  Generator  │  │ Decomposer  │  │    Base     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                              HTTP / WebSocket
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                         AI Service (FastAPI)                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Layer                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │  chat    │ │   plan   │ │decomposer│ │   rag    │ │  config  │  │   │
│  │  │  router  │ │  router  │ │  router  │ │  router  │ │  router  │  │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │   │
│  └───────┼────────────┼────────────┼────────────┼────────────┼────────┘   │
│          │            │            │            │            │             │
│  ┌───────┴────────────┴────────────┴────────────┴───────────────────────┐  │
│  │                      Service Layer                                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │Model Gateway │  │    Crew      │  │RAG Service   │              │  │
│  │  │              │  │  Executor    │  │              │              │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │  │
│  └─────────┼─────────────────┼─────────────────┼──────────────────────┘  │
│            │                 │                 │                         │
│  ┌─────────┴─────────────────┴─────────────────┴───────────────────────┐  │
│  │                    CrewAI Multi-Agent System                         │  │
│  │                                                                      │  │
│  │   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │  │
│  │   │Planner Agent │      │Decomposer    │      │Reviewer Agent│      │  │
│  │   │              │      │Agent         │      │              │      │  │
│  │   │- 目标分析     │      │- 复杂度评估   │      │- 指标分析     │      │  │
│  │   │- 里程碑规划   │      │- 任务拆解     │      │- 复盘报告     │      │  │
│  │   │- 时间安排     │      │- 依赖分析     │      │- 改进建议     │      │  │
│  │   └──────┬───────┘      └──────┬───────┘      └──────┬───────┘      │  │
│  │          │                     │                     │              │  │
│  │          └─────────────────────┼─────────────────────┘              │  │
│  │                                │                                    │  │
│  │                    ┌───────────▼───────────┐                        │  │
│  │                    │    Crew Executor      │                        │  │
│  │                    │   (Orchestration)     │                        │  │
│  │                    └───────────┬───────────┘                        │  │
│  └────────────────────────────────┼────────────────────────────────────┘  │
│                                   │                                        │
│  ┌────────────────────────────────▼────────────────────────────────────┐  │
│  │                        Infrastructure Layer                          │  │
│  │                                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
│  │  │Model Gateway │  │Vector Store  │  │  Database    │              │  │
│  │  │              │  │  (ChromaDB)  │  │  (SQLite)    │              │  │
│  │  │- Qwen        │  │              │  │              │              │  │
│  │  │- Kimi        │  │- Embeddings │  │- Sessions    │              │  │
│  │  │- GLM         │  │- Retrieval  │  │- Plans       │              │  │
│  │  │- SilFlow     │  │- Reranking  │  │- Tasks       │              │  │
│  │  │- Failover    │  │              │  │- Messages    │              │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. Model Gateway（模型网关）

**文件**: `app/services/model_gateway.py`

模型网关是 AI 服务的核心组件，负责统一封装多模型提供商的调用。

#### 支持的提供商

| 提供商 | 标识 | 配置档 |
|--------|------|--------|
| 通义千问 | `qwen` | HIGH_QUALITY: qwen-max<br>BALANCED: qwen-plus<br>COST_EFFECTIVE: qwen-turbo |
| Kimi | `kimi` | HIGH_QUALITY: moonshot-v1-32k<br>BALANCED: moonshot-v1-8k |
| 智谱 GLM | `glm` | HIGH_QUALITY: glm-4<br>BALANCED: glm-4-flash |
| 硅基流动 | `silflow` | HIGH_QUALITY: DeepSeek-V3<br>BALANCED: Qwen2.5-72B |

#### 核心功能

```python
# 生成文本响应
response = await gateway.generate(
    messages=messages,
    model_profile=ModelProfile.HIGH_QUALITY,
    provider=ModelProvider.QWEN,
)

# 流式生成
async for delta in gateway.generate_stream(messages, model_profile):
    yield delta

# Embedding
embeddings = await gateway.embed(texts=["text1", "text2"])
```

#### 降级策略

1. **预算控制**: 接近预算阈值时自动降级到低成本模型
2. **故障转移**: 首选模型不可用时自动切换到备用提供商
3. **超时重试**: 支持配置超时和重试次数

---

### 2. 数据库层

**文件**: `app/core/database.py`, `app/models/`

使用 SQLAlchemy 2.0 + aiosqlite 实现异步数据库操作。

#### 数据模型

| 模型 | 用途 | 关键字段 |
|------|------|----------|
| `Session` | 会话管理 | id, title, created_at, updated_at |
| `ChatMessage` | 聊天消息 | session_id, role, content, timestamp |
| `Plan` | 学习计划 | title, goal, milestones, status |
| `Task` | 任务 | title, description, status, priority |
| `Memory` | 记忆 | user_id, content, importance |
| `RAGDocument` | RAG 文档 | title, content, embedding |

#### 数据库迁移

使用 Alembic 管理数据库迁移：

```bash
# 创建迁移
cd ai_service
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head
```

---

### 3. RAG 服务

**文件**: `app/services/retrieval_service_v2.py`, `app/sirchmunk/`

实现检索增强生成（Retrieval-Augmented Generation）。

#### 核心组件

```
RAG Pipeline:
1. Document Ingestion
   └─> DocumentParser (PDF, Word, Markdown)
       └─> Text Chunking
           └─> Embedding Generation
               └─> Vector Store (ChromaDB)

2. Query Processing
   └─> Query Analysis
       └─> Vector Search (Top-K)
           └─> Reranking
               └─> Context Assembly
                   └─> LLM Generation
```

#### Sirchmunk 检索引擎

可选的高级检索引擎，基于 DuckDB + ripgrep-all：

```python
# 配置启用 Sirchmunk
USE_SIRCHMUNK=true
SIRCHMUNK_WORK_PATH=./data/sirchmunk
SIRCHMUNK_DEFAULT_MODE=FAST  # FAST, DEEP, FILENAME_ONLY
```

---

## CrewAI 多智能体系统

FlowBoard 集成 **CrewAI >= 0.70.0** 构建多智能体协作系统。

### 智能体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     CrewAI System                            │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                 Crew Executor                        │  │
│   │         (Orchestrates Agent Collaboration)           │  │
│   └───────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│        ┌──────────────┼──────────────┐                      │
│        │              │              │                      │
│   ┌────▼─────┐   ┌────▼─────┐   ┌────▼─────┐               │
│   │ Planner  │   │Decomposer│   │ Reviewer │               │
│   │  Agent   │   │  Agent   │   │  Agent   │               │
│   └────┬─────┘   └────┬─────┘   └────┬─────┘               │
│        │              │              │                      │
│        └──────────────┼──────────────┘                      │
│                       │                                      │
│   ┌───────────────────▼───────────────────┐                 │
│   │           Shared Tools                 │                 │
│   │  - GoalAnalysisTool                    │                 │
│   │  - TemplateMatchingTool                │                 │
│   │  - MetricsCalculatorTool               │                 │
│   │  - DatabaseQueryTool                   │                 │
│   └───────────────────────────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1. 规划师智能体 (Planner Agent)

**文件**: `app/crews/agents/planner_agent.py`

负责制定学习计划和里程碑规划。

#### 角色定义

```python
role = "学习计划规划师"
goal = "根据用户的学习目标，制定结构化、可执行的学习计划"
backstory = """你是一位经验丰富的学习规划专家，拥有10年以上的教育咨询和课程设计经验。
你擅长：
1. 分析用户的学习目标，识别核心技能需求
2. 将长期目标拆分为可管理的里程碑
3. 设计循序渐进的学习路径
4. 考虑用户的时间约束和学习风格
5. 识别潜在风险并提供应对策略"""
```

#### 能力

- 目标分析
- 里程碑规划（3-5个）
- 任务列表生成
- 风险评估
- 时间安排建议

#### 使用示例

```python
from app.crews.learning_crew import create_planning_crew

crew = create_planning_crew(
    goal_description="学习Python后端开发",
    target_date="2024-06-01",
    weekly_hours=10,
    constraints=["工作日每晚2小时", "周末可全天学习"]
)
result = crew.kickoff()
```

---

### 2. 任务拆解专家 (Decomposer Agent)

**文件**: `app/crews/agents/decomposer_agent.py`

负责将复杂任务分解为可执行的子任务。

#### 角色定义

```python
role = "任务拆解专家"
goal = "将复杂的学习任务拆分为可执行的子任务，分析任务间的依赖关系"
backstory = """你是一位资深的项目管理和任务分解专家，
你的专长包括：
1. 评估任务复杂度（简单/中等/复杂）
2. 将大任务拆分为30分钟到4小时的可执行单元
3. 识别任务间的依赖关系和阻塞点
4. 计算关键路径，优化执行顺序
5. 识别可并行执行的任务，提高学习效率"""
```

#### 能力

- 复杂度评估
- 任务拆解（30分钟-4小时粒度）
- 依赖关系分析
- 关键路径计算
- 并行任务识别

#### 使用示例

```python
from app.crews.learning_crew import create_decomposition_crew

crew = create_decomposition_crew(
    task_title="实现用户认证系统",
    task_description="设计并实现一个完整的用户认证系统",
    estimated_hours=16,
    context="使用JWT令牌，支持OAuth2"
)
result = crew.kickoff()
```

---

### 3. 学习复盘师 (Reviewer Agent)

**文件**: `app/crews/agents/reviewer_agent.py`

负责分析学习进度并生成复盘报告。

#### 角色定义

```python
role = "学习进度复盘师"
goal = "分析用户的学习进度数据，识别成就和挑战，生成有价值的复盘报告"
backstory = """你是一位资深的学习教练和数据分析师，
你的复盘风格：
- 客观但鼓励：既指出问题，也肯定进步
- 数据驱动：用数字说话，避免空泛评价
- 可执行：建议具体明确，易于落地
- 正向引导：关注成长而非比较"""
```

#### 能力

- 成就识别
- 挑战分析
- 进度评估
- 改进建议
- 下阶段目标设定

#### 使用示例

```python
from app.crews.learning_crew import create_review_crew

crew = create_review_crew(
    period="weekly",
    tasks_data=json.dumps(tasks_data),
    start_date="2024-01-01",
    end_date="2024-01-07"
)
result = crew.kickoff()
```

---

### LLM 适配器

**文件**: `app/crews/llm_adapter.py`

`FlowBoardLLM` 适配器将 ModelGateway 桥接到 CrewAI：

```python
from app.crews.llm_adapter import FlowBoardLLM, FlowBoardLLMHighQuality

# 高质量模型（用于规划）
llm_high = FlowBoardLLMHighQuality()

# 平衡模型（用于拆解）
llm_balanced = FlowBoardLLMBalanced()

# 经济型模型（用于简单任务）
llm_cost = FlowBoardLLMCostEffective()
```

---

## 数据流

### 1. 学习计划生成流程

```
用户输入目标
    │
    ▼
┌─────────────────┐
│   Planning API  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│     Planning Crew           │
│  ┌───────────────────────┐  │
│  │ 1. 目标分析任务        │  │
│  │    └─> Planner Agent   │  │
│  └───────────┬───────────┘  │
│              │              │
│              ▼              │
│  ┌───────────────────────┐  │
│  │ 2. 计划生成任务        │  │
│  │    └─> Planner Agent   │  │
│  └───────────┬───────────┘  │
└──────────────┼──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      Plan Confirmation      │
│  - 用户确认/修改            │
│  - 版本管理                 │
└─────────────┬───────────────┘
              │
              ▼
        保存到数据库
```

### 2. 任务拆解流程

```
复杂任务输入
    │
    ▼
┌─────────────────┐
│ Decomposer API  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│   Decomposition Crew        │
│  ┌───────────────────────┐  │
│  │ 1. 复杂度评估任务      │  │
│  │    └─> Decomposer Agent│  │
│  └───────────┬───────────┘  │
│              │              │
│              ▼              │
│  ┌───────────────────────┐  │
│  │ 2. 任务拆解任务        │  │
│  │    └─> Decomposer Agent│  │
│  └───────────┬───────────┘  │
└──────────────┼──────────────┘
               │
               ▼
        生成子任务列表
```

### 3. 复盘报告生成流程

```
学习数据输入
    │
    ▼
┌─────────────────┐
│   Review API    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│      Review Crew            │
│  ┌───────────────────────┐  │
│  │ 1. 指标分析任务        │  │
│  │    └─> Reviewer Agent  │  │
│  └───────────┬───────────┘  │
│              │              │
│              ▼              │
│  ┌───────────────────────┐  │
│  │ 2. 复盘生成任务        │  │
│  │    └─> Reviewer Agent  │  │
│  └───────────┬───────────┘  │
└──────────────┼──────────────┘
               │
               ▼
        生成复盘报告
```

---

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DEBUG` | 调试模式 | `false` |
| `API_PORT` | 服务端口 | `8000` |
| `DATA_DIR` | 数据目录 | `./local_data` |
| `DEFAULT_MODEL_PROVIDER` | 默认模型提供商 | `qwen` |
| `FALLBACK_MODEL_PROVIDER` | 备用模型提供商 | `kimi` |
| `MONTHLY_BUDGET_RMB` | 月度预算（元） | `150.0` |

### 模型提供商配置

```bash
# 通义千问
QWEN_API_KEY=your_key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# Kimi
KIMI_API_KEY=your_key
KIMI_BASE_URL=https://api.moonshot.cn/v1

# 智谱 GLM
GLM_API_KEY=your_key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# 硅基流动
SILFLOW_API_KEY=your_key
SILFLOW_BASE_URL=https://api.siliconflow.cn/v1
```

### RAG 配置

```bash
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=100
RAG_TOP_K=8
RAG_RERANK_TOP_K=5
RAG_CONFIDENCE_THRESHOLD=0.9
```

### CrewAI 配置

```bash
# 可选：LangSmith 追踪
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_key
```

---

## 扩展指南

### 添加新的智能体

1. **创建智能体定义**

```python
# app/crews/agents/my_agent.py
from crewai import Agent
from app.crews.llm_adapter import FlowBoardLLM

def create_my_agent(verbose=True):
    return Agent(
        role="新智能体角色",
        goal="智能体目标描述",
        backstory="智能体背景故事",
        llm=FlowBoardLLM(),
        verbose=verbose,
        memory=True,
    )
```

2. **创建任务定义**

```python
# app/crews/tasks/my_tasks.py
from crewai import Task

def create_my_task(agent, **kwargs):
    return Task(
        description="任务描述",
        expected_output="期望输出格式",
        agent=agent,
    )
```

3. **编排 Crew**

```python
# app/crews/learning_crew.py
def create_my_crew(**kwargs):
    agent = create_my_agent()
    task = create_my_task(agent)
    
    return Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
    )
```

4. **添加 API 路由**

```python
# app/api/routes/my_route.py
from fastapi import APIRouter
from app.crews.learning_crew import create_my_crew

router = APIRouter()

@router.post("/my-endpoint")
async def my_endpoint(request: MyRequest):
    crew = create_my_crew()
    result = crew.kickoff()
    return {"result": result.raw}
```

### 添加新的模型提供商

1. **在 `ModelProvider` 枚举中添加**

```python
# app/services/model_gateway.py
class ModelProvider(str, Enum):
    QWEN = "qwen"
    KIMI = "kimi"
    GLM = "glm"
    SILFLOW = "silflow"
    NEW_PROVIDER = "new_provider"  # 新增
```

2. **在注册表中添加配置**

```python
PROVIDER_REGISTRY = {
    # ... 现有配置
    ModelProvider.NEW_PROVIDER: {
        "name": "新提供商",
        "config_key_prefix": "NEW",
        "default_base_url": "https://api.example.com",
        "profiles": {
            ModelProfile.HIGH_QUALITY: "model-large",
            ModelProfile.BALANCED: "model-medium",
        },
        "pricing": {
            "model-large": {"input": 0.01, "output": 0.03},
        }
    },
}
```

3. **在 `config.py` 中添加配置项**

```python
# app/core/config.py
NEW_API_KEY: Optional[str] = None
NEW_BASE_URL: str = "https://api.example.com"
NEW_DEFAULT_MODEL: str = "model-medium"
```

---

## 监控与日志

### 结构化日志

使用 structlog 输出结构化日志：

```python
from app.core.logging import get_logger

logger = get_logger(__name__)

logger.info(
    "event_description",
    key1="value1",
    key2="value2",
)
```

### LangSmith 追踪（可选）

启用 LangSmith 进行调用追踪：

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=your_key
export LANGSMITH_PROJECT=flowboard-ai
```

---

## 性能优化

### 1. 模型调用优化

- 使用 `ModelProfile.COST_EFFECTIVE` 处理简单任务
- 启用请求去重（Idempotency）
- 配置合理的超时和重试

### 2. RAG 优化

- 调整 `RAG_CHUNK_SIZE` 和 `RAG_CHUNK_OVERLAP`
- 使用重排序（Reranking）提升检索质量
- 考虑启用 Sirchmunk 进行高级检索

### 3. 数据库优化

- 使用异步数据库操作
- 添加必要的索引
- 定期清理过期数据

---

*文档版本: v2.1.0 | 最后更新: 2026-03-05*
