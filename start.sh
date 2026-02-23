#!/bin/bash

echo "======================================"
echo "   FlowBoard 启动脚本"
echo "======================================"
echo ""

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "安装失败，请检查网络连接"
        exit 1
    fi
    echo ""
    echo "依赖安装完成！"
    echo ""
fi

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
