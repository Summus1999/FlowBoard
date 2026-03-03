# FlowBoard AI Service - 开发总结（第1-6期）

## 项目概述

本文档汇总了 FlowBoard AI Service 第1-6期的完整开发内容，涵盖基础底座、RAG接入、检索与引用完善、Agent规划与确认、任务拆解与恢复、复盘与记忆体系六大阶段。

**开发周期**: 2026-02-24  
**当前版本**: v0.6.0  
**总代码量**: ~17500行

---

## 第1期：基础底座

### 1.1 核心架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FlowBoard AI Service                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     FastAPI Layer                           │   │
│  │  - Session API / Chat API / Plan API / RAG API             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   LangGraph Runtime                         │   │
│  │  - Workflow State Machine / Checkpoint / Human-in-Loop     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Agent Runtime                             │   │
│  │  - Planner / Decomposer / RAG QA / Reviewer / Scheduler    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ Model Gateway  │  │ Retrieval Layer  │  │  LangSmith         │
│ - Qwen/Kimi    │  │ - Hybrid Search  │  │  - Trace/Eval      │
│ - Routing      │  │ - Rerank         │  │  - Prompt Version  │
│ - Cost Control │  │ - Citation       │  │                    │
└────────────────┘  └──────────────────┘  └────────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
      ┌──────────────────────────┐
      │   PostgreSQL + pgvector  │
      │   Redis                  │
      └──────────────────────────┘
```

### 1.2 技术栈实现

| 层级 | 选型 | 状态 |
|------|------|------|
| AI服务 | FastAPI | ✅ 已实现 |
| 编排层 | LangGraph | ✅ 已实现 |
| Agent/RAG | LangChain | ✅ 已实现 |
| 数据层 | PostgreSQL + pgvector | ✅ 已实现 |
| 缓存 | Redis | ✅ 已实现 |
| 观测 | LangSmith | ✅ 预留接口 |

### 1.3 Model Gateway（模型网关）

**文件**: `app/services/model_gateway.py`

功能：
- 双供应商支持：Qwen（主）+ Kimi（备）
- 模型配置档：High Quality / Balanced / Cost Effective
- 成本统计和预算控制（月度150 RMB上限）
- Embedding和Rerank接口
- 自动降级策略

```python
# 使用示例
gateway = get_model_gateway()
response = await gateway.generate(
    messages=messages,
    model_profile=ModelProfile.HIGH_QUALITY,
)
```

### 1.4 LangGraph 工作流

**文件**: `app/graph/workflow.py`, `app/graph/nodes.py`, `app/graph/edges.py`

Agent角色：
- **Planner Agent**: 生成学习计划提案
- **Decomposer Agent**: 任务拆解
- **RAG QA Agent**: 检索问答
- **Reviewer Agent**: 质量审核
- **Scheduler Agent**: 日程/待办管理

状态机：
```
INIT -> CONTEXT_LOAD -> INTENT_CLASSIFY -> [PLAN|DECOMPOSE|QA|CHAT]
PLAN -> USER_CONFIRM -> EXECUTION -> MEMORY_WRITE -> END
```

### 1.5 数据库模型

**文件**: `app/models/`

核心实体：
- **Session**: 用户会话
- **Message**: 对话消息
- **Plan**: 学习计划
- **Task**: 学习任务
- **RagDocument/Chunk**: RAG文档和分块
- **Memory**: 短期/长期记忆

---

## 第2期：RAG接入

### 2.1 文档解析服务

**文件**: `app/services/document_parser.py`

支持格式：
| 格式 | 状态 | 说明 |
|------|------|------|
| PDF | ✅ | PyPDF提取文本 |
| DOCX | ✅ | python-docx提取 |
| TXT | ✅ | 自动编码检测 |
| MD | ✅ | Markdown保留格式 |

### 2.2 文本处理

**文件**: `app/services/text_processor.py`

处理流程：
```
原始文本
    ↓ 清洗
清洗后文本
    ↓ 分块 (Semantic/Sentence/Fixed)
文本块
    ↓ 向量化
带Embedding的Chunk
    ↓ 存储
PostgreSQL/pgvector
```

索引版本管理：
- 支持多版本共存
- 原子切换激活版本
- 自动清理旧版本（保留最近5个）

### 2.3 检索服务（基础版）

**文件**: `app/services/retrieval_service.py`

混合检索：
1. **稀疏检索**: PostgreSQL FTS (BM25近似)
2. **稠密检索**: pgvector ANN (余弦相似度)
3. **RRF融合**: Reciprocal Rank Fusion

```sql
-- 稀疏检索
SELECT ts_rank_cd(tsv, plainto_tsquery('simple', query))

