# FlowBoard - 个人工作台

[![Build Status](https://github.com/Summus1999/FlowBoard/actions/workflows/build.yml/badge.svg)](https://github.com/Summus1999/FlowBoard/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28.x-blue.svg)](https://electronjs.org/)

一款跨平台的个人工作台桌面应用，采用现代化的玻璃态 UI 设计，支持多平台账户密码管理、界面UI风格切换、实时资讯整合等功能。

![UI预览](./UI风格参考.png)

## 功能特性

### ✅ 已完成的功能

1. **多平台账户密码管理**
   - 卡片式展示各平台账户
   - 分类筛选（社交/工作/金融/娱乐）
   - 密码强度可视化指示
   - 一键复制用户名/密码
   - 添加/编辑/删除账户

2. **界面UI风格切换**
   - 4种主题风格：深海蓝、极光紫、森林绿、简约白
   - 毛玻璃效果开关
   - 动画效果控制
   - 圆角大小调节
   - 主题设置自动保存

3. **实时资讯整合**
   - 热榜展示（科技/财经/娱乐分类）
   - 资讯卡片布局
   - 热门话题标签
   - RSS订阅源管理

### 其他特性

- 🎨 玻璃态（Glassmorphism）设计风格
- 📱 响应式布局，适配各种屏幕
- 💾 本地数据持久化存储
- 🔔 系统托盘支持
- ⌨️ 快捷键支持

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (原生)
- **UI框架**: Tailwind CSS (CDN)
- **图标**: Font Awesome 6
- **桌面端**: Electron
- **打包工具**: electron-builder

## 🚀 GitHub Actions 自动构建（推荐）

本项目已配置 GitHub Actions，支持自动构建 Windows/macOS/Linux 三平台应用：

1. 进入 GitHub 仓库 **Actions** 页面
2. 选择 **Build and Release** 工作流
3. 点击 **Run workflow** → 输入版本号 → 运行
4. 等待构建完成，在 Artifacts 或 Releases 中下载

详细说明见 [.github/workflows/README.md](.github/workflows/README.md)

## 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 8.x

### 安装依赖

```bash
npm install
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
```

构建后的文件将位于 `dist` 目录中。

## 项目结构

```text
FlowBoard/
├── assets/              # 应用图标和资源
├── build/               # 构建配置
│   └── installer.nsh    # Windows 安装程序脚本
├── css/
│   └── style.css        # 样式文件
├── electron/
│   ├── main.js          # 主进程入口
│   └── preload.js       # 预加载脚本
├── js/
│   └── app.js           # 渲染进程逻辑
├── index.html           # 主页面
├── package.json         # 项目配置
└── README.md            # 项目说明
```

## 开发说明

### 添加新功能

1. 在 `index.html` 中添加界面元素
2. 在 `css/style.css` 中编写样式
3. 在 `js/app.js` 中实现交互逻辑

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
}
```

## 快捷键

| 快捷键         | 功能     |
| -------------- | -------- |
| `Ctrl/Cmd + K` | 搜索     |
| `ESC`          | 关闭弹窗 |
| `F5`           | 刷新页面 |
| `F11`          | 全屏切换 |

## 跨平台注意事项

### macOS

- 应用菜单已本地化（中文）
- 支持黑暗模式
- 关闭窗口时应用保持在 Dock 栏

### Windows

- 支持自定义安装路径
- 自动创建桌面快捷方式
- 支持便携式版本（免安装）

## 数据存储位置

- **Windows**: `%APPDATA%/flowboard/`
- **macOS**: `~/Library/Application Support/flowboard/`
- **Linux**: `~/.config/flowboard/`

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
