/**
 * 本地构建脚本 - 模拟 GitHub Actions 构建流程
 * 用于在本地测试多平台构建配置
 * 
 * 使用方法: node scripts/build-all.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platform = process.platform;
const buildDir = path.join(__dirname, '../dist');

console.log('=====================================');
console.log('   FlowBoard 本地构建脚本');
console.log('=====================================');
console.log(`当前平台: ${platform}`);
console.log('');

// 检查依赖
console.log('📦 检查依赖...');
try {
    execSync('npm list electron', { stdio: 'ignore' });
    console.log('✓ 依赖已安装');
} catch {
    console.log('⚠ 依赖未安装，正在安装...');
    execSync('npm install', { stdio: 'inherit' });
}

// 清理旧的构建
console.log('');
console.log('🧹 清理旧的构建...');
if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
    console.log('✓ 清理完成');
}

// 根据平台构建
console.log('');
console.log('🔨 开始构建...');
console.log('');

try {
    if (platform === 'win32') {
        console.log('📦 构建 Windows 版本...');
        execSync('npm run build:win', { stdio: 'inherit' });
    } else if (platform === 'darwin') {
        console.log('📦 构建 macOS 版本...');
        execSync('npm run build:mac', { stdio: 'inherit' });
    } else {
        console.log('📦 构建 Linux 版本...');
        execSync('npm run build:linux', { stdio: 'inherit' });
    }
    
    console.log('');
    console.log('✅ 构建完成！');
    console.log('');
    
    // 显示构建产物
    if (fs.existsSync(buildDir)) {
        console.log('📂 构建产物:');
        const files = fs.readdirSync(buildDir);
        files.forEach(file => {
            const filePath = path.join(buildDir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                const size = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`   - ${file} (${size} MB)`);
            }
        });
    }
    
    console.log('');
    console.log('🎉 构建成功！');
    console.log(`📁 输出目录: ${buildDir}`);
    
} catch (error) {
    console.error('');
    console.error('❌ 构建失败:');
    console.error(error.message);
    process.exit(1);
}
