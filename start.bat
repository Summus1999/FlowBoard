@echo off
chcp 65001 >nul
echo ======================================
echo    FlowBoard 启动脚本
echo ======================================
echo.

echo 正在检查依赖缓存...
echo.
npm run bootstrap:deps
if errorlevel 1 (
    echo 依赖准备失败，请检查网络连接或 npm 配置
    pause
    exit /b 1
)
echo.
echo 依赖检查完成！
echo.

echo 正在启动 FlowBoard...
echo.
npm run dev

pause
