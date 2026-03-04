/**
 * 清除资讯缓存
 * 用于重置资讯数据，强制重新获取
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getUserDataPath() {
    const platform = process.platform;
    const appName = 'FlowBoard';
    
    switch (platform) {
        case 'win32':
            return path.join(process.env.APPDATA || '', appName);
        case 'darwin':
            return path.join(os.homedir(), 'Library', 'Application Support', appName);
        case 'linux':
            return path.join(os.homedir(), '.config', appName);
        default:
            return null;
    }
}

function clearNewsCache() {
    const userDataPath = getUserDataPath();
    
    if (!userDataPath) {
        console.error('无法确定用户数据目录');
        return false;
    }
    
    const cacheFile = path.join(userDataPath, 'news-cache-v1.json');
    
    if (!fs.existsSync(cacheFile)) {
        console.log('✓ 资讯缓存文件不存在，无需清除');
        return true;
    }
    
    try {
        fs.unlinkSync(cacheFile);
        console.log('✓ 成功清除资讯缓存');
        console.log(`文件路径：${cacheFile}`);
        console.log('\n提示：重启应用后将自动重新获取最新资讯');
        return true;
    } catch (error) {
        console.error('✗ 清除缓存失败:', error.message);
        return false;
    }
}

// 执行清除
console.log('FlowBoard - 清除资讯缓存工具\n');
console.log('=' .repeat(50));
clearNewsCache();
console.log('=' .repeat(50));
