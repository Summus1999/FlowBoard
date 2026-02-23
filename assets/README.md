# 应用图标

本目录包含 FlowBoard 应用的各种平台图标。

## 图标文件

| 文件 | 平台 | 说明 |
|------|------|------|
| `icon.ico` | Windows | 应用程序图标和安装程序图标 |
| `icon.png` | Linux | 512x512 PNG 图标 |
| `icon-1024.png` | macOS | 1024x1024 PNG 源文件，需转换为 .icns |
| `icon-512.png` | - | 中等尺寸 PNG |
| `icon.svg` | - | SVG 源文件 |

## 自动生成

图标可通过以下命令自动生成：

```bash
# 生成 Windows ICO 文件
npm run create-icons:simple

# 生成 PNG 图标（macOS/Linux）
npm run create-icons:png

# 或使用完整版（需要安装 sharp）
npm install sharp --save-dev
npm run create-icons
```

## 自定义图标

如需使用自定义图标：

1. 替换 `icon.svg` 为你自己的 SVG 文件
2. 重新运行生成命令
3. 或手动准备各平台图标：
   - **Windows**: 256x256 或更大尺寸的 `.ico` 文件
   - **macOS**: 1024x1024 `.icns` 文件
   - **Linux**: 512x512 `.png` 文件

## 在线转换工具

- [ICO Convert](https://icoconvert.com/) - SVG/PNG 转 ICO
- [CloudConvert](https://cloudconvert.com/png-to-icns) - PNG 转 ICNS
- [Convertio](https://convertio.co/zh/svg-ico/) - SVG 转 ICO

## 图标规格

### Windows (icon.ico)
- 格式: ICO
- 推荐尺寸: 256x256, 128x128, 64x64, 48x48, 32x32, 16x16 (多尺寸)
- 颜色: 32-bit (支持透明)

### macOS (icon.icns)
- 格式: ICNS
- 推荐尺寸: 1024x1024, 512x512, 256x256, 128x128, 64x64, 32x32, 16x16
- 颜色: 支持透明

### Linux (icon.png)
- 格式: PNG
- 推荐尺寸: 512x512 或 1024x1024
- 颜色: 支持透明
