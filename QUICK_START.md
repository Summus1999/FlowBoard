# FlowBoard 快速开始指南

> 版本：v2.1.0  
> 更新日期：2026-03-05  

---

## 🚀 获取应用（推荐）

### 方式 1: GitHub Actions 自动构建 ⭐

无需安装任何环境，直接在 GitHub 上获取构建好的应用：

1. 打开 GitHub 仓库页面
2. 点击 **Actions** 标签
3. 选择最新的 **Build and Release** 工作流
4. 在页面底部 **Artifacts** 区域下载对应平台的构建包

或者查看 [Releases](https://github.com/Summus1999/FlowBoard/releases) 页面下载稳定版本。

### 方式 2: 本地构建

如果需要修改代码后自行构建，请参考下方说明。

---

## 📋 环境要求

### 必需环境

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 20.x | 前端和 Electron 运行环境 |
| npm | >= 10.x | 包管理器 |
| Python | >= 3.8 | AI 服务运行环境（必需） |

### 验证环境

```bash
# 检查 Node.js
node --version

# 检查 Python
python --version  # Windows
python3 --version # macOS/Linux
```

---

## 🚀 一键启动

### 1. 安装 Node.js 依赖

```bash
npm run bootstrap:deps
```

### 2. 安装 AI 服务依赖

```bash
cd ai_service

# 创建虚拟环境（推荐）
python -m venv .venv

# 激活虚拟环境
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

cd ..
```

### 3. 配置 AI 服务

```bash
cd ai_service
cp .env.example .env
# 编辑 .env 文件，添加你的 API 密钥
cd ..
```

获取 API 密钥：
- [通义千问](https://dashscope.aliyun.com/)
- [Kimi](https://platform.moonshot.cn/)
- [智谱 GLM](https://open.bigmodel.cn/)
- [硅基流动](https://siliconflow.cn/)

### 4. 启动应用

**Windows:**

双击运行 `start.bat` 或在终端执行：

```bash
npm run dev
```

**macOS / Linux:**

```bash
chmod +x start.sh
./start.sh
```

或者：

```bash
npm run dev
```

---

## 📦 构建桌面应用

### 构建所有平台

```bash
npm run build:all
```

### 构建特定平台

```bash
# 仅 Windows
npm run build:win

# 仅 macOS
npm run build:mac

# 仅 Linux
npm run build:linux
```

构建完成后，安装包位于 `dist/` 目录：

- **Windows**: 
  - `FlowBoard-x.x.x.exe` - 安装程序
  - `FlowBoard-x.x.x-portable.exe` - 便携版
- **macOS**: 
  - `FlowBoard-x.x.x.dmg` - 安装镜像
  - `FlowBoard-x.x.x.zip` - 压缩包
- **Linux**: 
  - `FlowBoard-x.x.x.AppImage` - AppImage 格式
  - `FlowBoard-x.x.x.deb` - Debian 包
  - `FlowBoard-x.x.x.tar.gz` - 压缩包

---

## 📁 项目结构

```text
FlowBoard/
├── assets/                  # 图标和资源
│   └── icon.svg             # 应用图标源文件
├── build/                   # 构建配置
│   └── installer.nsh        # Windows 安装脚本
├── css/                     # 样式文件
│   └── style.css            # 玻璃态 UI 样式
├── js/                      # JavaScript 逻辑
│   ├── app.js               # 主应用逻辑
│   ├── ai-chat.js           # AI 助手模块
│   └── ...                  # 其他模块
├── electron/                # Electron 主进程
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   └── ai-service-manager.js # AI 服务管理器
├── ai_service/              # AI 服务端（Python）
│   ├── app/                 # FastAPI 应用
│   │   ├── main.py          # 入口文件
│   │   ├── crews/           # CrewAI 智能体
│   │   ├── api/             # API 路由
│   │   └── services/        # 业务服务
│   ├── requirements.txt     # Python 依赖
│   └── .env                 # 环境配置
├── index.html               # 主页面
├── package.json             # 项目配置
├── start.bat                # Windows 启动脚本
├── start.sh                 # macOS/Linux 启动脚本
├── ELECTRON_SETUP.md        # Electron 详细配置指南
├── AI_SERVICE_ARCHITECTURE.md # AI 服务架构文档
├── API_DOCUMENTATION.md     # API 接口文档
├── README.md                # 项目说明
└── QUICK_START.md           # 本文件
```

---

## 🎨 自定义图标（可选）

1. 替换 `assets/icon.svg` 为你自己的 SVG 图标
2. 运行图标生成脚本：

```bash
npm install sharp --save-dev
node scripts/generate-icons.js
```

3. 按照生成的说明转换为平台特定格式：
   - macOS: `icon.icns`
   - Windows: `icon.ico`

---

## 🔧 常见问题

### 启动时提示 "未找到 Python 3.8+"

**解决**: 安装 Python 3.8+:
- Windows: [python.org](https://www.python.org/downloads/)
- macOS: `brew install python3`
- Linux: `sudo apt install python3 python3-pip`

### AI 服务启动失败

**检查**:
1. Python 依赖是否安装完整: `pip install -r ai_service/requirements.txt`
2. 端口 8000 是否被占用
3. `.env` 文件是否配置正确

### 启动时白屏？

- 检查是否正确安装了依赖：`npm run bootstrap:deps`
- 尝试删除 `node_modules` 后重新安装

### 如何调试？

开发模式下按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS) 打开开发者工具。

### 数据存储在哪里？

- **Windows**: `%APPDATA%/flowboard/`
- **macOS**: `~/Library/Application Support/flowboard/`
- **Linux**: `~/.config/flowboard/`

---

## 📝 功能清单

- [x] 玻璃态 UI 设计
- [x] 多平台账户密码管理
- [x] 4 种主题风格切换
- [x] 实时资讯整合（26个RSS源）
- [x] Electron 桌面应用
- [x] AI 智能助手（多模型/多会话/流式输出）
- [x] CrewAI 多智能体系统（规划/拆解/复盘）
- [x] 知识库 RAG（文档导入/智能问答）
- [x] Markdown 笔记（支持PDF导入）
- [x] 日程管理日历
- [x] 任务看板（支持智能拆解）
- [x] LeetCode 刷题集成
- [x] GitHub 项目追踪
- [x] 应用中心（快速启动本地应用）
- [x] 系统托盘支持
- [x] 窗口状态记忆
- [x] 本地数据持久化
- [x] 跨平台支持 (macOS/Windows/Linux)

---

## 📚 更多文档

- [Electron 配置指南](./ELECTRON_SETUP.md) - 详细的 Electron 配置说明
- [AI 服务架构](./AI_SERVICE_ARCHITECTURE.md) - AI 服务架构设计
- [API 接口文档](./API_DOCUMENTATION.md) - REST API 完整文档
- [FlowBoard Docs](./FlowBoard%20Docs.md) - 详细产品文档
- [README.md](./README.md) - 项目完整介绍

---

**开始使用 FlowBoard 提升你的工作效率吧！** 🎉
