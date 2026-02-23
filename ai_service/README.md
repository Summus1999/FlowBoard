# FlowBoard AI Service

FlowBoard AI后端服务 - 基于FastAPI + LangGraph + LangChain的企业级RAG + Agent方案。

## 技术栈

- **框架**: FastAPI + Uvicorn
- **AI编排**: LangGraph (工作流) + LangChain (组件)
- **模型网关**: 支持Qwen(阿里) + Kimi(Moonshot)
- **数据层**: PostgreSQL 16 + pgvector
- **缓存/队列**: Redis
- **观测评测**: LangSmith (可选)

## 功能特性

### 第1期 - 基础底座（当前）
- [x] FastAPI工程骨架
- [x] Model Gateway（模型路由、降级、成本统计）
- [x] PostgreSQL + pgvector + Redis连接
- [x] LangGraph + LangChain基础骨架
- [x] 会话API与流式输出

### 第2期 - RAG接入（规划中）
- [ ] 本地目录文档接入
- [ ] 文档解析与清洗
- [ ] 增量同步
- [ ] 索引版本管理

### 第3期 - 检索与引用（规划中）
- [ ] 混合检索（sparse + dense）
- [ ] rerank接入
- [ ] 可解释引用

### 第4期 - Agent规划与确认（规划中）
- [ ] Planner Agent完整实现
- [ ] 计划提案与确认流程
- [ ] 版本管理与回滚

### 第5期+ - 后续功能（规划中）
- [ ] 任务拆解与恢复
- [ ] 三层记忆体系
- [ ] 面试录音转写
- [ ] 进度复盘Agent

## 快速开始

### 1. 环境准备

```bash
# Python 3.10+
python --version

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑.env文件，配置API密钥等
```

### 4. 启动服务

```bash
# 开发模式（热重载）
python -m app.main

# 或使用uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. 访问API文档

- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

## 数据库设置

### PostgreSQL + pgvector

```bash
# 使用Docker启动（示例）
docker run -d \
  --name flowboard-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=flowboard_ai \
  -p 5432:5432 \
  ankane/pgvector:latest
```

### Redis

```bash
# 使用Docker启动（示例）
docker run -d \
  --name flowboard-redis \
  -p 6379:6379 \
  redis:7-alpine
```

## API接口概览

| 接口 | 描述 |
|------|------|
| `POST /api/v1/chat/stream` | 流式聊天 |
| `POST /api/v1/sessions` | 创建会话 |
| `GET /api/v1/sessions/{id}` | 获取会话 |
| `POST /api/v1/plans/propose` | 生成计划提案 |
| `POST /api/v1/plans/{id}/confirm` | 确认计划 |
| `POST /api/v1/plans/{id}/rollback` | 回滚计划 |
| `POST /api/v1/rag/sources` | 添加文档源 |
| `POST /api/v1/rag/index-jobs` | 触发索引 |
| `GET /api/v1/health` | 健康检查 |

## 项目结构

```
ai_service/
├── app/
│   ├── api/              # API路由和schema
│   │   ├── routes/       # 路由定义
│   │   ├── schemas.py    # Pydantic模型
│   │   └── deps.py       # 依赖注入
│   ├── core/             # 核心模块
│   │   ├── config.py     # 配置管理
│   │   ├── database.py   # 数据库连接
│   │   ├── redis.py      # Redis连接
│   │   ├── exceptions.py # 异常定义
│   │   └── logging.py    # 日志配置
│   ├── graph/            # LangGraph工作流
│   │   ├── state.py      # 状态定义
│   │   ├── nodes.py      # 节点实现
│   │   ├── edges.py      # 边条件
│   │   └── workflow.py   # 工作流组装
│   ├── models/           # SQLAlchemy模型
│   │   ├── session.py    # 会话模型
│   │   ├── memory.py     # 记忆模型
│   │   ├── plan.py       # 计划模型
│   │   └── rag.py        # RAG模型
│   ├── services/         # 业务服务
│   │   └── model_gateway.py  # 模型网关
│   └── main.py           # FastAPI入口
├── tests/                # 测试
├── docs/                 # 文档
├── requirements.txt      # 依赖
└── .env.example          # 环境变量示例
```

## 配置说明

### 模型网关

支持双供应商路由：
- **主路由**: Qwen (阿里通义千问)
- **备路由**: Kimi (Moonshot)

配置环境变量：
```bash
QWEN_API_KEY=your_key
KIMI_API_KEY=your_key
DEFAULT_MODEL_PROVIDER=qwen
FALLBACK_MODEL_PROVIDER=kimi
```

### 成本预算控制

```bash
MONTHLY_BUDGET_RMB=150.0  # 月预算上限
COST_WARNING_THRESHOLD=0.8  # 80%时警告
```

## 开发指南

### 添加新的Agent节点

1. 在 `app/graph/nodes.py` 中定义节点函数
2. 在 `app/graph/workflow.py` 中添加节点到工作流
3. 配置边条件（如需要）

### 添加新的API路由

1. 在 `app/api/routes/` 创建路由文件
2. 在 `app/api/routes/__init__.py` 注册路由

## 测试

```bash
# 运行测试
pytest

# 覆盖率
pytest --cov=app --cov-report=html
```

## 部署

### Docker部署

```bash
# 构建镜像
docker build -t flowboard-ai .

# 运行容器
docker run -d \
  --name flowboard-ai \
  -p 8000:8000 \
  --env-file .env \
  flowboard-ai
```

### 生产环境注意事项

1. 修改 `SECRET_KEY`
2. 配置HTTPS
3. 启用LangSmith追踪
4. 配置日志收集
5. 设置监控告警

## 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/xxx`)
3. 提交更改 (`git commit -am 'Add feature'`)
4. 推送分支 (`git push origin feature/xxx`)
5. 创建Pull Request

## 许可证

MIT License
