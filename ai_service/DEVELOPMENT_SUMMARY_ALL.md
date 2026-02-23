# FlowBoard AI Service - 开发总结（第1-4期）

## 项目概述

本文档汇总了 FlowBoard AI Service 第1-4期的完整开发内容，包括基础底座、RAG接入、检索与引用完善、Agent规划与确认四大阶段。

**开发周期**: 2026-02-24  
**当前版本**: v0.4.0  
**总代码量**: ~12000行

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

核心模型：
- `Session/Message`: 会话和消息
- `ShortTermMemory/LongTermMemory`: 三层记忆体系
- `Plan/PlanVersion/Task`: 计划版本管理
- `RAGDocument/RAGChunk/RAGIndexVersion`: RAG数据模型

### 1.6 API端点（第1期）

```
POST   /chat/stream              # 流式聊天
POST   /chat/evaluate-confidence # 置信度评估
POST   /sessions                 # 创建会话
GET    /sessions/{id}            # 获取会话
POST   /plans/propose            # 生成计划提案
POST   /plans/{id}/confirm       # 确认/拒绝计划
POST   /plans/{id}/rollback      # 回滚计划版本
POST   /rag/sources              # 添加文档源
POST   /rag/index-jobs           # 触发索引任务
GET    /health                   # 健康检查
```

---

## 第2期：RAG接入

### 2.1 文档解析服务

**文件**: `app/services/document_parser.py`

支持格式：
| 格式 | 库 | 特性 |
|------|-----|------|
| PDF | pypdf | 元数据提取、分页 |
| DOCX | python-docx | 段落、表格提取 |
| TXT/MD | 原生 | 编码自动检测、FrontMatter解析 |

编码检测：
```python
# 自动检测GBK/GB18030/UTF-8等
encoding = detector.detect(raw_data)
```

### 2.2 文本处理服务

**文件**: `app/services/text_processor.py`

处理流程：
```
原始文本
    ↓
TextCleaner 清洗
    - 去除页眉页脚
    - 去除页码
    - 规范化空白
    - 标准化标点
    ↓
TextChunker 分块
    - 按段落边界
    - 章节感知
    - 滑动窗口重叠
    ↓
QualityFilter 过滤
    - 长度检查
    - 有效字符比例
    - 重复率检测
    ↓
高质量文本块
```

### 2.3 目录监控服务

**文件**: `app/services/directory_watcher.py`

特性：
- 文件快照：(path, size, mtime, hash)
- 增量同步检测
- 变更事件队列
- 多目录管理

```python
watcher = DirectoryWatcher(watch_path="/docs")
watcher.add_callback(on_file_change)
await watcher.start()
```

### 2.4 索引服务

**文件**: `app/services/indexing_service.py`

文档处理流水线：
```
文档文件
    ↓ 解析
ParsedDocument
    ↓ 清洗
清洗后文本
    ↓ 分块
TextChunk列表
    ↓ 向量化
带Embedding的Chunk
    ↓ 存储
PostgreSQL/pgvector
```

索引版本管理：
- 支持多版本共存
- 原子切换激活版本
- 自动清理旧版本（保留最近5个）

### 2.5 检索服务（基础版）

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

### 2.6 RAG工作器

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

### 3.6 新增API端点（第3期）

```
POST   /chat/rag-query            # 完整RAG查询（非流式）
POST   /chat/evaluate-answer      # 评估回答质量
GET    /eval/retrieval/metrics    # 获取检索指标
POST   /eval/retrieval/evaluate   # 评估单次检索
POST   /eval/qa/evaluate         # 评估问答质量
GET    /eval/dataset             # 获取评测数据集
POST   /eval/dataset/add         # 添加评测样例
POST   /eval/run-batch           # 批量评测
```

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
│   │       ├── rag.py             # 文档索引
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
    "top_k": 5,
    "include_citations": true
  }'
```

### 添加文档源

```bash
curl -X POST http://localhost:8000/api/v1/rag/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "local_dir",
    "path": "/path/to/docs",
    "auto_sync": true
  }'
