/**
 * Windows 图标修复脚本
 * 修复桌面图标不可见的问题
 * 
 * 问题原因: icon.ico 文件损坏或为空占位符
 * 解决方案: 从 icon.svg 重新生成正确的 ICO 文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '../assets');
const svgPath = path.join(assetsDir, 'icon.svg');
const icoPath = path.join(assetsDir, 'icon.ico');

console.log('🔧 FlowBoard Windows 图标修复工具\n');
console.log('=====================================');

// 检查 SVG 文件是否存在
if (!fs.existsSync(svgPath)) {
    console.error('❌ 错误: 未找到 icon.svg 文件');
    process.exit(1);
}

console.log('✓ 找到 SVG 源文件:', svgPath);
console.log('✓ 目标 ICO 路径:', icoPath);
console.log('');

// 检查当前 ICO 文件状态
if (fs.existsSync(icoPath)) {
    const stats = fs.statSync(icoPath);
    console.log(`📊 当前 icon.ico 大小: ${stats.size} 字节`);
    
    if (stats.size < 1000) {
        console.log('⚠️  警告: ICO 文件过小，可能是损坏的占位符');
    }
    
    // 备份旧图标
    const backupPath = icoPath + '.backup';
    fs.copyFileSync(icoPath, backupPath);
    console.log('✓ 已备份原图标到:', backupPath);
}

// 尝试安装并使用 sharp 生成图标
async function generateIconWithSharp() {
    let sharp;
    
    // 尝试加载 sharp
    try {
        sharp = require('sharp');
    } catch (e) {
        console.log('\n📦 正在安装 sharp 依赖 (用于图像处理)...');
        try {
            execSync('npm install sharp --save-dev', { 
                stdio: 'inherit',
                cwd: path.join(__dirname, '..')
            });
            sharp = require('sharp');
            console.log('✓ sharp 安装成功\n');
        } catch (err) {
            console.error('❌ sharp 安装失败:', err.message);
            return false;
        }
    }

    console.log('🎨 开始生成 Windows ICO 文件...\n');

    try {
        const svgBuffer = fs.readFileSync(svgPath);
        
        // 生成不同尺寸的 PNG
        const sizes = [16, 32, 48, 64, 128, 256];
        const pngBuffers = {};

        console.log('📐 生成各尺寸 PNG:');
        for (const size of sizes) {
            pngBuffers[size] = await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toBuffer();
            console.log(`   ✓ ${size}x${size}`);
        }

        // 创建 ICO 文件
        console.log('\n🔨 创建 ICO 文件...');
        await createIcoFile(pngBuffers, icoPath);
        
        const newStats = fs.statSync(icoPath);
        console.log(`   ✓ ICO 文件大小: ${newStats.size} 字节`);
        console.log(`   ✓ 包含尺寸: ${sizes.join(', ')}`);
        
        return true;
    } catch (error) {
        console.error('❌ 生成失败:', error.message);
        return false;
    }
}

/**
 * 创建标准 Windows ICO 文件
 * 包含多尺寸 PNG 图像
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

// 提供手动修复方案
function showManualFix() {
    console.log('\n' + '='.repeat(50));
    console.log('📝 手动修复方案');
    console.log('='.repeat(50));
    console.log('');
    console.log('由于自动安装依赖失败，请尝试以下方法之一:');
    console.log('');
    console.log('方案 1: 手动安装 sharp 后重新运行');
    console.log('   npm install sharp --save-dev');
    console.log('   node scripts/fix-windows-icon.js');
    console.log('');
    console.log('方案 2: 使用在线工具转换');
    console.log('   1. 访问 https://convertio.co/zh/svg-ico/');
    console.log('   2. 上传 assets/icon.svg 文件');
    console.log('   3. 下载生成的 icon.ico');
    console.log('   4. 替换 assets/icon.ico');
    console.log('');
    console.log('方案 3: 使用现有的 PNG 文件');
    console.log('   1. 访问 https://www.convert-jpg-to-png.com/png-to-ico.php');
    console.log('   2. 上传 assets/icon.png 文件');
    console.log('   3. 下载生成的 icon.ico');
    console.log('   4. 替换 assets/icon.ico');
    console.log('');
}

// 主函数
async function main() {
    const success = await generateIconWithSharp();
    
    if (success) {
        console.log('\n' + '='.repeat(50));
        console.log('✅ Windows 图标修复成功！');
        console.log('='.repeat(50));
        console.log('');
        console.log('下一步:');
        console.log('1. 重新构建应用: npm run build:win');
        console.log('2. 安装新版本，桌面图标应该可见了');
        console.log('');
        console.log('💡 提示: 如果图标仍然不显示，可能需要:');
        console.log('   - 清除 Windows 图标缓存');
        console.log('   - 或重启资源管理器');
        console.log('');
    } else {
        showManualFix();
    }
}

main().catch(err => {
    console.error('❌ 发生错误:', err);
    showManualFix();
});
