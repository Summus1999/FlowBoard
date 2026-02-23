# GitHub Actions 自动构建完整指南

## 🎯 概述

GitHub Actions 配置已完成，支持：
- ✅ Windows (NSIS 安装程序 + 便携版)
- ✅ macOS (DMG + ZIP)
- ✅ Linux (AppImage + DEB + TAR.GZ)
- ✅ 自动发布到 GitHub Releases
- ✅ 使用国内镜像加速下载

---

## 📋 使用方法

### 方法 1: 网页界面（最简单）

1. 打开你的 GitHub 仓库页面
2. 点击顶部的 **Actions** 标签
3. 左侧选择 **Build and Release** 工作流
4. 点击右侧的 **Run workflow** 按钮
5. 填写参数：
   - **版本号**: 如 `1.0.0`
   - **是否发布**: 勾选则自动发布到 Releases
6. 点击绿色的 **Run workflow** 按钮
7. 等待构建完成（约 5-10 分钟）

### 方法 2: 推送标签（自动化）

```bash
# 1. 提交代码
git add .
git commit -m "Release v1.0.0"

# 2. 创建标签
git tag v1.0.0

# 3. 推送标签（会自动触发构建并发布）
git push origin v1.0.0
```

### 方法 3: 手动触发（带参数）

```bash
# 通过 GitHub CLI
echo '{"version": "1.0.0", "release": true}' | gh workflow run build.yml --json
```

---

## 📥 下载构建产物

### 方式 A: GitHub Actions Artifacts（测试版）

适合获取测试构建，无需发布：

1. 进入 **Actions** 页面
2. 点击对应的工作流运行记录
3. 滚动到页面底部的 **Artifacts** 区域
4. 点击下载对应平台的构建包

### 方式 B: GitHub Releases（稳定版）

适合正式发布的稳定版本：

1. 进入仓库的 **Releases** 页面
2. 找到对应的版本号
3. 在 Assets 区域下载对应平台的安装包

---

## 🔧 构建配置说明

### 触发条件（`on:`）

```yaml
workflow_dispatch:     # 手动触发
push:                  # 推送触发
  branches: [main]     # - main 分支
  tags: [v*]           # - 版本标签
pull_request:          # PR 触发
  branches: [main]
```

### 构建矩阵

| Job | 运行环境 | 输出格式 |
|-----|---------|---------|
| build-windows | windows-latest | .exe, .zip |
| build-macos | macos-latest | .dmg, .zip |
| build-linux | ubuntu-latest | .AppImage, .deb, .tar.gz |

### 环境变量

- `ELECTRON_MIRROR`: 使用 npmmirror 国内镜像加速 Electron 下载
- `GH_TOKEN`: GitHub 自动提供的 Token

---

## 🔐 权限配置

首次使用前，请检查仓库权限设置：

1. 进入 **Settings** > **Actions** > **General**
2. **Workflow permissions** 选择 **Read and write permissions**
3. 勾选 **Allow GitHub Actions to create and approve pull requests**
4. 保存

---

## 📊 构建状态徽章

README.md 已添加构建状态徽章：

```markdown
[![Build Status](https://github.com/Summus1999/FlowBoard/actions/workflows/build.yml/badge.svg)](https://github.com/Summus1999/FlowBoard/actions)
```

当构建失败时会显示红色，成功时显示绿色。

---

## 🛠️ 故障排除

### 问题 1: 构建卡在下载 Electron

**原因**: 网络连接问题

**解决**: 已配置国内镜像 `npmmirror.com`，如仍有问题可尝试：
```yaml
env:
  ELECTRON_MIRROR: https://registry.npmmirror.com/binary.html?path=electron/
```

### 问题 2: macOS 构建失败

**原因**: 可能需要 Xcode 命令行工具

**解决**: 已在 macOS 运行环境中预装

### 问题 3: 发布到 Releases 失败

**原因**: Token 权限不足

**解决**: 检查仓库的 Actions 权限设置（见上文）

### 问题 4: Linux 构建缺少依赖

**原因**: Linux 打包需要特定依赖

**解决**: electron-builder 会自动安装大部分依赖

---

## 📝 版本号规范

建议使用 [语义化版本](https://semver.org/lang/zh-CN/)：

```
主版本号.次版本号.修订号
1.0.0
```

预发布版本：
```
1.0.0-beta.1
1.0.0-rc.1
```

---

## 🚀 高级用法

### 定时自动构建

在 `.github/workflows/build.yml` 中添加：

```yaml
on:
  schedule:
    # 每天 UTC 时间 0:00 构建
    - cron: '0 0 * * *'
    # 每周一 UTC 时间 0:00 构建
    - cron: '0 0 * * 1'
```

### 仅构建特定平台

在手动触发时选择：

```yaml
workflow_dispatch:
  inputs:
    platform:
      type: choice
      options:
        - all
        - windows
        - macos
        - linux
```

### 添加测试步骤

```yaml
- name: Run tests
  run: |
    npm run lint
    npm run test
```

---

## 📚 参考链接

- [GitHub Actions 文档](https://docs.github.com/cn/actions)
- [Workflow 语法参考](https://docs.github.com/cn/actions/using-workflows/workflow-syntax-for-github-actions)
- [electron-builder CI 文档](https://www.electron.build/code-signing)
- [GitHub Releases 文档](https://docs.github.com/cn/repositories/releasing-projects-on-github)

---

## ✅ 检查清单

使用前请确认：

- [ ] 仓库已推送到 GitHub
- [ ] Actions 权限已配置
- [ ] `package.json` 中的仓库 URL 正确
- [ ] 已提交 `.github/workflows/build.yml`
- [ ] 测试手动触发一次构建

---

**现在你可以使用 GitHub Actions 自动构建 FlowBoard 了！** 🎉
