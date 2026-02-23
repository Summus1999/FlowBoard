/**
 * 图标生成脚本
 * 将 SVG 转换为各种平台所需的图标格式
 * 
 * 使用方法:
 * 1. 安装依赖: npm install sharp
 * 2. 运行: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('请先安装 sharp: npm install sharp --save-dev');
    process.exit(1);
}

const assetsDir = path.join(__dirname, '../assets');
const svgPath = path.join(assetsDir, 'icon.svg');

// 确保 assets 目录存在
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// 检查 SVG 文件是否存在
if (!fs.existsSync(svgPath)) {
    console.error('未找到 icon.svg 文件');
    process.exit(1);
}

const svgBuffer = fs.readFileSync(svgPath);

// 生成不同尺寸的图标
const icons = [
    // macOS icns (需要多个尺寸)
    { name: 'icon-16.png', size: 16 },
    { name: 'icon-32.png', size: 32 },
    { name: 'icon-64.png', size: 64 },
    { name: 'icon-128.png', size: 128 },
    { name: 'icon-256.png', size: 256 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-1024.png', size: 1024 },
    
    // Windows ICO 源文件
    { name: 'icon-256.png', size: 256 },
    
    // 托盘图标
    { name: 'tray-icon.png', size: 16 },
    { name: 'tray-icon@2x.png', size: 32 }
];

async function generateIcons() {
    console.log('开始生成图标...');
    
    for (const icon of icons) {
        const outputPath = path.join(assetsDir, icon.name);
        
        try {
            await sharp(svgBuffer)
                .resize(icon.size, icon.size)
                .png()
                .toFile(outputPath);
            
            console.log(`✓ 生成 ${icon.name} (${icon.size}x${icon.size})`);
        } catch (error) {
            console.error(`✗ 生成 ${icon.name} 失败:`, error.message);
        }
    }
    
    // 创建 macOS 图标集的说明文件
    const icnsReadme = `# macOS 图标集 (.icns)

macOS 应用需要一个 .icns 格式的图标文件。

你可以使用以下方法生成:

## 方法 1: 使用 iconutil (推荐)

1. 创建一个 icon.iconset 文件夹
2. 将生成的各种尺寸的 PNG 文件放入其中，按照以下命名:
   - icon_16x16.png
   - icon_16x16@2x.png (32x32)
   - icon_32x32.png
   - icon_32x32@2x.png (64x64)
   - icon_128x128.png
   - icon_128x128@2x.png (256x256)
   - icon_256x256.png
   - icon_256x256@2x.png (512x512)
   - icon_512x512.png
   - icon_512x512@2x.png (1024x1024)

3. 运行命令:
   \`\`\`bash
   iconutil -c icns icon.iconset
   \`\`\`

## 方法 2: 使用在线转换工具

- https://cloudconvert.com/png-to-icns
- https://convertio.co/zh/png-icns/

将 icon-1024.png 上传到这些网站转换为 .icns 格式。
`;
    
    fs.writeFileSync(path.join(assetsDir, 'ICNS-README.md'), icnsReadme);
    
    // 创建 Windows ICO 说明文件
    const icoReadme = `# Windows 图标 (.ico)

Windows 应用需要一个 .ico 格式的图标文件。

你可以使用以下方法生成:

## 方法 1: 使用在线转换工具

- https://convertio.co/zh/png-ico/
- https://www.convert-jpg-to-png.com/png-to-ico.php

将 icon-256.png 上传到这些网站转换为 .ico 格式。

## 方法 2: 使用 ImageMagick

\`\`\`bash
convert icon-16.png icon-32.png icon-48.png icon-256.png icon.ico
\`\`\`
`;
    
    fs.writeFileSync(path.join(assetsDir, 'ICO-README.md'), icoReadme);
    
    console.log('\n图标生成完成！');
    console.log('\n下一步:');
    console.log('1. 对于 macOS: 按照 ICNS-README.md 生成 icon.icns');
    console.log('2. 对于 Windows: 按照 ICO-README.md 生成 icon.ico');
}

generateIcons().catch(console.error);