```

### 评估检索

```bash
curl -X POST http://localhost:8000/api/v1/eval/retrieval/evaluate \
  -d '{"query": "Python基础语法"}'
```

---

## 技术亮点

1. **模块化设计**: 各服务可独立使用，便于测试和维护
2. **LCEL风格**: 链式调用清晰，支持流式处理
3. **多重回退**: 检索失败自动降级，保证可用性
4. **完整评估**: 检索和问答质量可量化评估
5. **中文优化**: 支持中文全文检索

---

## 各期验收对照

| 规划功能 | 第1期 | 第2期 | 第3期 | 第4期 |
|----------|-------|-------|-------|-------|
| FastAPI骨架 | ✅ | - | - | - |
| LangGraph编排 | ✅ | - | - | - |
| Model Gateway | ✅ | - | - | - |
| PostgreSQL+pgvector | ✅ | - | - | - |
| 会话API | ✅ | - | - | - |
| 文档解析 | - | ✅ | - | - |
| 文本清洗分块 | - | ✅ | - | - |
| 增量同步 | - | ✅ | - | - |
| 索引版本管理 | - | ✅ | - | - |
| 混合检索 | - | ✅ | ✅ | - |
| LCEL检索链 | - | - | ✅ | - |
| Rerank | - | - | ✅ | - |
| 可解释引用 | - | - | ✅ | - |
| 中文检索 | - | - | ✅ | - |
| 质量评估 | - | - | ✅ | - |
| Planner Agent | - | - | - | ✅ |
| 计划确认流程 | - | - | - | ✅ |
| 版本回滚 | - | - | - | ✅ |
| 工具联动 | - | - | - | ✅ |

---

## 后续规划

### 第5期：任务拆解与恢复
- Decomposer Agent增强
- 可恢复任务状态机
- 删除/批量修改二次确认

### 第6期：复盘与记忆体系
- 面试录音转写
- 进度复盘Agent
- 三层记忆体系完善

---

## 附录

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

# 其他
httpx==0.27.0
structlog==24.4.0
```

### 数据库配置

```sql
-- 必需扩展
CREATE EXTENSION vector;
CREATE EXTENSION zhparser;  -- 可选，中文检索

-- 向量索引
CREATE INDEX ON rag_chunks USING hnsw (embedding vector_cosine_ops);
```

---

**文档版本**: v1.1  
**最后更新**: 2026-02-24  
**项目状态**: 第1-4期已完成，等待第5期开发


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

| 确认类型 | 场景 | 撤销窗口 |
|---------|------|---------|
| PLAN_CREATION | 创建学习计划 | 30分钟 |
| PLAN_UPDATE | 更新计划 | 30分钟 |
| BATCH_TASK_UPDATE | 批量修改任务 | 10分钟 |
| TASK_DELETE | 删除任务 | 5分钟 |

### 4.3 版本管理

**文件**: `app/services/plan_version_manager.py`

功能：
- 版本历史追踪
- 版本对比（新增/删除/修改）
- 版本回滚
- 自动清理旧版本

### 4.4 工具集成

**文件**: `app/services/tool_integration.py`

集成工具：
- Calendar: 创建学习提醒和里程碑截止
- Todo: 创建学习任务待办
- Scheduler Agent: 批量执行工具调用

### 4.5 API端点（第4期新增）

```
GET    /plans/{id}/versions              # 版本历史
POST   /plans/{id}/rollback              # 版本回滚
POST   /plans/{id}/versions/{no}/compare # 版本对比
GET    /plans                            # 计划列表
```

### 4.6 使用示例

```bash
# 创建学习计划
curl -X POST http://localhost:8000/api/v1/plans/propose \
  -d '{"goal": "三个月掌握Python后端", "constraints": ["每周10小时"]}'

# 确认执行
curl -X POST http://localhost:8000/api/v1/plans/{id}/confirm \
  -d '{"confirmation_id": "xxx", "confirm": true}'

# 版本回滚
curl -X POST http://localhost:8000/api/v1/plans/{id}/rollback \
  -d '{"target_version": 3, "reason": "当前版本过于激进"}'
```
