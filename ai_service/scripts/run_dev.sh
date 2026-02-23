#!/bin/bash

# 开发环境启动脚本

echo "Starting FlowBoard AI Service in development mode..."

# 检查.env文件
if [ ! -f .env ]; then
    echo "Warning: .env file not found, using .env.example"
    cp .env.example .env
fi

# 激活虚拟环境（如果存在）
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 设置环境变量
export DEBUG=true
export ENV=development

# 启动服务
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level debug
