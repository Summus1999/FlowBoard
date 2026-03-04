@echo off
chcp 65001 >nul
echo ======================================
echo    FlowBoard 启动脚本
echo ======================================
echo.

:: 检查 Node.js 依赖
echo [1/4] 检查前端依赖...
call npm run bootstrap:deps
if errorlevel 1 (
    echo 依赖准备失败，请检查网络连接或 npm 配置
    pause
    exit /b 1
)
echo 前端依赖检查完成！
echo.

:: 检查系统 Python 3.8+
echo [2/4] 检查 Python 3.8+ 环境...
python --version >nul 2>nul
if errorlevel 1 (
    echo 错误：未找到 Python！
    echo 请安装 Python 3.8+ 并添加到系统 PATH
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 检查 Python 版本
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo 检测到 Python %PYVER%
echo.

:: 检查并安装 AI 服务依赖
echo [3/4] 检查 AI 服务依赖...
cd ai_service
if not exist "venv" (
    echo 创建虚拟环境...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
if errorlevel 1 (
    echo 依赖安装失败
    cd ..
    pause
    exit /b 1
)

:: 检查 rga 二进制
if not exist "bin\windows\rga.exe" (
    echo 下载 ripgrep-all 二进制...
    python scripts\download_rga.py --platform windows
    if errorlevel 1 (
        echo rga 下载失败，但这不影响基本功能
    )
)
echo AI 服务依赖就绪！
cd ..
echo.

:: 启动服务
echo [4/4] 启动 FlowBoard...
echo.
echo AI 服务将由 Electron 自动管理
echo.

set NODE_ENV=development
npm run dev

pause
