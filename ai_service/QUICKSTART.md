# FlowBoard AI Service 快速开始

## 5分钟启动指南

### 1. 环境准备（1分钟）

确保已安装：
- Python 3.10+
- PostgreSQL 16+ (带pgvector)
- Redis 7+

使用Docker快速启动依赖：

```bash
# PostgreSQL + pgvector
docker run -d --name fb-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=flowboard_ai \
  -p 5432:5432 \
  ankane/pgvector:latest

# Redis
docker run -d --name fb-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 2. 安装依赖（1分钟）

```bash
cd ai_service

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置环境变量（1分钟）

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件，添加API密钥
# 至少需要配置 QWEN_API_KEY 或 KIMI_API_KEY
```

### 4. 初始化数据库（1分钟）

```bash
# 创建数据库表
python scripts/init_db.py
```

### 5. 启动服务（1分钟）

```bash
# 开发模式（热重载）
python -m app.main

# 或使用脚本
# Windows:
scripts\run_dev.bat
# macOS/Linux:
bash scripts/run_dev.sh
```

服务启动后访问：
- API文档: http://localhost:8000/api/v1/docs
- 健康检查: http://localhost:8000/health

## 测试API

### 创建会话

```bash
curl -X POST http://localhost:8000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-001",
    "title": "测试会话"
  }'
```

### 流式聊天

```bash
curl -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "session_id": "your-session-id",
    "query": "你好，请介绍一下自己"
  }'
```

### 生成学习计划提案

```bash
curl -X POST http://localhost:8000/api/v1/plans/propose \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "your-session-id",
    "goal": "三个月掌握Python后端开发"
  }'
```

## 目录结构速览

```
ai_service/
├── app/
│   ├── api/           # API路由
│   ├── core/          # 核心模块（配置、数据库等）
│   ├── graph/         # LangGraph工作流
│   ├── models/        # 数据库模型
│   ├── services/      # 业务服务
│   └── main.py        # FastAPI入口
├── docs/              # 文档
├── scripts/           # 脚本
├── tests/             # 测试
├── requirements.txt   # 依赖
└── .env.example       # 配置示例
```

## 常用命令

```bash
# 运行测试
pytest

# 代码格式化
black app/
isort app/

# 类型检查
mypy app/

# 数据库迁移
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## 故障排查

### ImportError: No module named 'xxx'

确保已激活虚拟环境：
```bash
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 数据库连接失败

检查PostgreSQL是否运行：
```bash
# Docker
docker ps | grep postgres

# 本地安装
pg_isready -h localhost -p 5432
```

### 模型调用失败

检查API密钥配置：
```bash
# 检查环境变量
echo $QWEN_API_KEY

# 或检查.env文件
cat .env | grep QWEN
```

### 端口被占用

修改 `.env` 中的端口配置：
```bash
API_PORT=8001
```

## 下一步

1. 阅读 [API文档](./docs/API.md) 了解完整接口
2. 阅读 [集成指南](./docs/INTEGRATION.md) 学习前端集成
3. 阅读 [部署指南](./docs/DEPLOYMENT.md) 了解生产部署

## 获取帮助

- 查看日志：`python -m app.main` 的输出
- 检查健康：`curl http://localhost:8000/health`
- 查看指标：`curl http://localhost:8000/metrics`

---

**恭喜！** 你已经成功启动了 FlowBoard AI Service 🎉
