/**
 * 生成应用图标脚本
 * 将 assets/icon.svg 转换为各平台需要的图标格式
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('正在安装 sharp 依赖...');
    const { execSync } = require('child_process');
    try {
        execSync('npm install sharp --save-dev', { stdio: 'inherit' });
        sharp = require('sharp');
        console.log('安装完成，继续生成图标...\n');
    } catch (err) {
        console.error('安装 sharp 失败，请手动运行: npm install sharp --save-dev');
        process.exit(1);
    }
}

const assetsDir = path.join(__dirname, '../assets');
const svgPath = path.join(assetsDir, 'icon.svg');

// 确保 assets 目录存在
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// 检查 SVG 文件是否存在
if (!fs.existsSync(svgPath)) {
    console.error('错误: 未找到 assets/icon.svg 文件');
    console.log('请确保 SVG 文件存在后再运行此脚本');
    process.exit(1);
}

console.log('🎨 FlowBoard 图标生成器\n');
console.log('源文件:', svgPath);
console.log('');

// 读取 SVG 文件
const svgBuffer = fs.readFileSync(svgPath);

// 生成不同尺寸的图标
async function generateIcons() {
    try {
        // 生成各种尺寸的 PNG（用于生成 ICO）
        const sizes = [16, 32, 48, 64, 128, 256];
        const pngBuffers = {};

        console.log('📦 生成 PNG 尺寸:');
        for (const size of sizes) {
            const outputPath = path.join(assetsDir, `icon-${size}.png`);
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(outputPath);
            pngBuffers[size] = await sharp(svgBuffer).resize(size, size).png().toBuffer();
            console.log(`   ✓ ${size}x${size}`);
        }

        // 生成 Windows ICO 文件
        console.log('\n🪟 生成 Windows ICO 文件...');
        await createIcoFile(pngBuffers, path.join(assetsDir, 'icon.ico'));
        console.log('   ✓ icon.ico');

        // 生成 macOS ICNS 文件（使用 1024x1024 PNG 作为替代）
        console.log('\n🍎 生成 macOS 图标...');
        await sharp(svgBuffer)
            .resize(1024, 1024)
            .png()
            .toFile(path.join(assetsDir, 'icon-1024.png'));
        console.log('   ✓ icon-1024.png (用于 macOS)');
        console.log('   ⚠  注意: macOS 需要 .icns 格式，请使用 iconutil 转换');
        console.log('      或访问 https://cloudconvert.com/png-to-icns');

        // 生成 Linux PNG 图标
        console.log('\n🐧 生成 Linux 图标...');
        await sharp(svgBuffer)
            .resize(512, 512)
            .png()
            .toFile(path.join(assetsDir, 'icon.png'));
        console.log('   ✓ icon.png (512x512)');

        // 生成托盘图标
        console.log('\n📌 生成托盘图标...');
        await sharp(svgBuffer)
            .resize(16, 16)
            .png()
            .toFile(path.join(assetsDir, 'tray-icon.png'));
        console.log('   ✓ tray-icon.png');

        console.log('\n✅ 图标生成完成！');
        console.log('\n文件位置:');
        console.log('  - assets/icon.ico      (Windows)');
        console.log('  - assets/icon.png      (Linux)');
        console.log('  - assets/icon-1024.png (macOS 源文件)');
        console.log('  - assets/tray-icon.png (系统托盘)');
        console.log('\n现在可以重新运行 GitHub Actions 构建了! 🚀');

    } catch (error) {
        console.error('\n❌ 生成失败:', error.message);
        process.exit(1);
    }
}

/**
 * 创建 Windows ICO 文件
 * ICO 文件格式: 文件头 + 目录项 + 图像数据
 */
async function createIcoFile(pngBuffers, outputPath) {
    const sizes = [16, 32, 48, 64, 128, 256];
    const entries = [];
    let offset = 6 + (sizes.length * 16); // 文件头 + 目录大小

    // 准备目录项
    for (const size of sizes) {
        const buffer = pngBuffers[size];
        entries.push({
            width: size,
            height: size,
            colorCount: 0,
            reserved: 0,
            planes: 1,
            bitCount: 32,
            sizeInBytes: buffer.length,
            offset: offset
        });
        offset += buffer.length;
    }

    // 写入文件头
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // 保留
    header.writeUInt16LE(1, 2); // 类型: 1=ICO
    header.writeUInt16LE(sizes.length, 4); // 图像数量

    // 写入目录
    const directory = Buffer.alloc(sizes.length * 16);
    entries.forEach((entry, index) => {
        const pos = index * 16;
        directory.writeUInt8(entry.width === 256 ? 0 : entry.width, pos);
        directory.writeUInt8(entry.height === 256 ? 0 : entry.height, pos + 1);
        directory.writeUInt8(entry.colorCount, pos + 2);
        directory.writeUInt8(entry.reserved, pos + 3);
        directory.writeUInt16LE(entry.planes, pos + 4);
        directory.writeUInt16LE(entry.bitCount, pos + 6);
        directory.writeUInt32LE(entry.sizeInBytes, pos + 8);
        directory.writeUInt32LE(entry.offset, pos + 12);
    });

    // 合并所有数据
    const parts = [header, directory];
    sizes.forEach(size => parts.push(pngBuffers[size]));
    
    fs.writeFileSync(outputPath, Buffer.concat(parts));
}

// 运行生成
generateIcons();
