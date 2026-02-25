# FlowBoard 快速开始指南

## 🚀 获取应用（推荐）

### 方式 1: GitHub Actions 自动构建 ⭐

无需安装任何环境，直接在 GitHub 上获取构建好的应用：

1. 打开 GitHub 仓库页面
1. 点击 **Actions** 标签
1. 选择最新的 **Build and Release** 工作流
1. 在页面底部 **Artifacts** 区域下载对应平台的构建包

或者查看 [Releases](https://github.com/Summus1999/FlowBoard/releases) 页面下载稳定版本。

### 方式 2: 本地构建

如果需要修改代码后自行构建，请参考下方说明。

---

## 🚀 一键启动

### Windows

双击运行 `start.bat` 或在终端执行：

```bash
npm run dev
```

### macOS / Linux

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

### 先决条件

确保已安装 Node.js (>= 20.x)

### 1. 安装依赖

```bash
npm run bootstrap:deps
```

### 2. 开发模式运行

```bash
npm run dev
```

### 3. 构建应用

**构建所有平台：**

```bash
npm run build:all
```

**仅 Windows：**

```bash
npm run build:win
```

**仅 macOS：**

```bash
npm run build:mac
```

构建完成后，安装包位于 `dist` 目录：

- Windows: `dist/FlowBoard-1.0.0.exe` (安装程序) 和 `FlowBoard-1.0.0-portable.exe` (便携版)
- macOS: `dist/FlowBoard-1.0.0.dmg` 和 `FlowBoard-1.0.0.zip`

---

## 📁 项目结构

```text
FlowBoard/
├── assets/              # 图标和资源
│   └── icon.svg         # 应用图标源文件
├── build/               # 构建配置
│   └── installer.nsh    # Windows 安装脚本
├── css/
│   └── style.css        # 玻璃态 UI 样式
├── electron/
│   ├── main.js          # Electron 主进程
│   └── preload.js       # 预加载脚本
├── js/
│   └── app.js           # 应用逻辑
├── scripts/
│   └── generate-icons.js # 图标生成脚本
├── index.html           # 主页面
├── package.json         # 项目配置
├── start.bat            # Windows 启动脚本
├── start.sh             # macOS/Linux 启动脚本
├── ELECTRON_SETUP.md    # Electron 详细配置指南
├── README.md            # 项目说明
└── QUICK_START.md       # 本文件
```

---

## 🎨 自定义图标（可选）

1. 替换 `assets/icon.svg` 为你自己的 SVG 图标
1. 运行图标生成脚本：

```bash
npm install sharp --save-dev
node scripts/generate-icons.js
```

1. 按照生成的说明转换为平台特定格式：
   - macOS: `icon.icns`
   - Windows: `icon.ico`

---

## 🔧 常见问题

### 启动时白屏？

- 检查是否正确安装了依赖：`npm run bootstrap:deps`
- 尝试删除 `node_modules` 后重新安装

### 如何调试？

开发模式下按 `Ctrl+Shift+I` (Windows/Linux) 或 `Cmd+Option+I` (macOS) 打开开发者工具。

### 数据存储在哪里？

- Windows: `%APPDATA%/flowboard/`
- macOS: `~/Library/Application Support/flowboard/`
- Linux: `~/.config/flowboard/`

---

## 📝 功能清单

- [x] 玻璃态 UI 设计
- [x] 多平台账户密码管理
- [x] 4 种主题风格切换
- [x] 实时资讯整合
- [x] Electron 桌面应用
- [x] 系统托盘支持
- [x] 窗口状态记忆
- [x] 本地数据持久化
- [x] 跨平台支持 (macOS/Windows)

---

## 🌟 后续可添加功能

- [ ] 密码加密存储
- [ ] 自动同步云端
- [ ] 生物识别解锁
- [ ] RSS 自动抓取
- [ ] 插件系统

---

## 📄 更多文档

- [Electron 配置指南](./ELECTRON_SETUP.md) - 详细的 Electron 配置说明
- [README.md](./README.md) - 项目完整介绍

---

**开始使用 FlowBoard 提升你的工作效率吧！** 🎉