-- 稠密检索
SELECT 1 - (embedding <=> query_embedding)
ORDER BY embedding <=> query_embedding
```

### 2.4 RAG工作器

**文件**: `app/services/rag_worker.py`

后台处理：
- 文件变更事件队列
- 异步索引处理
- 全量/增量索引触发

---

## 第3期：检索与引用完善

### 3.1 LangChain LCEL 检索链

**文件**: `app/services/rag_chain.py`

链条组件：
```python
chain = (
    QueryNormalizationRunnable()    # 查询归一化
    | RetrievalRunnable(db)          # 检索
    | RerankRunnable()               # 重排序
    | AnswerGenerationRunnable()     # 生成回答
)
```

支持流式输出：
```python
async for event in chain.astream(query):
    if event["type"] == "token":
        yield event["data"]["text"]
    elif event["type"] == "citation":
        yield event["data"]
```

### 3.2 Rerank 服务

**文件**: `app/services/rerank_service.py`

策略对比：

| 策略 | 方法 | 适用场景 |
|------|------|----------|
| cross_encoder | LLM评分相关性 | 精度要求高 |
| llm | Pointwise判断 | 中等精度 |
| none | 不重排 | 速度优先 |

CrossEncoder评分维度：
- 1.0: 完全相关
- 0.7-0.9: 高度相关
- 0.4-0.6: 部分相关
- 0.1-0.3: 低度相关
- 0.0: 不相关

### 3.3 引用格式化

**文件**: `app/utils/citation.py`

引用格式：
```
行内: Python是一种语言[ref-1]
条目: [ref-1] guide.pdf#第一章 基础 第10页 [路径:/docs/guide.pdf]
```

前端格式：
```json
{
  "ref_id": "ref-1",
  "chunk_id": "uuid",
  "source": "guide.pdf",
  "section": "第一章 基础",
  "page": 10,
  "preview": "Python是一种...",
  "backlink": "/docs/guide.pdf"
}
```

### 3.4 中文全文检索

**文件**: `app/services/retrieval_service_v2.py`

配置：
```sql
-- 安装zhparser
CREATE EXTENSION zhparser;
CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l WITH simple;
```

特性：
- 自动检测中文配置
- 失败自动回退到simple配置
- 支持中英文混合检索

### 3.5 评估服务

**文件**: `app/services/evaluation_service.py`

检索质量指标：
| 指标 | 说明 | 目标值 |
|------|------|--------|
| Hit Rate | 有结果比例 | > 80% |
| Avg Latency | 平均延迟 | < 500ms |
| P95 Latency | 95分位延迟 | < 2000ms |
| Relevance | 相关性 | > 0.7 |
| Diversity | 多样性 | > 0.5 |

问答质量指标：
| 指标 | 说明 | 目标值 |
|------|------|--------|
| Faithfulness | 忠实度 | > 0.7 |
| Completeness | 完整性 | > 0.7 |
| Conciseness | 简洁性 | > 0.7 |

---

## 第4期：Agent规划与确认

### 4.1 Planner Agent

**文件**: `app/services/planner_service.py`

功能：
- **目标分析**: LLM分析学习目标，提取技能、难度、前置知识
- **模板库**: 后端/前端/数据科学三大模板
- **里程碑生成**: 根据模板或自定义生成
- **任务分解**: 自动拆解具体学习任务
- **时间计算**: 总时长和每周投入计算
- **风险评估**: 识别潜在风险

计划提案结构：
```
PlanProposal
├── title: 计划标题
├── overview: 目标概述
├── goals: [LearningGoal]
├── milestones: [Milestone]
├── tasks: [LearningTask]
├── total_duration_days
├── total_hours
├── weekly_schedule
├── risk_assessment
└── alternatives
```

### 4.2 确认服务

**文件**: `app/services/plan_confirmation.py`

人类在环确认机制：
- 30分钟犹豫期（可撤销）
- 10分钟紧急窗口（限制5次/天）
- 5分钟立即撤销（仅限敏感操作）

确认流程：
```
生成提案 -> 展示给用户 -> 等待确认 -> 执行/取消
```

### 4.3 版本管理

**文件**: `app/services/plan_version_service.py`

功能：
- 多版本存储
- 版本对比（diff）
- 回滚到历史版本
- 保留最近10个版本

### 4.4 工具联动

**文件**: `app/services/calendar_service.py`, `app/services/todo_service.py`

日历集成：
- 同步到Google/Outlook/Apple日历
- 学习时间块安排

待办集成：
- 生成待办清单
- 支持多平台同步

---

## 第5期：任务拆解与恢复

### 5.1 增强型Decomposer Agent

**文件**: `app/services/decomposer_service.py`

复杂度分析：
| 复杂度 | 预估时长 | 子任务数 | 策略 |
|--------|----------|----------|------|
| Simple | ≤2h | 1 | 直接执行 |
| Medium | 2-16h | ≤10 | 顺序分解 |
| Complex | 16-40h | ≤20 | 并行分解 |

功能：
- **复杂度分析**: LLM评估任务难度、技能要求、不确定性
- **子任务生成**: 按复杂度策略生成子任务
- **依赖分析**: 识别子任务间的依赖关系
- **时间估算**: 基于复杂度估算各子任务时长
- **批量处理**: 支持批量任务分解，带二次确认

### 5.2 任务状态机

**文件**: `app/services/task_state_machine.py`

状态流转：
```
pending → in_progress → completed
   ↓          ↓           ↓
