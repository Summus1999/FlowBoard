# FlowBoard Electron 设置指南

本指南将帮助你完成 Electron 桌面应用的配置和构建。

## 前提条件

- Node.js >= 16.x ([下载地址](https://nodejs.org/))
- npm >= 8.x

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成应用图标（可选）

如果你有 icon.svg 文件，可以生成各种尺寸的图标：

```bash
# 安装 sharp（用于图标生成）
npm install sharp --save-dev

# 运行图标生成脚本
node scripts/generate-icons.js
```

然后按照生成的说明文件转换为平台特定格式：

- macOS: `icon.icns`（参考 `assets/ICNS-README.md`）
- Windows: `icon.ico`（参考 `assets/ICO-README.md`）

### 3. 开发模式运行

Windows:

```bash
npm run dev
```

macOS/Linux:

```bash
npm run dev
# 或者
NODE_ENV=development npm start
```

### 4. 构建应用

构建所有平台：

```bash
npm run build:all
```

仅构建 Windows：

```bash
npm run build:win
```

仅构建 macOS：

```bash
npm run build:mac
```

构建后的文件将位于 `dist` 目录。

## 项目文件说明

```text
FlowBoard/
├── electron/
│   ├── main.js          # 主进程 - 窗口管理、系统托盘等
│   └── preload.js       # 预加载脚本 - 安全地暴露 API
├── build/
│   └── installer.nsh    # Windows 安装程序配置
├── assets/
│   ├── icon.svg         # 图标源文件
│   ├── icon.icns        # macOS 图标（需生成）
│   └── icon.ico         # Windows 图标（需生成）
└── package.json         # 项目配置和构建脚本
```

## 功能特性

### Electron 集成功能

1. **窗口管理**
   - 记住窗口位置和大小
   - 最大化/最小化/关闭控制
   - 优雅地处理多实例

2. **系统托盘**
   - 最小化到托盘
   - 右键菜单
   - 点击显示/隐藏窗口

3. **原生菜单**（macOS）
   - 完整的应用菜单
   - 本地化的菜单项
   - 标准的编辑快捷键

4. **数据持久化**
   - 自动保存用户配置
   - 安全的数据存储
   - 跨平台的数据路径

5. **IPC 通信**
   - 渲染进程与主进程通信
   - 文件对话框
   - 外部链接打开

## 开发技巧

### 调试

在开发模式下，开发者工具会自动打开。你也可以通过菜单或快捷键 `Ctrl/Cmd + Shift + I` 打开。

### 热重载

开发时修改前端文件后，需要手动刷新页面（`F5` 或 `Ctrl/Cmd + R`）。

修改主进程文件后，需要重启应用。

### 日志

主进程日志会输出到终端。

渲染进程日志在开发者工具的 Console 中查看。

## 常见问题

### Q: 构建失败，提示缺少依赖？

确保已安装所有依赖：

```bash
npm install
npm run postinstall  # 安装 Electron 原生依赖
```

### Q: macOS 上提示应用已损坏？

这是因为应用没有签名。你可以通过以下方式解决：

```bash
# 移除隔离属性
xattr -cr /Applications/FlowBoard.app
```

或者去系统偏好设置 > 安全性与隐私 > 通用，点击"仍要打开"。

### Q: 如何禁用 Windows 安装程序的签名检查？

在开发测试时，Windows 可能会提示未知发布者。这是正常的，正式发布时需要代码签名证书。

### Q: 如何更改应用名称？

修改 `package.json` 中的 `productName` 字段。

## 发布配置

### 代码签名（推荐用于正式发布）

#### macOS

需要 Apple Developer ID 证书。在 `package.json` 中添加：

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (Team ID)"
    }
  }
}
```

#### Windows

需要代码签名证书。可以通过以下方式配置：

环境变量方式：

```bash
set WIN_CSC_LINK=path/to/certificate.p12
set WIN_CSC_KEY_PASSWORD=your-password
```

## 下一步

1. 完成功能开发
2. 测试各平台兼容性
3. 配置代码签名（正式发布）
4. 发布到应用商店或网站

## 参考文档

- [Electron 文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
