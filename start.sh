#!/bin/bash

echo "======================================"
echo "   FlowBoard 启动脚本"
echo "======================================"
echo ""

# 检查 Node.js 依赖
echo "[1/4] 检查前端依赖..."
npm run bootstrap:deps
if [ $? -ne 0 ]; then
    echo "依赖准备失败，请检查网络连接或 npm 配置"
    exit 1
fi
echo "前端依赖检查完成！"
echo ""

# 检查系统 Python 3.8+
echo "[2/4] 检查 Python 3.8+ 环境..."
if ! command -v python3 &> /dev/null; then
    echo "错误：未找到 Python 3！"
    echo "请安装 Python 3.8+："
    echo "  macOS: brew install python3"
    echo "  Linux: sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

PYVER=$(python3 --version 2>&1 | cut -d' ' -f2)
echo "检测到 Python ${PYVER}"
echo ""

# 检查并安装 AI 服务依赖
echo "[3/4] 检查 AI 服务依赖..."
cd ai_service

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境并安装依赖
source venv/bin/activate
pip install -r requirements.txt -q
if [ $? -ne 0 ]; then
    echo "Python 依赖安装失败"
    cd ..
    exit 1
fi

# 下载 rga 二进制（如果不存在）
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
else
    PLATFORM="linux"
fi

if [ ! -f "bin/${PLATFORM}/rga" ]; then
    echo "下载 ripgrep-all 二进制..."
    python3 scripts/download_rga.py --platform ${PLATFORM}
    if [ $? -ne 0 ]; then
        echo "rga 下载失败，但这不影响基本功能"
    fi
fi

echo "AI 服务依赖就绪！"
cd ..
echo ""

# 启动服务
echo "[4/4] 启动 FlowBoard..."
echo ""
echo "AI 服务将由 Electron 自动管理"
echo ""

export NODE_ENV=development

if [[ "$OSTYPE" == "darwin"* ]]; then
    npm run dev
else
    npm start
fi