cancelled  blocked     failed
   └──── recovery_check ──┘
```

恢复机制：
- **Checkpoint**: 任务执行检查点保存
- **Resume**: 从检查点恢复执行
- **Retry**: 失败任务重试策略

### 5.3 批量操作与确认

**文件**: `app/services/batch_service.py`

安全措施：
- 数量阈值检查（默认5个）
- 敏感操作二次确认
- 操作预览和摘要

### 5.4 任务可视化

**文件**: `app/services/visualization_service.py`

支持视图：
- **甘特图**: 时间线视图
- **看板**: Kanban状态视图
- **依赖图**: 任务依赖关系图

---

## 第6期：复盘与记忆体系

### 6.1 面试录音转写服务

**文件**: `app/services/audio_transcription.py`

功能：
- **格式支持**: mp3, wav, m4a, flac
- **语音转写**: Whisper模型转写
- **说话人分离**: 支持多说话人识别
- **复盘生成**: 自动提取Q&A、编程题、沟通表现

输出结构：
```python
InterviewReview
├── qa_analysis: Q&A表现分析
├── coding_analysis: 编程题表现
├── communication: 沟通能力评估
└── suggestions: 改进建议
```

### 6.2 进度复盘Agent

**文件**: `app/services/review_agent.py`

复盘周期：
- **DAILY**: 日复盘
- **WEEKLY**: 周复盘（默认）
- **MONTHLY**: 月复盘
- **MILESTONE**: 里程碑复盘

分析维度：
| 维度 | 说明 |
|------|------|
| 完成率 | 任务完成情况 |
| 学习时长 | 累计学习时间 |
| 连续天数 | 学习连续天数 |
| 一致性 | 学习节奏稳定性 |
| 时间分布 | 各类别时间占比 |
| 生产力 | 高效时段分析 |

复盘内容：
- 数据摘要和学习概况
- 成就识别
- 挑战和障碍分析
- 洞察发现
- 改进建议
- 下周目标

### 6.3 三层记忆体系

**文件**: `app/services/memory_service.py`

架构：
```
┌─────────────────────────────────────────┐
│          UnifiedMemoryService           │
├──────────────┬──────────────┬───────────┤
│ 短期记忆      │  长期记忆    │ 任务记忆   │
│ ShortTerm    │  LongTerm   │  Task     │
├──────────────┼──────────────┼───────────┤
│ 会话级       │  用户级      │ 执行级    │
│ 最近N轮      │  偏好/画像   │ 检查点    │
│ TTL: 24h     │  持久化      │ 历史日志  │
└──────────────┴──────────────┴───────────┘
```

**短期记忆 (ShortTerm)**:
- 会话级别的对话摘要
- 关键约束条件提取
- TTL过期自动清理

**长期记忆 (LongTerm)**:
- 学习目标偏好
- 语言风格偏好
- 学习节奏习惯
- 领域兴趣画像
- 异步从短期记忆提炼

**任务记忆 (TaskMemory)**:
- 任务执行历史
- Checkpoint状态
- 遇到的问题和解决方案

### 6.4 日历服务

**文件**: `app/services/calendar_service.py`

功能：
- 日历事件CRUD
- 外部日历同步 (Google/Outlook/Apple)
- 时间冲突检测
- 可用时段查询

### 6.5 通知服务

**文件**: `app/services/notification_service.py`

通知类型：
- TASK_REMINDER: 任务提醒
- PLAN_UPDATE: 计划更新
- REVIEW_READY: 复盘就绪
- CONFIRMATION_REQUIRED: 需要确认
- SYSTEM: 系统通知
- ACHIEVEMENT: 成就通知

渠道：应用内、邮件、推送、短信

---

## 项目结构总览

```
ai_service/
├── app/
│   ├── main.py                    # FastAPI入口
│   ├── api/
│   │   ├── schemas.py             # Pydantic模型
│   │   ├── deps.py                # 依赖注入
│   │   └── routes/
│   │       ├── chat.py            # 聊天/RAG接口
│   │       ├── session.py         # 会话管理
│   │       ├── plan.py            # 学习计划
│   │       ├── task.py            # 任务管理
│   │       ├── rag.py             # 文档索引
│   │       ├── decomposer.py      # 任务分解
│   │       ├── review.py          # 进度复盘
│   │       ├── memory.py          # 记忆管理
│   │       ├── calendar.py        # 日历同步
│   │       ├── notifications.py   # 通知服务
│   │       ├── evaluation.py      # 评估接口
│   │       └── health.py          # 健康检查
│   ├── core/
│   │   ├── config.py              # 配置管理
│   │   ├── database.py            # 数据库连接
│   │   ├── redis.py               # Redis缓存
│   │   ├── exceptions.py          # 异常定义
│   │   └── logging.py             # 结构化日志
│   ├── graph/                     # LangGraph工作流
│   │   ├── state.py               # 状态定义
│   │   ├── nodes.py               # 节点实现
│   │   ├── edges.py               # 边条件
│   │   └── workflow.py            # 工作流组装
│   ├── models/                    # 数据库模型
│   │   ├── base.py                # 基础模型
│   │   ├── session.py             # 会话/消息
│   │   ├── memory.py              # 短期/长期记忆
│   │   ├── plan.py                # 计划/任务
│   │   └── rag.py                 # RAG模型
│   ├── services/                  # 业务服务
│   │   ├── model_gateway.py       # 模型网关
│   │   ├── document_parser.py     # 文档解析
│   │   ├── text_processor.py      # 文本处理
│   │   ├── directory_watcher.py   # 目录监控
│   │   ├── indexing_service.py    # 索引服务
│   │   ├── retrieval_service.py   # 检索服务
│   │   ├── retrieval_service_v2.py # 检索服务V2
│   │   ├── rerank_service.py      # Rerank服务
│   │   ├── rag_chain.py           # LCEL检索链
│   │   ├── rag_worker.py          # RAG工作器
│   │   ├── session_service.py     # 会话服务
│   │   ├── planner_service.py     # 规划服务
│   │   ├── plan_confirmation.py   # 计划确认
│   │   ├── decomposer_service.py  # 任务分解
│   │   ├── task_state_machine.py  # 任务状态机
│   │   ├── audio_transcription.py # 音频转写
│   │   ├── review_agent.py        # 复盘Agent
│   │   ├── memory_service.py      # 记忆服务
│   │   ├── calendar_service.py    # 日历服务
│   │   ├── notification_service.py # 通知服务
│   │   └── evaluation_service.py  # 评估服务
│   └── utils/
│       ├── text.py                # 文本工具
│       └── citation.py            # 引用工具
├── alembic/                       # 数据库迁移
├── scripts/                       # 脚本
│   ├── init_db.py                 # 初始化数据库
│   ├── run_dev.sh/.bat           # 启动脚本
│   ├── setup_zhparser.sql         # 中文检索配置
│   └── setup_pgvector.sql         # 向量索引配置
├── tests/                         # 测试
│   ├── conftest.py                # Pytest配置
│   ├── test_model_gateway.py      # 模型网关测试
│   ├── test_document_parser.py    # 文档解析测试
│   ├── test_text_processor.py     # 文本处理测试
│   └── test_retrieval.py          # 检索测试
├── docs/                          # 文档
│   ├── API.md                     # API文档
│   ├── ARCHITECTURE.md            # 架构设计
│   ├── DEPLOYMENT.md              # 部署指南
│   ├── INTEGRATION.md             # 前端集成
│   └── DEVELOPMENT_SUMMARY.md     # 开发总结
├── requirements.txt               # 依赖
└── README.md                      # 项目说明
```

---

## 快速开始

### 1. 环境准备

```bash
# Docker启动依赖
docker run -d --name fb-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  ankane/pgvector:latest

