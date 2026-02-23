# FlowBoard AI Service 部署指南

## 环境要求

- Python 3.10+
- PostgreSQL 16+ (带pgvector扩展)
- Redis 7+

## 生产环境部署

### 1. 准备服务器

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3-pip
sudo apt install -y postgresql-16 postgresql-16-pgvector
sudo apt install -y redis-server
```

### 2. 配置PostgreSQL

```bash
# 创建数据库
sudo -u postgres psql -c "CREATE DATABASE flowboard_ai;"
sudo -u postgres psql -c "CREATE USER fbuser WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE flowboard_ai TO fbuser;"

# 启用pgvector
sudo -u postgres psql -d flowboard_ai -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. 配置Redis

```bash
# 编辑redis配置
sudo nano /etc/redis/redis.conf

# 设置密码（可选）
requirepass your_redis_password

# 重启服务
sudo systemctl restart redis
```

### 4. 部署应用

```bash
# 克隆代码
cd /opt
sudo mkdir -p flowboard-ai
sudo chown $USER:$USER flowboard-ai
cd flowboard-ai

# 上传代码...

# 创建虚拟环境
python3.11 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
nano .env
```

### 5. 初始化数据库

```bash
python scripts/init_db.py --async
```

### 6. 使用Systemd管理服务

创建服务文件 `/etc/systemd/system/flowboard-ai.service`:

```ini
[Unit]
Description=FlowBoard AI Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=flowboard
WorkingDirectory=/opt/flowboard-ai
Environment=PATH=/opt/flowboard-ai/venv/bin
EnvironmentFile=/opt/flowboard-ai/.env
ExecStart=/opt/flowboard-ai/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable flowboard-ai
sudo systemctl start flowboard-ai

# 查看状态
sudo systemctl status flowboard-ai
sudo journalctl -u flowboard-ai -f
```

### 7. 配置Nginx反向代理

```nginx
server {
    listen 80;
    server_name ai.flowboard.local;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # SSE支持
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

### 8. 启用HTTPS

使用Let's Encrypt：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ai.flowboard.local
```

## Docker部署

### 使用Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/flowboard_ai
      - REDIS_URL=redis://redis:6379/0
    env_file:
      - .env
    depends_on:
      - db
      - redis
    volumes:
      - ./docs:/app/docs

  db:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: flowboard_ai
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

启动：

```bash
docker-compose up -d
```

## 监控

### 健康检查

```bash
# 服务健康
curl http://localhost:8000/health

# 就绪检查
curl http://localhost:8000/ready

# 指标
curl http://localhost:8000/metrics
```

### 日志监控

配置日志收集（如使用ELK或Loki）：

```json
{
  "app_name": "flowboard-ai",
  "level": "info",
  "message": "request.complete",
  "method": "POST",
  "path": "/api/v1/chat/stream",
  "status_code": 200,
  "duration_ms": 1250,
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b"
}
```

## 备份策略

### 数据库备份

```bash
# 每日备份
0 2 * * * pg_dump -U postgres flowboard_ai | gzip > /backup/flowboard_$(date +\%Y\%m\%d).sql.gz

# 保留最近30天
find /backup -name "flowboard_*.sql.gz" -mtime +30 -delete
```

### 索引备份

```bash
# 导出pgvector数据
pg_dump -U postgres -t rag_chunks flowboard_ai > /backup/vectors_$(date +%Y%m%d).sql
```

## 故障排查

### 常见问题

1. **服务启动失败**
   - 检查数据库连接
   - 检查Redis连接
   - 检查端口占用

2. **模型调用失败**
   - 检查API密钥配置
   - 检查网络连接
   - 查看网关日志

3. **检索超时**
   - 检查pgvector索引
   - 优化查询性能
   - 增加超时时间

### 调试模式

```bash
# 启用调试日志
export DEBUG=true
export LOG_LEVEL=debug

# 重新启动服务
sudo systemctl restart flowboard-ai
```

## 性能优化

1. **数据库优化**
   - 配置连接池大小
   - 创建必要的索引
   - 定期VACUUM

2. **缓存优化**
   - 配置Redis缓存策略
   - 启用查询结果缓存

3. **模型优化**
   - 使用模型缓存
   - 批量处理embedding请求
