/**
 * 清理 AI 聊天中的空消息
 * 用于修复 "assistant message must not be empty" 错误
 */

const path = require('path');
const fs = require('fs');

// Electron userData 路径
function getUserDataPath() {
    const platform = process.platform;
    const appName = 'FlowBoard';
    
    switch (platform) {
        case 'win32':
            return path.join(process.env.APPDATA || '', appName);
        case 'darwin':
            return path.join(require('os').homedir(), 'Library', 'Application Support', appName);
        case 'linux':
            return path.join(require('os').homedir(), '.config', appName);
        default:
            return null;
    }
}

async function cleanEmptyMessages() {
    const userDataPath = getUserDataPath();
    
    if (!userDataPath) {
        console.error('❌ 无法确定用户数据目录');
        return false;
    }
    
    const dbPath = path.join(userDataPath, 'flowboard.db');
    
    if (!fs.existsSync(dbPath)) {
        console.log('ℹ️ 数据库文件不存在，无需清理');
        return true;
    }
    
    try {
        // 使用 better-sqlite3 读取数据库
        const Database = require('better-sqlite3');
        const db = new Database(dbPath);
        
        // 查询空的 assistant 消息
        const emptyMessages = db.prepare(`
            SELECT id, sessionId, role, content, isStreaming 
            FROM chatMessages 
            WHERE role = 'assistant' 
            AND (content IS NULL OR TRIM(content) = '')
        `).all();
        
        if (emptyMessages.length === 0) {
            console.log('✅ 没有发现空的 assistant 消息');
            db.close();
            return true;
        }
        
        console.log(`🔍 发现 ${emptyMessages.length} 条空的 assistant 消息:`);
        emptyMessages.forEach(msg => {
            console.log(`   - ID: ${msg.id}, Session: ${msg.sessionId}`);
        });
        
        // 删除空消息
        const stmt = db.prepare(`DELETE FROM chatMessages WHERE role = 'assistant' AND (content IS NULL OR TRIM(content) = '')`);
        const result = stmt.run();
        
        console.log(`\n✅ 成功删除 ${result.changes} 条空消息`);
        
        // 同时清理标记为 streaming 但未完成的消息（超过 5 分钟）
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const streamingStmt = db.prepare(`
            DELETE FROM chatMessages 
            WHERE isStreaming = 1 
            AND timestamp < ?
        `);
        const streamingResult = streamingStmt.run(fiveMinutesAgo);
        
        if (streamingResult.changes > 0) {
            console.log(`✅ 清理了 ${streamingResult.changes} 条未完成的流式消息`);
        }
        
        db.close();
        console.log('\n💡 清理完成！请重启应用后重试。');
        return true;
        
    } catch (error) {
        console.error('❌ 清理失败:', error.message);
        console.log('\n提示：如果数据库被占用，请先关闭应用再运行此脚本');
        return false;
    }
}

// 执行清理
console.log('🧹 FlowBoard - 清理空 AI 消息\n');
console.log('=' .repeat(60));
cleanEmptyMessages().catch(console.error);
console.log('=' .repeat(60));