docker run -d --name fb-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 2. 安装依赖

```bash
cd ai_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 添加 QWEN_API_KEY 或 KIMI_API_KEY
```

### 4. 初始化数据库

```bash
python scripts/init_db.py

# 配置中文检索（可选）
psql -U postgres -d flowboard_ai -f scripts/setup_zhparser.sql
```

### 5. 启动服务

```bash
python -m app.main
```

访问 http://localhost:8000/api/v1/docs

---

## API使用示例

### 流式聊天

```bash
curl -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"query": "什么是Python？", "mode": "qa"}'
```

### RAG查询

```bash
curl -X POST http://localhost:8000/api/v1/chat/rag-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Python基础语法",
    "session_id": "xxx",
    "top_k": 5
  }'
```

### 生成学习计划

```bash
curl -X POST http://localhost:8000/api/v1/planning/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "goal": "学习Python后端开发",
    "duration_weeks": 12
  }'
```

### 生成进度复盘

```bash
curl -X POST http://localhost:8000/api/v1/review/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "plan_id": "plan_001",
    "period": "weekly"
  }'
```

### 获取记忆上下文

```bash
curl -X GET "http://localhost:8000/api/v1/memory/context?user_id=user_001&session_id=session_001&query=Python学习"
```

---

## 功能完成度总览

