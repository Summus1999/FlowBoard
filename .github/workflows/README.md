# GitHub Actions 自动构建

本项目已配置 GitHub Actions 工作流，支持自动构建 Windows、macOS 和 Linux 平台的桌面应用。

## 触发方式

### 1. 手动触发（推荐）

进入 GitHub 仓库页面：
1. 点击 **Actions** 标签
2. 选择 **Build and Release** 工作流
3. 点击 **Run workflow** 按钮
4. 输入版本号（如 `1.0.0`）
5. 勾选是否发布到 Releases
6. 点击 **Run workflow**

### 2. 自动触发

- **推送到 main/master 分支**: 自动构建测试
- **创建版本标签**: 推送到 `refs/tags/v*` 时自动构建并发布

```bash
# 创建并推送标签
git tag v1.0.0
git push origin v1.0.0
```

### 3. PR 触发

提交 Pull Request 到 main/master 分支时会自动触发构建测试。

## 构建产物

构建完成后，可以在以下位置下载：

### 1. GitHub Actions Artifacts
- 进入 Actions 页面
- 点击对应的工作流运行记录
- 在 Artifacts 区域下载各平台构建包

### 2. GitHub Releases（仅发布时）
- 如果选择了发布到 Releases，构建包会自动上传到 Releases 页面
- 同时会自动生成发布说明

## 平台支持

| 平台 | 格式 | 说明 |
|------|------|------|
| Windows | `.exe` (NSIS) | 安装程序 |
| Windows | `.exe` (Portable) | 便携版 |
| Windows | `.zip` | 压缩包 |
| macOS | `.dmg` | 安装镜像 |
| macOS | `.zip` | 压缩包 |
| Linux | `.AppImage` | 通用格式 |
| Linux | `.deb` | Debian/Ubuntu |
| Linux | `.tar.gz` | 压缩包 |

## 配置说明

### 环境变量

工作流中使用了以下环境变量：

- `ELECTRON_MIRROR`: Electron 下载镜像（使用国内 npmmirror 加速）
- `GH_TOKEN` / `GITHUB_TOKEN`: GitHub 自动提供的 Token，用于发布 Release

### 缓存

工作流配置了 npm 缓存，可以加速依赖安装：
```yaml
cache: 'npm'
```

## 故障排除

### 构建失败

1. **依赖安装失败**
   - 检查 `package.json` 是否正确
   - 查看 npm 错误日志

2. **Electron 下载失败**
   - 已配置国内镜像 `npmmirror.com`
   - 如仍失败，可以尝试更换其他镜像源

3. **代码签名问题**
   - 当前配置为未签名构建
   - 正式发行需要配置代码签名证书

### 发布失败

确保仓库设置了正确的权限：
1. 进入 **Settings** > **Actions** > **General**
2. 找到 **Workflow permissions**
3. 选择 **Read and write permissions**
4. 勾选 **Allow GitHub Actions to create and approve pull requests**

## 自定义配置

### 修改触发条件

编辑 `.github/workflows/build.yml`：

```yaml
on:
  push:
    branches: [ main ]  # 添加其他分支
  schedule:
    - cron: '0 0 * * 0'  # 每周日自动构建
```

### 添加测试步骤

在构建前添加测试：

```yaml
- name: Run tests
  run: npm test
```

### 多版本 Node.js 测试

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
```

## 参考文档

- [GitHub Actions 文档](https://docs.github.com/cn/actions)
- [electron-builder 配置](https://www.electron.build/)
- [Action 市场](https://github.com/marketplace?type=actions)
