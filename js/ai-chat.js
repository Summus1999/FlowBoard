/**
 * FlowBoard - AI 对话助手 (功能1)
 * 全局可唤起的 AI 对话面板，支持流式输出和会话管理
 */

// 会话状态管理
const ChatState = {
    sessions: [],
    currentSessionId: null,
    isStreaming: false,
    abortController: null,

    async loadSessions() {
        this.sessions = await flowboardDB.getByIndex('chatSessions', 'updatedAt') || [];
        if (this.sessions.length === 0) {
            await this.createSession();
        } else {
            // 按更新时间排序，获取最新的
            this.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
            this.currentSessionId = this.sessions[0].id;
        }
    },

    async createSession(title = '新对话') {
        const session = {
            id: flowboardDB.generateId('chat_'),
            title,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isPinned: false,
            model: llmManager.activeProvider,
            messageCount: 0
        };
        await flowboardDB.put('chatSessions', session);
        this.sessions.unshift(session);
        this.currentSessionId = session.id;
        return session;
    },

    async deleteSession(sessionId) {
        await flowboardDB.delete('chatSessions', sessionId);
        
        // 删除关联消息
        const messages = await flowboardDB.getByIndex('chatMessages', 'sessionId', sessionId);
        for (const msg of messages) {
            await flowboardDB.delete('chatMessages', msg.id);
        }

        this.sessions = this.sessions.filter(s => s.id !== sessionId);
        
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = this.sessions[0]?.id || null;
            if (!this.currentSessionId) {
                await this.createSession();
            }
        }
    },

    async pinSession(sessionId, pinned) {
        const session = await flowboardDB.get('chatSessions', sessionId);
        if (session) {
            session.isPinned = pinned;
            await flowboardDB.put('chatSessions', session);
            
            const idx = this.sessions.findIndex(s => s.id === sessionId);
            if (idx !== -1) {
                this.sessions[idx].isPinned = pinned;
            }
        }
    },

    async renameSession(sessionId, newTitle) {
        const session = await flowboardDB.get('chatSessions', sessionId);
        if (session) {
            session.title = newTitle;
            await flowboardDB.put('chatSessions', session);
            
            const idx = this.sessions.findIndex(s => s.id === sessionId);
            if (idx !== -1) {
                this.sessions[idx].title = newTitle;
            }
        }
    },

    async getMessages(sessionId) {
        const messages = await flowboardDB.getByIndex('chatMessages', 'sessionId', sessionId);
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    },

    async addMessage(sessionId, role, content, extra = {}) {
        const message = {
            id: flowboardDB.generateId('msg_'),
            sessionId,
            role,
            content,
            timestamp: Date.now(),
            ...extra
        };
        await flowboardDB.put('chatMessages', message);
        
        // 更新会话
        const session = await flowboardDB.get('chatSessions', sessionId);
        if (session) {
            session.updatedAt = Date.now();
            session.messageCount = (session.messageCount || 0) + 1;
            await flowboardDB.put('chatSessions', session);
            
            const idx = this.sessions.findIndex(s => s.id === sessionId);
            if (idx !== -1) {
                this.sessions[idx].updatedAt = session.updatedAt;
                this.sessions[idx].messageCount = session.messageCount;
            }
        }
        
        return message;
    },

    setCurrentSession(sessionId) {
        this.currentSessionId = sessionId;
    }
};