| 功能 | 第1期 | 第2期 | 第3期 | 第4期 | 第5期 | 第6期 |
|------|-------|-------|-------|-------|-------|-------|
| FastAPI基础 | ✅ | - | - | - | - | - |
| Model Gateway | ✅ | - | - | - | - | - |
| LangGraph工作流 | ✅ | - | - | - | - | - |
| 数据库模型 | ✅ | - | - | - | - | - |
| 文档解析 | - | ✅ | - | - | - | - |
| 文本处理 | - | ✅ | - | - | - | - |
| 目录监控 | - | ✅ | - | - | - | - |
| 基础检索 | - | ✅ | - | - | - | - |
| LCEL检索链 | - | - | ✅ | - | - | - |
| Rerank | - | - | ✅ | - | - | - |
| 可解释引用 | - | - | ✅ | - | - | - |
| 中文检索 | - | - | ✅ | - | - | - |
| 质量评估 | - | - | ✅ | - | - | - |
| Planner Agent | - | - | - | ✅ | - | - |
| 计划确认流程 | - | - | - | ✅ | - | - |
| 版本回滚 | - | - | - | ✅ | - | - |
| 工具联动 | - | - | - | ✅ | - | - |
| Decomposer Agent | - | - | - | - | ✅ | - |
| 任务状态机 | - | - | - | - | ✅ | - |
| 任务拆解 | - | - | - | - | ✅ | - |
| 批量操作确认 | - | - | - | - | ✅ | - |
| 任务可视化 | - | - | - | - | ✅ | - |
| Review Agent | - | - | - | - | - | ✅ |
| 音频转写 | - | - | - | - | - | ✅ |
| 三层记忆体系 | - | - | - | - | - | ✅ |
| 日历同步 | - | - | - | - | - | ✅ |
| 通知服务 | - | - | - | - | - | ✅ |

---

## 附录

### 完整API端点列表

