/**
 * FlowBoard 构建准备脚本
 * 
 * 在运行 electron-builder 之前，确保所有依赖都已下载：
 * 1. 嵌入式 Python + pip 依赖
 * 2. ripgrep-all 二进制
 * 
 * Usage:
 *   node scripts/prepare-build.js [--platform windows|linux|macos]
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const AI_SERVICE_PATH = path.join(__dirname, '..', 'ai_service');
const PYTHON_PATH = path.join(AI_SERVICE_PATH, 'python');

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
    // 检查嵌入式 Python
    const embeddedPython = path.join(PYTHON_PATH, 'python.exe');
    if (fs.existsSync(embeddedPython)) {
        return embeddedPython;
    }
    
    // 检查系统 Python
    const candidates = process.platform === 'win32' 
        ? ['python', 'python3'] 
        : ['python3', 'python'];
    
    for (const cmd of candidates) {
        try {
            const result = execSync(`${cmd} --version`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
            if (result.includes('Python 3')) {
                return cmd;
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
    
    // 1. 检测 Python
    let pythonCmd = findPython();
    
    if (!pythonCmd) {
        error('未找到 Python 3，请先安装 Python');
        process.exit(1);
    }
    
    log(`使用 Python: ${pythonCmd}`);
    
    // 2. 下载嵌入式 Python (仅 Windows)
    if (platform === 'windows') {
        const embeddedPython = path.join(PYTHON_PATH, 'python.exe');
        
        if (!fs.existsSync(embeddedPython)) {
            log('下载嵌入式 Python...');
            
            const downloadScript = path.join(AI_SERVICE_PATH, 'scripts', 'download_python.py');
            const result = spawnSync(pythonCmd, [downloadScript], {
                cwd: AI_SERVICE_PATH,
                stdio: 'inherit'
            });
            
            if (result.status !== 0) {
                error('嵌入式 Python 下载失败');
                process.exit(1);
            }
            
            // 更新 pythonCmd 为嵌入式版本
            pythonCmd = embeddedPython;
        } else {
            log('嵌入式 Python 已存在');
            pythonCmd = embeddedPython;
        }
    } else {
        log(`平台 ${platform} 不支持嵌入式 Python，用户需要自行安装`);
    }
    
    // 3. 下载 ripgrep-all
    const rgaPath = path.join(AI_SERVICE_PATH, 'bin', platform, platform === 'windows' ? 'rga.exe' : 'rga');
    
    if (!fs.existsSync(rgaPath)) {
        log('下载 ripgrep-all...');
        
        const downloadScript = path.join(AI_SERVICE_PATH, 'scripts', 'download_rga.py');
        const result = spawnSync(pythonCmd, [downloadScript, '--platform', platform], {
            cwd: AI_SERVICE_PATH,
            stdio: 'inherit'
        });
        
        if (result.status !== 0) {
            error('ripgrep-all 下载失败');
            process.exit(1);
        }
    } else {
        log('ripgrep-all 已存在');
    }
    
    // 4. 验证
    log('');
    log('=== 构建准备完成 ===');
    log(`  Python: ${fs.existsSync(path.join(PYTHON_PATH, 'python.exe')) ? '嵌入式' : '系统'}`);
    log(`  ripgrep-all: ${fs.existsSync(rgaPath) ? '已下载' : '未找到'}`);
    log('');
    log('现在可以运行: npm run build:win');
}

main().catch(err => {
    error(err.message);
    process.exit(1);
});
