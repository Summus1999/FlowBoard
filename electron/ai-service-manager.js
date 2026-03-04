/**
 * AI Service Manager - 管理 Python AI 服务的启动和停止
 * 
 * 功能：
 * 1. 自动检测系统 Python 3.8+
 * 2. 自动启动 ai_service
 * 3. 健康检查和自动重启
 * 4. 优雅关闭
 * 
 * 要求：用户需要自行安装 Python 3.8+
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

class AIServiceManager {
    constructor(options = {}) {
        this.port = options.port || 8000;
        this.host = options.host || '127.0.0.1';
        this.pythonPath = null;
        this.process = null;
        this.isRunning = false;
        this.restartCount = 0;
        this.maxRestarts = 3;
        this.healthCheckInterval = null;
        this.startupTimeout = 30000; // 30秒启动超时
        
        // 根据打包状态确定路径
        this.aiServicePath = this._getAiServicePath();
    }
    
    /**
     * 获取 ai_service 目录路径
     */
    _getAiServicePath() {
        const { app } = require('electron');
        
        if (app.isPackaged) {
            // 打包后：resources/ai_service
            return path.join(process.resourcesPath, 'ai_service');
        } else {
            // 开发时：项目根目录/ai_service
            return path.join(__dirname, '..', 'ai_service');
        }
    }
    
    /**
     * 检测系统 Python 3.8+ 可执行文件
     */
    _detectPython() {
        const pythonCandidates = process.platform === 'win32'
            ? ['python', 'python3', 'py -3']
            : ['python3', 'python'];
        
        for (const candidate of pythonCandidates) {
            try {
                const result = execSync(`${candidate} --version`, {
                    encoding: 'utf8',
                    timeout: 5000,
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                
                // 检查版本是否 >= 3.8
                const versionMatch = result.match(/Python (\d+)\.(\d+)/);
                if (versionMatch) {
                    const major = parseInt(versionMatch[1]);
                    const minor = parseInt(versionMatch[2]);
                    if (major === 3 && minor >= 8) {
                        console.log(`[AIServiceManager] 检测到 Python: ${candidate} -> ${result.trim()}`);
                        this.pythonPath = candidate;
                        return true;
                    } else {
                        console.warn(`[AIServiceManager] Python 版本过低: ${result.trim()} (需要 3.8+)`);
                    }
                }
            } catch (e) {
                // 继续尝试下一个
            }
        }
        
        console.error('[AIServiceManager] 未找到 Python 3.8+');
        return false;
    }
    
    /**
     * 检查 ai_service 目录是否存在
     */
    _checkAiServiceExists() {
        const mainPy = path.join(this.aiServicePath, 'app', 'main.py');
        const exists = fs.existsSync(mainPy);
        console.log(`[AIServiceManager] ai_service 路径: ${this.aiServicePath}, 存在: ${exists}`);
        return exists;
    }
    
    /**
     * 健康检查
     */
    async healthCheck() {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: this.host,
                port: this.port,
                path: '/api/v1/health',
                method: 'GET',
                timeout: 5000
            }, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            
            req.end();
        });
    }
    
    /**
     * 等待服务启动
     */
    async _waitForStartup() {
        const startTime = Date.now();
        
        while (Date.now() - startTime < this.startupTimeout) {
            if (await this.healthCheck()) {
                console.log('[AIServiceManager] 服务启动成功');
                return true;
            }
            await new Promise(r => setTimeout(r, 500));
        }
        
        console.error('[AIServiceManager] 服务启动超时');
        return false;
    }
    
    /**
     * 启动 AI 服务
     */
    async start() {
        // 检查是否已经在运行
        if (await this.healthCheck()) {
            console.log('[AIServiceManager] 服务已在运行');
            this.isRunning = true;
            return true;
        }
        
        // 检测 Python
        if (!this._detectPython()) {
            throw new Error(
                '未找到 Python 3.8+ 环境。请先安装 Python:\n' +
                '  Windows: https://www.python.org/downloads/\n' +
                '  macOS: brew install python3\n' +
                '  Linux: sudo apt install python3 python3-pip\n\n' +
                '安装后请确保将 Python 添加到系统 PATH 环境变量中。'
            );
        }
        
        // 检查 ai_service
        if (!this._checkAiServiceExists()) {
            throw new Error(`ai_service 目录不存在: ${this.aiServicePath}`);
        }
        
        console.log('[AIServiceManager] 正在启动 AI 服务...');
        
        // 构建启动命令
        const env = {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8'
        };
        
        // 使用 uvicorn 启动
        const args = [
            '-m', 'uvicorn',
            'app.main:app',
            '--host', this.host,
            '--port', String(this.port),
        ];
        
        this.process = spawn(this.pythonPath, args, {
            cwd: this.aiServicePath,
            env: env,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            detached: false
        });
        
        // 捕获输出
        this.process.stdout.on('data', (data) => {
            console.log(`[AI Service] ${data.toString().trim()}`);
        });
        
        this.process.stderr.on('data', (data) => {
            console.error(`[AI Service] ${data.toString().trim()}`);
        });
        
        this.process.on('close', (code) => {
            console.log(`[AIServiceManager] 服务退出，代码: ${code}`);
            this.isRunning = false;
            this.process = null;
            
            // 尝试重启
            if (code !== 0 && this.restartCount < this.maxRestarts) {
                this.restartCount++;
                console.log(`[AIServiceManager] 尝试重启 (${this.restartCount}/${this.maxRestarts})`);
                setTimeout(() => this.start(), 2000);
            }
        });
        
        this.process.on('error', (err) => {
            console.error(`[AIServiceManager] 启动失败: ${err.message}`);
            this.isRunning = false;
        });
        
        // 等待启动
        const started = await this._waitForStartup();
        if (started) {
            this.isRunning = true;
            this.restartCount = 0;
            this._startHealthCheck();
        }
        
        return started;
    }
    
    /**
     * 启动健康检查定时器
     */
    _startHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            if (!await this.healthCheck()) {
                console.warn('[AIServiceManager] 健康检查失败');
            }
        }, 30000); // 每30秒检查一次
    }
    
    /**
     * 停止 AI 服务
     */
    async stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (!this.process) {
            console.log('[AIServiceManager] 服务未运行');
            return;
        }
        
        console.log('[AIServiceManager] 正在停止服务...');
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('[AIServiceManager] 强制终止服务');
                if (this.process) {
                    this.process.kill('SIGKILL');
                }
                resolve();
            }, 5000);
            
            this.process.once('close', () => {
                clearTimeout(timeout);
                console.log('[AIServiceManager] 服务已停止');
                resolve();
            });
            
            // 优雅关闭
            if (process.platform === 'win32') {
                this.process.kill();
            } else {
                this.process.kill('SIGTERM');
            }
        });
    }
    
    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            host: this.host,
            path: this.aiServicePath,
            restartCount: this.restartCount
        };
    }
}

module.exports = { AIServiceManager };
