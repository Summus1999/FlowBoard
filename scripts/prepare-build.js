/**
 * FlowBoard 构建准备脚本
 * 
 * 在运行 electron-builder 之前，确保依赖已下载：
 * - ripgrep-all 二进制
 * 
 * 要求：用户需要自行安装 Python 3.8+
 * 
 * Usage:
 *   node scripts/prepare-build.js [--platform windows|linux|macos]
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const AI_SERVICE_PATH = path.join(__dirname, '..', 'ai_service');

function log(msg) {
    console.log(`[prepare-build] ${msg}`);
}

function error(msg) {
    console.error(`[prepare-build] ERROR: ${msg}`);
}

function getPlatform() {
    const args = process.argv.slice(2);
    const platformIndex = args.indexOf('--platform');
    if (platformIndex !== -1 && args[platformIndex + 1]) {
        return args[platformIndex + 1];
    }
    
    const platform = process.platform;
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'macos';
    return 'linux';
}

function findPython() {
    // 检查系统 Python 3.8+
    const candidates = process.platform === 'win32' 
        ? ['python', 'python3'] 
        : ['python3', 'python'];
    
    for (const cmd of candidates) {
        try {
            const result = execSync(`${cmd} --version`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
            const match = result.match(/Python (\d+)\.(\d+)/);
            if (match) {
                const major = parseInt(match[1]);
                const minor = parseInt(match[2]);
                if (major === 3 && minor >= 8) {
                    return cmd;
                }
            }
        } catch (e) {
            // continue
        }
    }
    
    return null;
}

async function main() {
    const platform = getPlatform();
    log(`准备构建 (平台: ${platform})`);
    
    // 1. 检测系统 Python 3.8+
    const pythonCmd = findPython();
    
    if (!pythonCmd) {
        error('未找到 Python 3.8+');
        error('用户需要自行安装 Python 3.8+ 才能使用 AI 服务');
        error('下载地址: https://www.python.org/downloads/');
        // 不阻止构建，因为 Python 是运行时依赖
        log('继续构建（Python 为运行时依赖）...');
    } else {
        log(`检测到 Python: ${pythonCmd}`);
    }
    
    // 2. 下载 ripgrep-all
    const rgaPath = path.join(AI_SERVICE_PATH, 'bin', platform, platform === 'windows' ? 'rga.exe' : 'rga');
    
    if (!fs.existsSync(rgaPath)) {
        log('下载 ripgrep-all...');
        
        const downloadScript = path.join(AI_SERVICE_PATH, 'scripts', 'download_rga.py');
        
        if (!pythonCmd) {
            error('无法下载 ripgrep-all：需要 Python');
            error('请手动运行: cd ai_service && python scripts/download_rga.py --platform ' + platform);
            // 不阻止构建，rga 可以稍后下载
        } else {
            const result = spawnSync(pythonCmd, [downloadScript, '--platform', platform], {
                cwd: AI_SERVICE_PATH,
                stdio: 'inherit'
            });
            
            if (result.status !== 0) {
                error('ripgrep-all 下载失败，但不影响构建');
            }
        }
    } else {
        log('ripgrep-all 已存在');
    }
    
    // 3. 验证
    log('');
    log('=== 构建准备完成 ===');
    log(`  Python: ${pythonCmd || '未找到 (运行时需要用户安装)'}`);
    log(`  ripgrep-all: ${fs.existsSync(rgaPath) ? '已下载' : '未找到'}`);
    log('');
    log('现在可以运行构建命令');
}

main().catch(err => {
    error(err.message);
    process.exit(1);
});