```
# Health
GET    /health                          # 健康检查
GET    /ready                           # 就绪检查
GET    /metrics                         # 服务指标

# Sessions
POST   /api/v1/sessions                # 创建会话
GET    /api/v1/sessions/{id}           # 获取会话
GET    /api/v1/sessions/{id}/messages  # 获取消息列表
DELETE /api/v1/sessions/{id}           # 删除会话

# Chat
POST   /api/v1/chat/stream             # 流式聊天
POST   /api/v1/chat/rag-query          # RAG查询
POST   /api/v1/chat/evaluate-answer    # 评估回答

# RAG
POST   /api/v1/rag/index               # 索引文档
DELETE /api/v1/rag/index/{doc_id}      # 删除文档
POST   /api/v1/rag/reindex             # 重新索引
POST   /api/v1/rag/search              # 语义搜索
POST   /api/v1/rag/hybrid-search       # 混合搜索

# Planning
POST   /api/v1/planning/generate       # 生成计划
POST   /api/v1/planning/confirm        # 确认计划
POST   /api/v1/planning/reject         # 拒绝计划
POST   /api/v1/planning/{id}/rollback  # 版本回滚
POST   /api/v1/planning/{id}/calendar-sync  # 日历同步

# Tasks
GET    /api/v1/tasks                   # 任务列表
POST   /api/v1/tasks                   # 创建任务
GET    /api/v1/tasks/{id}              # 任务详情
PUT    /api/v1/tasks/{id}              # 更新任务
DELETE /api/v1/tasks/{id}              # 删除任务
POST   /api/v1/tasks/{id}/decompose    # 任务分解
POST   /api/v1/tasks/{id}/checkpoint   # 保存检查点
POST   /api/v1/tasks/{id}/resume       # 恢复任务

# Decomposer
POST   /api/v1/decomposer/analyze      # 复杂度分析
POST   /api/v1/decomposer/decompose    # 分解任务
POST   /api/v1/decomposer/batch        # 批量分解
POST   /api/v1/decomposer/visualize    # 可视化
GET    /api/v1/decomposer/strategies   # 分解策略

# Review
POST   /api/v1/review/generate         # 生成复盘
GET    /api/v1/review/history          # 复盘历史
GET    /api/v1/review/should-review    # 检查复盘
GET    /api/v1/review/metrics          # 进度指标

# Memory
GET    /api/v1/memory/context          # 记忆上下文
GET    /api/v1/memory/short-term/{id}  # 短期记忆
GET    /api/v1/memory/long-term/{id}   # 长期记忆
GET    /api/v1/memory/user-profile/{id} # 用户画像
POST   /api/v1/memory/clear-expired    # 清理过期

# Calendar
GET    /api/v1/calendar/events         # 获取事件
POST   /api/v1/calendar/events         # 创建事件
GET    /api/v1/calendar/sync-status    # 同步状态
POST   /api/v1/calendar/sync           # 同步日历
GET    /api/v1/calendar/availability   # 可用时段

# Notifications
GET    /api/v1/notifications/list      # 通知列表
POST   /api/v1/notifications/mark-read # 标记已读
POST   /api/v1/notifications/mark-all-read # 全部已读
GET    /api/v1/notifications/unread-count # 未读数量
POST   /api/v1/notifications/send      # 发送通知

# Evaluation
GET    /api/v1/eval/retrieval/metrics  # 检索指标
POST   /api/v1/eval/retrieval/evaluate # 评估检索
POST   /api/v1/eval/qa/evaluate        # 评估问答
GET    /api/v1/eval/dataset            # 评测数据集
POST   /api/v1/eval/dataset/add        # 添加样例
POST   /api/v1/eval/run-batch          # 批量评测
```

### 依赖清单

```
# 核心框架
fastapi==0.115.0
uvicorn[standard]==0.32.0
langchain==0.3.0
langgraph==0.2.0

# 数据库
sqlalchemy==2.0.36
asyncpg==0.30.0
pgvector==0.3.0
redis==5.2.0

# 文档处理
pypdf==5.1.0
python-docx==1.1.0
chardet==5.2.0

# AI/ML
openai==1.52.0
 dashscope==1.20.0  # 阿里云灵积模型服务

# 其他
httpx==0.27.0
structlog==24.4.0
python-multipart==0.0.12
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
alembic==1.14.0
```

### 数据库配置

```sql
-- 必需扩展
CREATE EXTENSION vector;
CREATE EXTENSION zhparser;  -- 可选，中文检索

-- 向量索引
CREATE INDEX ON rag_chunks USING hnsw (embedding vector_cosine_ops);

-- 表统计更新
ANALYZE rag_chunks;
```

### 环境变量配置

```bash
# API Keys (at least one required)
QWEN_API_KEY=your_qwen_api_key
KIMI_API_KEY=your_kimi_api_key
GLM_API_KEY=your_glm_api_key
SILFLOW_API_KEY=your_silflow_api_key

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/flowboard_ai
REDIS_URL=redis://localhost:6379/0

# LangSmith (可选)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=flowboard-ai

# Budget
MONTHLY_BUDGET_RMB=150

# Security
SECRET_KEY=your_secret_key_for_jwt
```

---

**文档版本**: v1.4  
**最后更新**: 2026-03-03  
**项目状态**: 第1-6期已完成 ✅，已支持硅基流动作为第四模型提供商
