@echo off
chcp 65001 >nul
echo ======================================
echo    FlowBoard 启动脚本
echo ======================================
echo.

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    echo.
    npm install
    if errorlevel 1 (
        echo 安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo.
    echo 依赖安装完成！
    echo.
)

echo 正在启动 FlowBoard...
echo.
npm run dev

pause
