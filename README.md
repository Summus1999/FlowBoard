# FlowBoard - 个人工作台

[![Build Status](https://github.com/Summus1999/FlowBoard/actions/workflows/build.yml/badge.svg)](https://github.com/Summus1999/FlowBoard/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28.x-blue.svg)](https://electronjs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org/)
[![CrewAI](https://img.shields.io/badge/CrewAI-0.70.0+-green.svg)](https://crewai.com/)

一款跨平台的个人工作台桌面应用，采用现代化的玻璃态 UI 设计，支持多平台账户密码管理、界面UI风格切换、实时资讯整合、LeetCode刷题、GitHub项目追踪、AI智能助手等功能。

![UI预览](./UI风格参考.png)

## 功能特性

### ✅ 已完成的功能

1. **多平台账户密码管理**
   - 卡片式展示各平台账户（12个国内常用账号预设）
   - 分类筛选（社交/工作/金融/娱乐）
   - 密码强度可视化指示（弱/中/强）
   - 一键复制用户名/密码
   - 添加/编辑/删除账户
   - 安全评分圆环显示

2. **界面UI风格切换**
   - 4种主题风格：深海蓝、极光紫、森林绿、简约白
   - 毛玻璃效果开关
   - 动画效果控制
   - 圆角大小调节（0-20px）
   - 主题设置自动保存

3. **实时资讯整合**
   - 📰 **26 个优质资讯源**（17 个国外 +9 个国内）
   - 🌍 覆盖科技/AI/财经/娱乐等多领域
   - ⚡ 自动更新（每 4 小时）+ 手动刷新
   - 🔍 热门话题标签和分类筛选
   - 💾 本地缓存，离线可阅读历史内容

4. **AI 智能助手**
   - 🤖 **多会话对话**：支持创建、切换、删除、重命名会话
   - 💬 **流式输出**：实时显示模型回复
   - 🔄 **多模型路由**：通义千问、Kimi、智谱 GLM、硅基流动，自动故障转移
   - 📝 **CrewAI 智能体**：规划师、任务拆解专家、学习复盘师
   - 📚 **知识库 RAG**：文档导入、向量检索、智能问答
   - 🔐 **API Key 加密存储**：使用 Electron safeStorage 保护密钥

5. **Markdown 笔记编辑器**
   - 三种编辑模式：编辑/预览/分屏
   - 完整的 Markdown 语法支持
   - 代码语法高亮（highlight.js）
   - 自动保存功能
   - 笔记分类管理（工作/学习/生活/灵感）
   - PDF 导入自动转换为 Markdown

6. **日程管理日历**
   - 月历视图，支持月份切换
   - 事件分类（工作/个人/重要/其他）
   - 添加/编辑/删除日程
   - 事件提醒指示

7. **LeetCode 刷题集成**
   - 题目列表（支持 API 和本地数据双模式）
   - Monaco Editor 代码编辑器（VS Code 同款）
   - 备用 textarea 编辑器（Monaco 加载失败时自动切换）
   - 代码智能提示（算法模板、常用代码片段）
   - 多语言支持（JavaScript/Python/Java/C++等）
   - 本地模拟运行和提交
   - 提交历史追踪（连续打卡天数统计）

8. **GitHub 项目追踪**
   - 用户名登录（支持 Token 访问私有仓库）
   - 自动显示最近更新的仓库
   - 仓库统计（Stars/Forks/语言/最后提交时间）
   - 用户统计（公开仓库数/关注者数/总星标数）

9. **应用中心**
   - 快速启动本地应用（微信/QQ/VS Code/浏览器等）
   - 自定义添加应用
   - 25种预设图标（含 AI 应用专属图标）
   - 图标 DIY：预设图标 / Emoji / 本地图片上传
   - 图片图标格式限制：png/jpg/jpeg/webp（不支持 svg）
   - 桌面端拖拽排序（排序模式），结果自动持久化
   - 应用可用状态检测

10. **面试追踪**
    - 录音功能（使用 IndexedDB 存储）
    - 面试笔记记录
    - 面试 Checklist
    - 录音回放和下载

11. **个人提升**
    - 学习计划导入（Markdown/PDF）
    - 预设学习模板（前端/算法/系统设计）
    - **CrewAI 智能规划**：自动生成学习计划和任务拆解
    - 定时提醒设置
    - 学习统计追踪
    - 学习计时器

12. **扩展功能模块**
    - **任务看板**：看板式任务管理，支持列/卡片拖拽
    - **知识库**：文档 ingestion、RAG 检索、知识问答
    - **习惯追踪**：习惯打卡、连续天数统计
    - **代码片段**：代码片段收藏与管理
    - **书签**：网址收藏与分类管理

13. **系统设置**
    - 开机自动启动（Windows/macOS）
    - 启动时最小化
    - 关闭时最小化到托盘

14. **AI 服务配置**
    - 多模型提供商（通义千问、Kimi、智谱 GLM、硅基流动）
    - 拖拽排序调用优先级，任一可用即可成功
    - API Key 加密存储、连接测试、热更新
    - 月度预算控制
    - **CrewAI 多智能体系统**集成

### 其他特性

- 🎨 玻璃态（Glassmorphism）设计风格
- 📱 响应式布局，适配各种屏幕
- 💾 本地数据持久化存储（localStorage + IndexedDB + SQLite）
- 🔒 Electron 安全最佳实践（contextIsolation + preload）
- 🔔 系统托盘支持
- ⌨️ 快捷键支持（Ctrl+K 搜索、Ctrl+S 保存等）
- 🧪 完整的测试套件（71+ 测试用例）

## 技术栈

### 前端
- **框架**: HTML5 + CSS3 + JavaScript (ES6+)
- **UI框架**: Tailwind CSS (CDN)
- **图标**: Font Awesome 6
- **编辑器**: Monaco Editor
- **Markdown**: marked.js
- **代码高亮**: highlight.js

### 桌面端
- **框架**: Electron 28
- **进程通信**: IPC with contextBridge
- **安全**: contextIsolation, preload scripts

### AI 服务端
- **框架**: FastAPI + Uvicorn
- **Agent 框架**: CrewAI >= 0.70.0
- **工作流**: LangGraph + LangChain
- **可观测性**: LangSmith（可选）
- **向量数据库**: ChromaDB（嵌入式）
- **数据库**: SQLite + SQLAlchemy + Alembic
- **文档处理**: PyPDF, python-docx, markdown

### 多智能体系统 (CrewAI)
- **规划师 (Planner Agent)**: 制定学习计划和里程碑
- **任务拆解专家 (Decomposer Agent)**: 将复杂任务分解为可执行子任务
- **学习复盘师 (Reviewer Agent)**: 分析学习进度并生成复盘报告

## 🚀 GitHub Actions 自动构建（推荐）

本项目已配置 GitHub Actions，支持自动构建 Windows/macOS/Linux 三平台应用：

1. 进入 GitHub 仓库 **Actions** 页面
2. 选择 **Build and Release** 工作流
3. 点击 **Run workflow** → 输入版本号 → 运行
4. 等待构建完成，在 Artifacts 或 Releases 中下载

详细说明见 [.github/workflows/README.md](.github/workflows/README.md)

## 🧪 测试

FlowBoard 包含完整的测试套件，覆盖前端和后端核心模块：

```bash
# 运行所有测试
npm test

# 仅前端测试
npm run test:unit:frontend

# 仅后端测试
npm run test:unit:backend
```

测试文档：
- [测试运行指南](./tests/RUN_TESTS.md) - 如何运行测试
- [测试配置说明](./tests/CONFIG.md) - 详细的配置文件说明
- [测试计划](./tests/TEST_PLAN.md) - 完整测试用例设计

当前测试覆盖：
- **前端**: 41 个测试（Jest + jsdom）
- **后端**: 30 个测试（pytest）
- **总计**: 71 个测试

## 快速开始

### 环境要求

- **Node.js**: >= 20.x
- **npm**: >= 10.x
- **Python**: >= 3.8（用于 AI 服务）

### 安装依赖

```bash
# 安装 Node.js 依赖
npm run bootstrap:deps

# 安装 Python 依赖（用于 AI 服务）
cd ai_service
pip install -r requirements.txt
```

### 开发模式运行

```bash
# Windows
npm run dev

# macOS/Linux
NODE_ENV=development npm start
```

### 构建应用

```bash
# 构建所有平台
npm run build:all

# 仅构建 Windows 版本
npm run build:win

# 仅构建 macOS 版本
npm run build:mac

# 仅构建 Linux 版本
npm run build:linux
```

构建后的文件将位于 `dist` 目录中。

## 项目结构

```text
FlowBoard/
├── assets/                  # 应用图标和资源
├── build/                   # 构建配置
│   └── installer.nsh        # Windows 安装程序脚本
├── css/                     # 样式文件
│   ├── style.css            # 全局样式
│   ├── ai-chat.css          # AI 助手样式
│   ├── leetcode.css         # LeetCode 页面
│   ├── notes.css            # 笔记页面
│   ├── calendar.css         # 日程管理
│   ├── github.css           # GitHub 页面
│   ├── growth.css           # 个人提升
│   ├── interview.css        # 面试追踪
│   ├── apps.css             # 应用中心
│   ├── dashboard.css        # 仪表盘样式
│   ├── knowledge-base.css   # 知识库样式
│   └── task-board.css       # 任务看板样式
├── js/                      # JavaScript 逻辑
│   ├── app.js               # 主应用逻辑
│   ├── sidebar-registry.js  # 侧边栏热插拔注册中心
│   ├── ai-chat.js           # AI 助手模块
│   ├── ai-settings.js       # AI 服务配置
│   ├── llm-client.js        # LLM 客户端
│   ├── intent-router.js     # Agent 意图路由
│   ├── dashboard-v2.js      # 仪表盘 V2
│   ├── leetcode.js          # LeetCode 模块
│   ├── leetcode-api.js      # LeetCode API
│   ├── code-snippets.js     # 代码智能提示
│   ├── notes.js             # 笔记功能
│   ├── calendar.js          # 日程管理
│   ├── github.js            # GitHub 追踪
│   ├── growth.js            # 个人提升
│   ├── interview.js         # 面试追踪
│   ├── task-board.js        # 任务看板
│   ├── knowledge-base.js    # 知识库
│   ├── habit-tracker.js     # 习惯追踪
│   └── bookmarks.js         # 书签
├── electron/                # Electron 主进程
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本（安全 API 暴露）
│   └── ai-service-manager.js # AI 服务管理器
├── ai_service/              # AI 服务端（Python FastAPI）
│   ├── app/
│   │   ├── main.py          # FastAPI 应用入口
│   │   ├── core/            # 核心模块（配置、数据库、日志）
│   │   ├── api/             # API 路由
│   │   │   └── routes/      # 各模块路由
│   │   ├── services/        # 业务服务
│   │   ├── crews/           # CrewAI 多智能体系统
│   │   │   ├── agents/      # 智能体定义
│   │   │   ├── tasks/       # 任务定义
│   │   │   ├── tools/       # 工具定义
│   │   │   ├── learning_crew.py     # Crew 编排
│   │   │   └── llm_adapter.py       # LLM 适配器
│   │   ├── models/          # 数据库模型
│   │   └── graph/           # LangGraph 工作流
│   ├── requirements.txt     # Python 依赖
│   └── tests/               # 后端测试
├── index.html               # 主页面
├── package.json             # 项目配置
├── README.md                # 项目说明
├── FlowBoard Docs.md        # 详细产品文档
├── AI_IMPLEMENTATION_SUMMARY.md  # AI 功能实现总结
└── QUICK_START.md           # 快速开始指南
```

## AI 服务架构

FlowBoard 的 AI 服务采用分层架构设计：

```
┌─────────────────────────────────────────────────────────────┐
│                    FlowBoard Electron App                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   AI Chat    │  │  Learning    │  │  Knowledge   │       │
│  │   Module     │  │   Planning   │  │    Base      │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │ HTTP/WebSocket
┌───────────────────────────▼───────────────────────────────┐
│                  AI Service (FastAPI)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Chat API  │  │   Plan API  │  │    RAG API  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         └─────────────────┼─────────────────┘              │
│                           │                                │
│  ┌────────────────────────▼────────────────────────┐      │
│  │              CrewAI Multi-Agent System           │      │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐  │      │
│  │  │  Planner   │ │ Decomposer │ │  Reviewer  │  │      │
│  │  │   Agent    │ │   Agent    │ │   Agent    │  │      │
│  │  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘  │      │
│  │         └──────────────┼──────────────┘        │      │
│  │                        │                       │      │
│  │              ┌─────────▼─────────┐             │      │
│  │              │   Crew Executor   │             │      │
│  │              └─────────┬─────────┘             │      │
│  └────────────────────────┼───────────────────────┘      │
│                           │                                │
│  ┌────────────────────────▼────────────────────────┐      │
│  │               Model Gateway                      │      │
│  │  (Qwen / Kimi / GLM / SilFlow / Failover)       │      │
│  └─────────────────────────────────────────────────┘      │
│                           │                                │
│  ┌────────────────────────▼────────────────────────┐      │
│  │         Vector Store (ChromaDB)                  │      │
│  │         Database (SQLite)                        │      │
│  └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

详细架构说明参见 [AI_SERVICE_ARCHITECTURE.md](./AI_SERVICE_ARCHITECTURE.md)

## 开发说明

### 添加新功能

1. 在 `index.html` 中添加界面元素
2. 在 `css/` 目录下创建或修改样式文件
3. 在 `js/` 目录下创建或修改逻辑文件

### 侧边栏热插拔

侧边栏入口已改为 **注册中心驱动**，支持运行时增删、启停、排序与持久化：

- 注册中心文件：`js/sidebar-registry.js`
- 全局 API：`window.FlowBoardSidebar`
- 导航渲染由 `app.js` 自动接管，无需手动写死 `<a class="nav-item">`

### CrewAI 智能体开发

FlowBoard 集成了 CrewAI 多智能体系统，开发新智能体：

1. 在 `ai_service/app/crews/agents/` 创建智能体定义
2. 在 `ai_service/app/crews/tasks/` 创建任务定义
3. 在 `ai_service/app/crews/tools/` 创建工具（如需）
4. 在 `ai_service/app/crews/learning_crew.py` 编排 Crew
5. 在 `ai_service/app/api/routes/` 添加 API 端点

### 与 Electron 主进程通信

```javascript
// 渲染进程中调用主进程 API
if (window.electronAPI) {
    // 获取平台信息
    const platform = await window.electronAPI.getPlatform();
    
    // 保存数据
    await window.electronAPI.saveData('data.json', { key: 'value' });
    
    // 读取数据
    const result = await window.electronAPI.loadData('data.json');
    
    // 设置开机启动
    await window.electronAPI.setAutoLaunch(true);
    
    // AI 配置
    await window.electronAPI.saveAiConfig(config);
    const aiConfig = await window.electronAPI.loadAiConfig();
}
```

### Electron 安全架构

本项目采用最新的 Electron 安全最佳实践：

- ✅ `contextIsolation: true` - 启用上下文隔离
- ✅ `nodeIntegration: false` - 禁用 Node 集成
- ✅ `preload` 脚本 - 通过 contextBridge 安全暴露 API
- ✅ 禁用 `remote` 模块

## API 接口

AI 服务提供以下 API 接口：

| 类别 | 端点 | 说明 |
|------|------|------|
| **会话管理** | `POST /api/v1/sessions` | 创建新会话 |
| **聊天** | `POST /api/v1/chat/stream` | 流式对话 |
| **知识库** | `POST /api/v1/rag/search` | RAG 检索 |
| **规划** | `POST /api/v1/planning/generate` | 生成学习计划（CrewAI） |
| **任务拆解** | `POST /api/v1/decomposer/decompose` | 任务拆解（CrewAI） |
| **复盘** | `POST /api/v1/review/generate` | 生成复盘报告（CrewAI） |
| **配置** | `POST /api/v1/config/providers` | 更新模型配置 |

完整 API 文档参见 [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + K` | 搜索 |
| `Ctrl/Cmd + S` | 保存（笔记/LeetCode） |
| `Ctrl/Cmd + Enter` | 提交（LeetCode） |
| `Tab` | 缩进（Markdown 编辑器） |
| `ESC` | 关闭弹窗 |
| `F5` | 刷新页面 |
| `F11` | 全屏切换 |

## 跨平台注意事项

### macOS

- 应用菜单已本地化（中文）
- 支持黑暗模式
- 关闭窗口时应用保持在 Dock 栏

### Windows

- 支持自定义安装路径
- 自动创建桌面快捷方式
- 支持便携式版本（免安装）

### Linux

- 支持 AppImage、deb、tar.gz 格式
- 开机启动功能暂不支持

## 数据存储位置

- **Windows**: `%APPDATA%/flowboard/`
- **macOS**: `~/Library/Application Support/flowboard/`
- **Linux**: `~/.config/flowboard/`

### 本地存储键值

| 存储 | Key | 用途 |
|------|-----|------|
| localStorage | `todos` | 待办事项 |
| localStorage | `flowboard_notes` | 笔记数据 |
| localStorage | `flowboard_events` | 日程事件 |
| localStorage | `flowboard_apps` | 应用中心数据（v2，含图标元数据与排序） |
| localStorage | `github_username` | GitHub 登录信息 |
| localStorage | `leetcode_submissions` | LeetCode 提交历史 |
| localStorage | `flowboard_sidebar_layout_v1` | 侧边栏布局配置 |
| IndexedDB | `FlowBoardInterviewDB` | 面试录音文件 |
| IndexedDB | `FlowBoardDB` | AI 会话、知识库、任务看板等 |
| SQLite | `flowboard.db` | AI 服务端持久化数据 |

## 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

## 更新日志

### v2.1.0 (2026-03-05)

**新增功能**：
- ✅ **CrewAI 多智能体系统**：集成 CrewAI >= 0.70.0，支持规划师、任务拆解专家、学习复盘师三个智能体
- ✅ **智能学习计划**：通过 CrewAI 自动生成个性化学习计划和里程碑
- ✅ **任务智能拆解**：复杂任务自动分解为可执行的子任务
- ✅ **学习进度复盘**：自动生成学习进度复盘报告
- ✅ **API 文档**：新增完整的 API 接口文档

**架构升级**：
- 新增 `ai_service/app/crews/` 目录，包含完整的 CrewAI 智能体实现
- 新增 `FlowBoardLLM` 适配器，桥接 CrewAI 与 ModelGateway
- 支持 Crew 编排和任务链执行

### v2.0.2 (2026-03-03)
- 新增硅基流动 (Silicon Flow) 作为第四模型提供商
- AI 服务配置支持拖拽排序调用优先级，任一可用即可成功

### v2.0.1 (2026-02-26)
- 安全评分动态计算，基于实际密码强度
- 个人提升真实统计，支持学习计时功能
- PDF 导入支持，自动转换为 Markdown
- 统一版本号为 v2.0.1

### v1.3 (2026-02-25)
- 应用中心支持图标 DIY（预设图标 / Emoji / 本地图片上传）
- 应用中心支持桌面端拖拽排序，并持久化顺序
- `flowboard_apps` 升级为 v2 结构，兼容旧数据自动迁移

### v1.2 (2026-02-23)
- Electron 安全加固（contextIsolation + preload）
- 应用中心新增 AI 图标选项（机器人、芯片、代码图标）
- LeetCode 编辑器优化（AMD loader 检测、备用编辑器）
- GitHub 初始化优化（防止重复初始化）
- 移除主页「新消息」装饰功能
- 资讯中心头条区域美化（动态渐变背景）

### v1.1 (2026-02-23)
- 新增开机启动设置
- 新增 LeetCode 代码智能提示
- 新增 GitHub 登录功能
- 新增应用中心（替换提交记录）
- UI 动效优化

### v1.0 (2026-02-23)
- 初始版本发布
- 账户密码管理、资讯中心、待办事项、笔记、日程、面试追踪、LeetCode、GitHub 等功能
