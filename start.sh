#!/bin/bash

echo "======================================"
echo "   FlowBoard 启动脚本"
echo "======================================"
echo ""

echo "正在检查依赖缓存..."
echo ""

npm run bootstrap:deps
if [ $? -ne 0 ]; then
    echo "依赖准备失败，请检查网络连接或 npm 配置"
    exit 1
fi

echo ""
echo "依赖检查完成！"
echo ""

echo "正在启动 FlowBoard..."
echo ""

# 根据平台设置环境变量
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    NODE_ENV=development npm run dev
else
    # Linux
    NODE_ENV=development npm start
fi
