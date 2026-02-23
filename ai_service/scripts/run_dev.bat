@echo off
chcp 65001 >nul

:: 开发环境启动脚本（Windows）

echo Starting FlowBoard AI Service in development mode...

:: 检查.env文件
if not exist .env (
    echo Warning: .env file not found, using .env.example
    copy .env.example .env
)

:: 激活虚拟环境（如果存在）
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

:: 设置环境变量
set DEBUG=true
set ENV=development

:: 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug
