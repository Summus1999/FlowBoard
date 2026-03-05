# FlowBoard Electron 设置指南

> 版本：v2.1.0  
> 更新日期：2026-03-05  

本指南将帮助你完成 Electron 桌面应用的配置和构建，包括 AI 服务（Python）的集成。

---

## 目录

1. [环境要求](#环境要求)
2. [快速开始](#快速开始)
3. [AI 服务配置](#ai-服务配置)
4. [项目结构](#项目结构)
5. [构建应用](#构建应用)
6. [开发调试](#开发调试)
7. [常见问题](#常见问题)
8. [高级配置](#高级配置)

---

## 环境要求

### 必需环境

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 20.x | 前端和 Electron 运行环境 |
| npm | >= 10.x | 包管理器 |
| Python | >= 3.8 | AI 服务运行环境（必需） |

### 验证环境

```bash
# 检查 Node.js
node --version  # 应显示 v20.x.x 或更高

# 检查 npm
npm --version   # 应显示 10.x.x 或更高

# 检查 Python
python --version  # Windows
python3 --version # macOS/Linux
```

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/Summus1999/FlowBoard.git
cd FlowBoard
```

### 2. 安装 Node.js 依赖

```bash
npm run bootstrap:deps
```

或手动安装：

```bash
npm install
```

### 3. 安装 AI 服务依赖

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

### 4. 配置 AI 服务

创建 AI 服务配置文件：

```bash
cd ai_service
cp .env.example .env
```

编辑 `.env` 文件，添加你的 API 密钥：

```bash
# 至少配置一个模型提供商
QWEN_API_KEY=your_qwen_api_key
KIMI_API_KEY=your_kimi_api_key
GLM_API_KEY=your_glm_api_key
SILFLOW_API_KEY=your_silflow_api_key
```

获取 API 密钥：

- [通义千问](https://dashscope.aliyun.com/)
- [Kimi](https://platform.moonshot.cn/)
- [智谱 GLM](https://open.bigmodel.cn/)
- [硅基流动](https://siliconflow.cn/)

### 5. 开发模式运行

```bash
# 方式1：使用启动脚本（推荐）
# Windows:
start.bat

# macOS/Linux:
chmod +x start.sh
./start.sh

# 方式2：使用 npm 命令
npm run dev
```

首次启动时，Electron 会自动检测并启动 Python AI 服务。

---

## AI 服务配置

### 自动启动（默认）

FlowBoard Electron 应用内置 AI 服务管理器（`electron/ai-service-manager.js`），会自动：

1. 检测系统 Python 3.8+ 环境
2. 检查 AI 服务目录完整性
3. 启动 Python FastAPI 服务
4. 执行健康检查和自动重启

### 手动启动 AI 服务

如需单独启动 AI 服务（用于调试）：

```bash
cd ai_service
source .venv/bin/activate  # macOS/Linux
# 或 .venv\Scripts\activate  # Windows

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 配置说明

AI 服务配置存储在 Electron 的用户数据目录：

- **Windows**: `%APPDATA%/flowboard/config.json`
- **macOS**: `~/Library/Application Support/flowboard/config.json`
- **Linux**: `~/.config/flowboard/config.json`

配置示例：

```json
{
  "aiConfig": {
    "serviceUrl": "http://localhost:8000",
    "apiToken": "",
    "providers": {
      "qwen": {
        "apiKey": "[加密存储]",
        "enabled": true
      },
      "kimi": {
        "apiKey": "[加密存储]",
        "enabled": true
      }
    },
    "defaultProvider": "qwen",
    "fallbackProvider": "kimi",
    "monthlyBudget": 150.0
  }
}
```

API Key 使用 Electron `safeStorage` 加密存储。

---

## 项目结构

```text
FlowBoard/
├── assets/                      # 应用图标和资源
│   ├── icon.svg                 # 图标源文件
│   ├── icon.icns                # macOS 图标
│   └── icon.ico                 # Windows 图标
├── build/                       # 构建配置
│   └── installer.nsh            # Windows 安装程序配置
├── css/                         # 样式文件
│   ├── style.css                # 全局样式
│   ├── ai-chat.css              # AI 助手样式
│   └── ...                      # 其他样式文件
├── js/                          # JavaScript 逻辑
│   ├── app.js                   # 主应用逻辑
│   ├── ai-chat.js               # AI 助手模块
│   ├── ai-settings.js           # AI 服务配置
│   ├── sidebar-registry.js      # 侧边栏注册中心
│   └── ...                      # 其他模块
├── electron/                    # Electron 主进程
│   ├── main.js                  # 主进程入口
│   ├── preload.js               # 预加载脚本
│   └── ai-service-manager.js    # AI 服务管理器
├── ai_service/                  # AI 服务端（Python）
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── core/                # 核心模块
│   │   ├── api/                 # API 路由
│   │   ├── services/            # 业务服务
│   │   ├── crews/               # CrewAI 智能体
│   │   └── models/              # 数据库模型
│   ├── requirements.txt         # Python 依赖
│   └── .env                     # 环境配置
├── index.html                   # 主页面
├── package.json                 # 项目配置
└── README.md                    # 项目说明
```

---

## 构建应用

### 开发模式

```bash
# Windows
npm run dev

# macOS/Linux
NODE_ENV=development npm start
```

### 生产构建

#### 构建所有平台

```bash
npm run build:all
```

#### 构建特定平台

```bash
# 仅 Windows
npm run build:win

# 仅 macOS
npm run build:mac

# 仅 Linux
npm run build:linux
```

构建后的文件位于 `dist/` 目录：

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

### 打包配置

打包配置在 `package.json` 的 `build` 字段：

```json
{
  "build": {
    "appId": "com.flowboard.app",
    "productName": "FlowBoard",
    "directories": {
      "output": "dist"
    },
    "files": [
      "index.html",
      "css/**/*",
      "js/**/*",
      "assets/**/*",
      "electron/**/*"
    ],
    "extraResources": [
      {
        "from": "ai_service",
        "to": "ai_service",
        "filter": [
          "**/*",
          "!**/__pycache__/**",
          "!**/*.pyc",
          "!**/.venv/**"
        ]
      }
    ]
  }
}
```

注意：`extraResources` 配置将 Python AI 服务打包到应用中。

---

## 开发调试

### 打开开发者工具

开发模式下自动打开开发者工具。生产模式可使用快捷键：

- **Windows/Linux**: `Ctrl + Shift + I`
- **macOS**: `Cmd + Option + I`

或通过菜单：视图 → 开发者工具

### 主进程调试

在主进程中添加日志：

```javascript
// electron/main.js
console.log('[FlowBoard] 调试信息:', variable);
```

或使用结构化日志：

```javascript
const log = require('electron-log');
log.info('应用启动');
log.error('错误信息', error);
```

### AI 服务调试

AI 服务日志输出到终端：

```
[AI Service] INFO:     Application startup complete.
[AI Service] INFO:     database.initialized
[AI Service] INFO:     model_gateway.ready
```

在浏览器中访问 API 文档：

```
http://localhost:8000/api/v1/docs
```

### 热重载

前端代码修改后需要手动刷新（`F5` 或 `Ctrl+R`）。

主进程代码修改后需要重启应用。

---

## 常见问题

### Q: 启动时提示 "未找到 Python 3.8+"

**原因**: 系统未安装 Python 或 Python 版本过低。

**解决**:

1. 安装 Python 3.8+:
   - Windows: [python.org](https://www.python.org/downloads/)
   - macOS: `brew install python3`
   - Linux: `sudo apt install python3 python3-pip`

2. 确保 Python 添加到系统 PATH

3. 验证安装:
   ```bash
   python --version
   ```

### Q: AI 服务启动失败

**检查步骤**:

1. 检查 Python 依赖是否安装完整:
   ```bash
   cd ai_service
   pip install -r requirements.txt
   ```

2. 检查端口 8000 是否被占用:
   ```bash
   # Windows
   netstat -ano | findstr :8000
   
   # macOS/Linux
   lsof -i :8000
   ```

3. 查看详细错误日志:
   ```bash
   # 手动启动 AI 服务查看错误
   cd ai_service
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

### Q: 构建失败

**常见原因**:

1. **缺少依赖**:
   ```bash
   npm install
   npm run postinstall
   ```

2. **Python 环境问题**:
   确保 `ai_service` 目录可以被正确打包。

3. **图标文件缺失**:
   确保 `assets/icon.icns` 和 `assets/icon.ico` 存在。

### Q: macOS 上提示 "应用已损坏"

**原因**: 应用未签名，被 macOS 安全机制阻止。

**解决**:

```bash
# 移除隔离属性
xattr -cr /Applications/FlowBoard.app
```

或通过系统偏好设置 → 安全性与隐私 → 通用，点击"仍要打开"。

### Q: API Key 无法保存

**原因**: Electron `safeStorage` 在某些 Linux 环境可能不可用。

**解决**:

1. 确保系统密钥服务正常运行
2. 检查用户数据目录权限
3. 查看降级加密方案是否生效（AES-256-CBC）

### Q: AI 响应超时

**可能原因**:

1. 网络连接问题
2. API Key 无效或额度不足
3. 模型服务繁忙

**解决**:

1. 检查网络连接
2. 验证 API Key 有效性（在设置中测试连接）
3. 切换到其他模型提供商
4. 增加超时时间配置

---

## 高级配置

### 代码签名（正式发布推荐）

#### macOS 代码签名

需要 Apple Developer ID 证书。

在 `package.json` 中添加：

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (Team ID)",
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    }
  }
}
```

#### Windows 代码签名

需要代码签名证书。

环境变量方式：

```bash
set WIN_CSC_LINK=path/to/certificate.p12
set WIN_CSC_KEY_PASSWORD=your-password
```

### 自动更新

配置 Electron 自动更新（使用 electron-updater）：

```javascript
// electron/main.js
const { autoUpdater } = require('electron-updater');

// 检查更新
autoUpdater.checkForUpdatesAndNotify();
```

### 性能优化

1. **启用 ASAR 打包**:
   ```json
   {
     "build": {
       "asar": true
     }
   }
   ```

2. **启用压缩**:
   ```json
   {
     "build": {
       "compression": "maximum"
     }
   }
   ```

3. **排除不必要的文件**:
   ```json
   {
     "build": {
       "files": [
         "!**/*.map",
         "!**/tests/**"
       ]
     }
   }
   ```

### 环境变量

开发时可用的环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | `development`, `production` |
| `FLOWBOARD_ALLOW_INSECURE_WEB_SECURITY` | 允许不安全 Web 安全（开发用） | `1` |
| `DEBUG` | 调试模式 | `true` |

---

## 参考文档

- [Electron 文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [CrewAI 文档](https://docs.crewai.com/)

---

*文档版本: v2.1.0 | 最后更新: 2026-03-05*