// AI Chat UI 管理
const AIChatUI = {
    container: null,
    isOpen: false,
    isMinimized: false,

    init() {
        this.createContainer();
        this.bindGlobalShortcuts();
        this.createFloatingButton();
    },

    createContainer() {
        const existing = document.getElementById('ai-chat-container');
        if (existing) existing.remove();

        this.container = document.createElement('div');
        this.container.id = 'ai-chat-container';
        this.container.className = 'ai-chat-container';
        this.container.innerHTML = `
            <div class="ai-chat-panel" id="aiChatPanel">
                <div class="ai-chat-header">
                    <div class="ai-chat-title">
                        <i class="fas fa-robot"></i>
                        <span>AI 助手</span>
                        <span class="ai-chat-model-badge" id="aiChatModelBadge">-</span>
                    </div>
                    <div class="ai-chat-actions">
                        <button class="ai-chat-btn" id="aiChatNewBtn" title="新对话">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="ai-chat-btn" id="aiChatMinimizeBtn" title="最小化">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button class="ai-chat-btn" id="aiChatCloseBtn" title="关闭">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="ai-chat-body">
                    <div class="ai-chat-sidebar" id="aiChatSidebar">
                        <div class="ai-chat-search">
                            <i class="fas fa-search"></i>
                            <input type="text" placeholder="搜索对话..." id="aiChatSearch">
                        </div>
                        <div class="ai-chat-sessions" id="aiChatSessions">
                            <!-- 会话列表 -->
                        </div>
                        <div class="ai-chat-sidebar-footer">
                            <button class="ai-chat-new-session-btn" id="aiChatNewSessionBtn">
                                <i class="fas fa-plus"></i> 新对话
                            </button>
                        </div>
                    </div>
                    <div class="ai-chat-main">
                        <div class="ai-chat-messages" id="aiChatMessages">
                            <!-- 消息列表 -->
                        </div>
                        <div class="ai-chat-input-area">
                            <div class="ai-chat-toolbar">
                                <button class="ai-chat-tool-btn" id="aiChatClearBtn" title="清空上下文">
                                    <i class="fas fa-broom"></i>
                                </button>
                                <button class="ai-chat-tool-btn" id="aiChatRagToggle" title="使用知识库">
                                    <i class="fas fa-book"></i>
                                    <span>知识库</span>
                                </button>
                                <button class="ai-chat-tool-btn" id="aiChatExportBtn" title="导出对话">
                                    <i class="fas fa-download"></i>
                                </button>
                            </div>
                            <div class="ai-chat-input-wrapper">
                                <textarea 
                                    class="ai-chat-input" 
                                    id="aiChatInput" 
                                    placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                                    rows="1"
                                ></textarea>
                                <button class="ai-chat-send-btn" id="aiChatSendBtn">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                            <div class="ai-chat-disclaimer">
                                AI 生成内容仅供参考，请自行核实重要信息
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
        this.bindEvents();
    },

    createFloatingButton() {
        const btn = document.createElement('button');
        btn.id = 'ai-chat-float-btn';
        btn.className = 'ai-chat-float-btn';
        btn.innerHTML = '<i class="fas fa-robot"></i>';
        btn.title = 'AI 助手 (Ctrl+J)';
        btn.onclick = () => this.toggle();
        document.body.appendChild(btn);
    },

    bindEvents() {
        // 头部按钮
        document.getElementById('aiChatNewBtn').onclick = () => this.onNewChat();
        document.getElementById('aiChatMinimizeBtn').onclick = () => this.minimize();
        document.getElementById('aiChatCloseBtn').onclick = () => this.close();
        
        // 侧边栏按钮
        document.getElementById('aiChatNewSessionBtn').onclick = () => this.onNewChat();
        document.getElementById('aiChatSearch').oninput = (e) => this.onSearchSessions(e.target.value);
        
        // 输入区
        const input = document.getElementById('aiChatInput');
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.onSend();
            }
        };
        input.oninput = () => this.autoResizeInput();
        
        document.getElementById('aiChatSendBtn').onclick = () => this.onSend();
        document.getElementById('aiChatClearBtn').onclick = () => this.onClearContext();
        document.getElementById('aiChatRagToggle').onclick = () => this.onToggleRAG();
        document.getElementById('aiChatExportBtn').onclick = () => this.onExport();
        
        // 点击外部关闭（可选）
        this.container.onclick = (e) => {
            if (e.target === this.container && this.isOpen) {
                this.close();
            }
        };
    },

    bindGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    },

    async open() {
        this.isOpen = true;
        this.container.classList.add('active');
        document.getElementById('aiChatPanel').classList.add('active');
        
        // 初始化数据
        await ChatState.loadSessions();
        this.renderSessions();
        await this.renderMessages();
        this.updateModelBadge();
        
        // 聚焦输入框
        setTimeout(() => document.getElementById('aiChatInput').focus(), 100);
    },

    close() {
        this.isOpen = false;
        this.container.classList.remove('active');
        document.getElementById('aiChatPanel').classList.remove('active');
    },

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    },

    minimize() {
        this.isMinimized = true;
        document.getElementById('aiChatPanel').classList.add('minimized');
    },

    restore() {
        this.isMinimized = false;
        document.getElementById('aiChatPanel').classList.remove('minimized');
    },

    renderSessions() {
        const container = document.getElementById('aiChatSessions');
        const sessions = ChatState.sessions;
        
        // 分离置顶和普通会话
        const pinned = sessions.filter(s => s.isPinned);
        const normal = sessions.filter(s => !s.isPinned);
        
        const renderSession = (s) => `
            <div class="ai-chat-session ${s.id === ChatState.currentSessionId ? 'active' : ''} ${s.isPinned ? 'pinned' : ''}" 
                 data-id="${s.id}">
                <i class="fas ${s.isPinned ? 'fa-thumbtack' : 'fa-comment'}"></i>
                <span class="ai-chat-session-title">${this.escapeHtml(s.title)}</span>
                <div class="ai-chat-session-actions">
                    <button class="ai-chat-session-btn pin-btn" title="${s.isPinned ? '取消置顶' : '置顶'}">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                    <button class="ai-chat-session-btn delete-btn" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = `
            ${pinned.length ? '<div class="ai-chat-session-group">置顶</div>' : ''}
            ${pinned.map(renderSession).join('')}
            ${normal.length ? '<div class="ai-chat-session-group">历史对话</div>' : ''}
            ${normal.map(renderSession).join('')}
        `;

        // 绑定会话点击事件
        container.querySelectorAll('.ai-chat-session').forEach(el => {
            const sessionId = el.dataset.id;
            
            el.onclick = (e) => {
                if (e.target.closest('.ai-chat-session-btn')) return;
                this.onSwitchSession(sessionId);
            };
            
            el.querySelector('.pin-btn').onclick = (e) => {
                e.stopPropagation();
                this.onPinSession(sessionId, !el.classList.contains('pinned'));
            };
            
            el.querySelector('.delete-btn').onclick = (e) => {
                e.stopPropagation();
                this.onDeleteSession(sessionId);
            };
        });
    },

    async renderMessages() {
        const container = document.getElementById('aiChatMessages');
        const messages = await ChatState.getMessages(ChatState.currentSessionId);
        
        container.innerHTML = messages.map(m => this.renderMessage(m)).join('');
        this.scrollToBottom();
    },

    renderMessage(message) {
        const isUser = message.role === 'user';
        const isError = message.isError;
        const isStreaming = message.isStreaming;
        
        return `
            <div class="ai-chat-message ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}" data-id="${message.id}">
                <div class="ai-chat-avatar">
                    <i class="fas ${isUser ? 'fa-user' : 'fa-robot'}"></i>
                </div>
                <div class="ai-chat-message-content">
                    <div class="ai-chat-message-header">
                        <span class="ai-chat-message-role">${isUser ? '你' : 'AI 助手'}</span>
                        <span class="ai-chat-message-time">${this.formatTime(message.timestamp)}</span>
                    </div>
                    <div class="ai-chat-message-body markdown-body">
                        ${isStreaming ? '<span class="typing-cursor"></span>' : this.renderMarkdown(message.content)}
                    </div>
                    ${!isUser && !isError ? `
                        <div class="ai-chat-message-actions">
                            <button class="ai-chat-msg-btn" onclick="AIChatUI.onCopyMessage('${message.id}')" title="复制">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="ai-chat-msg-btn" onclick="AIChatUI.onRegenerate('${message.id}')" title="重新生成">
                                <i class="fas fa-redo"></i>
                            </button>
                            <button class="ai-chat-msg-btn" onclick="AIChatUI.onFeedback('${message.id}', true)" title="有帮助">
                                <i class="fas fa-thumbs-up"></i>
                            </button>
                            <button class="ai-chat-msg-btn" onclick="AIChatUI.onFeedback('${message.id}', false)" title="无帮助">
                                <i class="fas fa-thumbs-down"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    appendMessage(message) {
        const container = document.getElementById('aiChatMessages');
        const div = document.createElement('div');
        div.innerHTML = this.renderMessage(message);
        container.appendChild(div.firstElementChild);
        this.scrollToBottom();
    },

    updateStreamingMessage(messageId, content) {
        const el = document.querySelector(`.ai-chat-message[data-id="${messageId}"] .ai-chat-message-body`);
        if (el) {
            el.innerHTML = this.renderMarkdown(content) + '<span class="typing-cursor"></span>';
        }
    },

    finalizeStreamingMessage(messageId, content) {
        const el = document.querySelector(`.ai-chat-message[data-id="${messageId}"] .ai-chat-message-body`);
        if (el) {
            el.innerHTML = this.renderMarkdown(content);
        }
    },

    scrollToBottom() {
        const container = document.getElementById('aiChatMessages');
        container.scrollTop = container.scrollHeight;
    },

    autoResizeInput() {
        const input = document.getElementById('aiChatInput');
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    },

    updateModelBadge() {
        const badge = document.getElementById('aiChatModelBadge');
        const provider = LLM_PROVIDERS[llmManager.activeProvider];
        badge.textContent = provider ? provider.name : llmManager.activeProvider;
    },

    // 事件处理
    async onSend() {
        const input = document.getElementById('aiChatInput');
        const content = input.value.trim();
        if (!content || ChatState.isStreaming) return;

        // 清空输入
        input.value = '';
        input.style.height = 'auto';

        // 添加用户消息
        const userMsg = await ChatState.addMessage(
            ChatState.currentSessionId, 
            'user', 
            content
        );
        this.appendMessage(userMsg);

        // 更新会话标题（如果是第一条消息）
        const messages = await ChatState.getMessages(ChatState.currentSessionId);
        if (messages.length <= 2) {
            const title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
            await ChatState.renameSession(ChatState.currentSessionId, title);
            this.renderSessions();
        }

        // 调用 AI
        await this.streamResponse();
    },

    async streamResponse() {
        ChatState.isStreaming = true;
        const sendBtn = document.getElementById('aiChatSendBtn');
        sendBtn.disabled = true;

        try {
            // 检查知识库模式
            const useRag = document.getElementById('aiChatRagToggle').classList.contains('active');
            let systemPrompt = '你是一个 helpful 的 AI 助手。';
            let context = '';

            if (useRag) {
                // RAG 检索
                const messages = await ChatState.getMessages(ChatState.currentSessionId);
                const lastUserQuery = messages.filter(m => m.role === 'user').pop()?.content || '';
                
                showToast('正在检索知识库...');
                const results = await ragEngine.retrieve(lastUserQuery, 3);
                
                if (results.length > 0) {
                    context = results.map((r, i) => `[${i+1}] ${r.content}`).join('\n\n');
                    systemPrompt = PromptTemplates.ragQA('', context);
                }
            }

            // 构建消息历史
            const messages = await ChatState.getMessages(ChatState.currentSessionId);
            const history = messages.slice(-10).map(m => ({ // 只取最近10条
                role: m.role,
                content: m.content
            }));

            if (systemPrompt && context) {
                history.unshift({ role: 'system', content: systemPrompt });
            }

            // 创建 AI 消息占位
            const aiMsgId = flowboardDB.generateId('msg_');
            const aiMsg = {
                id: aiMsgId,
                sessionId: ChatState.currentSessionId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                isStreaming: true
            };
            await flowboardDB.put('chatMessages', aiMsg);
            this.appendMessage(aiMsg);

            // 流式调用
            const client = llmManager.getClient();
            let fullContent = '';
            
            ChatState.abortController = new AbortController();

            for await (const chunk of client.chatStream(history)) {
                if (ChatState.abortController.signal.aborted) break;
                
                fullContent += chunk.content;
                this.updateStreamingMessage(aiMsgId, fullContent);
            }

            // 保存完整响应
            await flowboardDB.put('chatMessages', {
                ...aiMsg,
                content: fullContent,
                isStreaming: false
            });
            this.finalizeStreamingMessage(aiMsgId, fullContent);

        } catch (error) {
            console.error('[AIChat] 流式响应失败:', error);
            
            // 添加错误消息
            await ChatState.addMessage(
                ChatState.currentSessionId,
                'assistant',
                `抱歉，发生错误：${error.message}`,
                { isError: true }
            );
            this.renderMessages();
            
            showToast('AI 响应失败: ' + error.message);
        } finally {
            ChatState.isStreaming = false;
            ChatState.abortController = null;
            sendBtn.disabled = false;
        }
    },

    async onNewChat() {
        await ChatState.createSession();
        this.renderSessions();
        await this.renderMessages();
    },

    async onSwitchSession(sessionId) {
        ChatState.setCurrentSession(sessionId);
        this.renderSessions();
        await this.renderMessages();
    },

    async onPinSession(sessionId, pinned) {
        await ChatState.pinSession(sessionId, pinned);
        this.renderSessions();
    },

    async onDeleteSession(sessionId) {
        if (!confirm('确定删除这个对话吗？')) return;
        await ChatState.deleteSession(sessionId);
        this.renderSessions();
        await this.renderMessages();
    },

    onSearchSessions(keyword) {
        const sessions = document.querySelectorAll('.ai-chat-session');
        sessions.forEach(el => {
            const title = el.querySelector('.ai-chat-session-title').textContent;
            el.style.display = title.toLowerCase().includes(keyword.toLowerCase()) ? '' : 'none';
        });
    },

    async onClearContext() {
        if (!confirm('确定清空当前对话的上下文吗？')) return;
        
        // 删除所有消息但保留会话
        const messages = await ChatState.getMessages(ChatState.currentSessionId);
        for (const msg of messages) {
            await flowboardDB.delete('chatMessages', msg.id);
        }
        
        await this.renderMessages();
        showToast('上下文已清空');
    },

    onToggleRAG() {
        const btn = document.getElementById('aiChatRagToggle');
        btn.classList.toggle('active');
        showToast(btn.classList.contains('active') ? '已启用知识库' : '已关闭知识库');
    },

    async onExport() {
        const messages = await ChatState.getMessages(ChatState.currentSessionId);
        let markdown = '# AI 对话记录\n\n';
        markdown += `导出时间: ${new Date().toLocaleString()}\n\n`;
        
        for (const msg of messages) {
            const role = msg.role === 'user' ? '**用户**' : '**AI**';
            markdown += `## ${role} (${new Date(msg.timestamp).toLocaleString()})\n\n${msg.content}\n\n---\n\n`;
        }

        // 下载文件
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${ChatState.currentSessionId.slice(-8)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('对话已导出');
    },

    async onCopyMessage(messageId) {
        const msg = await flowboardDB.get('chatMessages', messageId);
        if (msg) {
            await navigator.clipboard.writeText(msg.content);
            showToast('已复制到剪贴板');
        }
    },

    async onRegenerate(messageId) {
        // 找到对应的用户消息并重新生成
        const messages = await ChatState.getMessages(ChatState.currentSessionId);
        const msgIndex = messages.findIndex(m => m.id === messageId);
        
        if (msgIndex > 0 && messages[msgIndex - 1].role === 'user') {
            // 删除当前 AI 响应及之后的消息
            for (let i = msgIndex; i < messages.length; i++) {
                await flowboardDB.delete('chatMessages', messages[i].id);
            }
            
            await this.renderMessages();
            await this.streamResponse();
        }
    },

    async onFeedback(messageId, helpful) {
        showToast(helpful ? '感谢反馈！' : '我们会持续改进');
    },

    // 工具方法
    renderMarkdown(text) {
        if (typeof marked !== 'undefined') {
            return marked.parse(text);
        }
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
};

// 初始化入口
function initAIChat() {
    // 初始化 LLM 管理器
    llmManager.init().then(() => {
        AIChatUI.init();
        console.log('[AIChat] AI 对话助手初始化完成');
    });
}

// 导出
window.ChatState = ChatState;
window.AIChatUI = AIChatUI;
window.initAIChat = initAIChat;
