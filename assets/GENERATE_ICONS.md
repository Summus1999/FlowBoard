# 生成应用图标

## 问题
Windows 构建需要 `.ico` 格式的图标，macOS 需要 `.icns` 格式。

## 快速解决方案

### 方案 1: 使用在线转换工具（推荐）

1. 准备一张 1024x1024 的 PNG 图片作为图标源
2. 访问以下网站之一进行转换：
   - [Convertio](https://convertio.co/zh/png-ico/) - PNG 转 ICO
   - [CloudConvert](https://cloudconvert.com/png-to-icns) - PNG 转 ICNS
   - [ICO Convert](https://icoconvert.com/) - 在线生成多尺寸 ICO

3. 下载转换后的文件：
   - Windows: `icon.ico` → 放入 `assets/` 文件夹
   - macOS: `icon.icns` → 放入 `assets/` 文件夹

### 方案 2: 使用 Node.js 脚本生成

```bash
# 安装依赖
npm install --save-dev sharp

# 运行生成脚本
node scripts/generate-icons.js
```

### 方案 3: 使用当前 SVG 生成（需要 Inkscape/ImageMagick）

```bash
# macOS/Linux (需要 ImageMagick)
convert -background none assets/icon.svg -define icon:auto-resize=256,128,64,48,32,16 assets/icon.ico

# Windows (需要 Inkscape)
inkscape assets/icon.svg --export-filename=assets/icon.png -w 1024 -h 1024
# 然后使用在线工具转换为 ICO
```

## 图标规格要求

### Windows (icon.ico)
- 格式: ICO
- 推荐尺寸: 256x256, 128x128, 64x64, 48x48, 32x32, 16x16 (多尺寸)
- 颜色: 32-bit (支持透明)

### macOS (icon.icns)
- 格式: ICNS
- 推荐尺寸: 1024x1024, 512x512, 256x256, 128x128, 64x64, 32x32, 16x16
- 颜色: 支持透明

## 重新启用自定义图标

生成图标后，编辑 `package.json`，取消以下注释：

```json
"win": {
  "icon": "assets/icon.ico",
  ...
},
"mac": {
  "icon": "assets/icon.icns",
  ...
},
"nsis": {
  "installerIcon": "assets/icon.ico",
  "uninstallerIcon": "assets/icon.ico",
  ...
}
```

## 当前配置

目前构建配置已修改为**使用 Electron 默认图标**，不影响功能使用。如需自定义图标，请按上述步骤生成后修改配置。
