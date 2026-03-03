/**
 * FlowBoard - LLM Client
 * 纯前端 LLM API 调用封装，支持多厂商流式输出
 */

// 提供商配置
const LLM_PROVIDERS = {
    qwen: {
        name: '通义千问',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: 'qwen-max',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
        docs: 'https://help.aliyun.com/zh/dashscope'
    },
    kimi: {
        name: 'Kimi',
        baseUrl: 'https://api.moonshot.cn/v1',
        defaultModel: 'moonshot-v1-8k',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        docs: 'https://platform.moonshot.cn/docs'
    },
    glm: {
        name: '智谱 GLM',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        defaultModel: 'glm-4',
        models: ['glm-4', 'glm-4-flash'],
        docs: 'https://open.bigmodel.cn/dev/api'
    },
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-mini',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
        docs: 'https://platform.openai.com/docs'
    }
};

class LLMClient {
    constructor(provider, apiKey, options = {}) {
        this.provider = provider;
        this.apiKey = apiKey;
        this.config = LLM_PROVIDERS[provider] || LLM_PROVIDERS.qwen;
        this.baseUrl = options.baseUrl || this.config.baseUrl;
        this.model = options.model || this.config.defaultModel;
        this.temperature = options.temperature ?? 0.7;
        this.maxRetries = options.maxRetries || 2;
    }

    /**
     * 非流式对话
     */
    async chat(messages, options = {}) {
        const response = await this._makeRequest('/chat/completions', {
            model: options.model || this.model,
            messages,
            temperature: options.temperature ?? this.temperature,
            max_tokens: options.maxTokens
        });

        return {
            content: response.choices[0]?.message?.content || '',
            model: response.model,
            usage: response.usage,
            finishReason: response.choices[0]?.finish_reason
        };
    }

    /**
     * 流式对话 - 返回 AsyncGenerator
     */
    async *chatStream(messages, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: options.model || this.model,
                    messages,
                    temperature: options.temperature ?? this.temperature,
                    max_tokens: options.maxTokens,
                    stream: true
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error: ${response.status} - ${error}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // 保留不完整行

                for (const line of lines) {
                    const chunk = this._parseSSELine(line);
                    if (chunk) yield chunk;
                }
            }

            // 处理剩余缓冲
            if (buffer) {
                const chunk = this._parseSSELine(buffer);
                if (chunk) yield chunk;
            }

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw error;
        }
    }

    /**
     * 测试连接
     */
    async testConnection() {
        const startTime = performance.now();
        try {
            await this.chat([{ role: 'user', content: 'Hello' }], { maxTokens: 5 });
            return {
                success: true,
                latency: Math.round(performance.now() - startTime)
            };
        } catch (error) {
            return {
                success: false,
                latency: Math.round(performance.now() - startTime),
                error: error.message
            };
        }
    }

    /**
     * 解析 SSE 数据行
     */
    _parseSSELine(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') return null;
        
        if (trimmed.startsWith('data: ')) {
            try {
                const data = JSON.parse(trimmed.slice(6));
                const delta = data.choices[0]?.delta;
                return {
                    content: delta?.content || '',
                    reasoning: delta?.reasoning_content || '',
                    finishReason: data.choices[0]?.finish_reason,
                    usage: data.usage
                };
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * 内部请求方法
     */
    async _makeRequest(endpoint, body) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        return response.json();
    }
}

/**
 * LLM 管理器 - 多提供商管理和配置持久化
 */
class LLMManager {
    constructor() {
        this.clients = new Map();
        this.config = null;
        this.activeProvider = 'qwen';
    }

    async init() {
        await this.loadConfig();
    }

    async loadConfig() {
        try {
            // 从 Electron safeStorage 加载（加密存储）
            if (window.electronAPI?.loadAiConfig) {
                const result = await window.electronAPI.loadAiConfig();
                if (result.success) {
                    this.config = result.config;
                    this.activeProvider = this.config.defaultProvider || 'qwen';
                }
            } else {
                // 降级：从 IndexedDB 加载
                const config = await flowboardDB.getKV('llm_config');
                if (config) {
                    this.config = config;
                    this.activeProvider = config.defaultProvider || 'qwen';
                }
            }
        } catch (error) {
            console.error('[LLMManager] 加载配置失败:', error);
            this.config = this.getDefaultConfig();
        }
    }

    async saveConfig(config) {
        this.config = { ...this.config, ...config };
        
        try {
            if (window.electronAPI?.saveAiConfig) {
                await window.electronAPI.saveAiConfig(this.config);
            } else {
                await flowboardDB.setKV('llm_config', this.config);
            }
        } catch (error) {
            console.error('[LLMManager] 保存配置失败:', error);
            throw error;
        }
    }

    getDefaultConfig() {
        return {
            providers: {
                qwen: { enabled: false, apiKey: '' },
                kimi: { enabled: false, apiKey: '' },
                glm: { enabled: false, apiKey: '' },
                openai: { enabled: false, apiKey: '' }
            },
            defaultProvider: 'qwen',
            fallbackProvider: 'glm'
        };
    }

    getClient(provider = null) {
        const p = provider || this.activeProvider;
        
        if (this.clients.has(p)) {
            return this.clients.get(p);
        }

        const providerConfig = this.config?.providers?.[p];
        if (!providerConfig?.apiKey) {
            throw new Error(`提供商 ${p} 未配置 API Key`);
        }

        const client = new LLMClient(p, providerConfig.apiKey);
        this.clients.set(p, client);
        return client;
    }

    setActiveProvider(provider) {
        if (!LLM_PROVIDERS[provider]) {
            throw new Error(`未知的提供商: ${provider}`);
        }
        this.activeProvider = provider;
    }

    async testProvider(provider) {
        try {
            const client = this.getClient(provider);
            return await client.testConnection();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getAvailableProviders() {
        if (!this.config?.providers) return [];
        
        return Object.entries(this.config.providers)
            .filter(([_, config]) => config.enabled && config.apiKey)
            .map(([key]) => key);
    }
}

/**
 * Prompt 模板管理
 */
const PromptTemplates = {
    // 学习计划生成
    learningPlan: (goal, level, hoursPerWeek, deadline) => `
你是一位资深的学习规划专家。请为用户制定一份结构化的学习计划。

## 学习目标
${goal}

## 当前水平
${level || '未指定'}

## 时间投入
每周可投入 ${hoursPerWeek || '未指定'} 小时

## 截止日期
${deadline || '未指定'}

## 输出要求
请以 Markdown 格式输出学习计划，包含以下内容：
1. 计划概述（200字以内）
2. 阶段划分（3-5个阶段，每个阶段包含：目标、时长、具体任务）
3. 每个阶段的里程碑节点
4. 推荐学习资源（书籍、课程、文档）
5. 成功标准

使用中文回复。
`,

    // 任务拆解
    taskDecomposition: (stageTitle, stageGoal, stageDuration) => `
请将以下学习阶段拆解为5-15个具体可执行的任务。

## 阶段名称
${stageTitle}

## 阶段目标
${stageGoal}

## 阶段时长
${stageDuration}

## 输出要求
请输出 JSON 数组格式，每个任务包含：
- title: 任务标题
- estimatedHours: 预估耗时（小时）
- difficulty: 难度（easy/medium/hard）
- dependencies: 前置任务索引数组（可选）
- description: 任务描述

示例：
[
  {
    "title": "学习基础语法",
    "estimatedHours": 4,
    "difficulty": "easy",
    "description": "掌握基本数据类型和控制流程"
  }
]
`,

    // 学习复盘
    learningReview: (planData, taskStats, timeStats) => `
请基于以下学习数据生成复盘报告。

## 计划数据
${JSON.stringify(planData, null, 2)}

## 任务统计
${JSON.stringify(taskStats, null, 2)}

## 时间统计
${JSON.stringify(timeStats, null, 2)}

## 输出要求
请以 Markdown 格式输出复盘报告，包含：
1. 本期概览（完成率、任务数、学习时长）
2. 目标达成分析
3. 效率分析
4. 瓶颈识别和改进建议
5. 鼓励语

使用中文回复，语气友好专业。
`,

    // 面试复盘
    interviewReview: (transcript, role) => `
你是一位资深的技术面试官。请对以下面试内容进行复盘分析。

## 面试内容
${transcript}

## 候选人角色
${role || '软件开发工程师'}

## 输出要求
请以 Markdown 格式输出复盘报告，包含：
1. 问答对提取（逐条列出问题和回答摘要）
2. 表现评分（技术深度、表达清晰度、逻辑完整性，各1-5星）
3. 知识点覆盖度分析
4. 薄弱环节和改进建议
5. 推荐学习资源

使用中文回复，语气专业客观。
`,

    // RAG 问答系统提示
    ragQA: (question, context) => `
基于以下参考内容回答问题。如果参考内容不足以回答问题，请明确说明。

## 参考内容
${context}

## 用户问题
${question}

## 回答要求
1. 基于参考内容回答
2. 如果信息不足，说明"根据现有资料无法确定"
3. 引用来源时使用 [^1^] 格式标注
4. 保持回答简洁准确

请用中文回答。
`
};

/**
 * Priority-aware LLM Manager
 * Supports ordered provider list with automatic failover and per-provider timeout.
 */
class PriorityLLMManager extends LLMManager {
    constructor() {
        super();
        // Ordered provider list (highest priority first)
        this.priorityList = [];
        // Per-provider timeout in ms (default 30s)
        this.timeouts = {};
        // Per-provider max retries
        this.retries = {};
        // Last failover notification (avoid spamming)
        this._lastFailoverTs = 0;
        // Callback for UI notifications
        this.onFailover = null;
    }

    async init() {
        await super.init();
        await this.loadPriorityConfig();
    }

    async loadPriorityConfig() {
        try {
            const saved = await flowboardDB.getKV('llm_priority_config');
            if (saved) {
                this.priorityList = saved.priorityList || [];
                this.timeouts = saved.timeouts || {};
                this.retries = saved.retries || {};
            }
        } catch (e) {
            console.warn('[PriorityLLMManager] Failed to load priority config:', e.message);
        }

        // Ensure priorityList is populated with all available providers
        if (this.priorityList.length === 0) {
            this.priorityList = this._buildDefaultPriority();
        }
    }

    async savePriorityConfig() {
        await flowboardDB.setKV('llm_priority_config', {
            priorityList: this.priorityList,
            timeouts: this.timeouts,
            retries: this.retries
        });
    }

    _buildDefaultPriority() {
        const available = this.getAvailableProviders();
        if (available.length > 0) return available;
        return Object.keys(LLM_PROVIDERS);
    }

    /**
     * Set the priority order. First element = highest priority.
     */
    setPriorityList(orderedProviders) {
        this.priorityList = orderedProviders;
    }

    setTimeout(provider, ms) {
        this.timeouts[provider] = ms;
    }

    setRetries(provider, count) {
        this.retries[provider] = count;
    }

    /**
     * Get an ordered list of usable providers (enabled + has API key).
     */
    getOrderedProviders() {
        const available = new Set(this.getAvailableProviders());
        const ordered = this.priorityList.filter(p => available.has(p));
        // Append any available provider not in priorityList
        for (const p of available) {
            if (!ordered.includes(p)) ordered.push(p);
        }
        return ordered;
    }

    /**
     * Non-streaming call with automatic failover across providers.
     */
    async chatWithFailover(messages, options = {}) {
        const providers = this.getOrderedProviders();
        if (providers.length === 0) {
            throw new Error('没有可用的 AI 提供商，请在设置中配置 API Key');
        }

        let lastError = null;
        for (const provider of providers) {
            const maxRetry = this.retries[provider] || 1;
            for (let attempt = 0; attempt < maxRetry; attempt++) {
                try {
                    const client = this.getClient(provider);
                    const result = await client.chat(messages, options);
                    // Record which provider was actually used
                    result.provider = provider;
                    return result;
                } catch (e) {
                    lastError = e;
                    console.warn(`[PriorityLLM] ${provider} attempt ${attempt + 1} failed:`, e.message);
                }
            }
            // Notify failover
            this._notifyFailover(provider, providers);
        }

        throw lastError || new Error('所有 AI 提供商均不可用');
    }

    /**
     * Streaming call with automatic failover across providers.
     * Returns { stream: AsyncGenerator, provider: string }
     */
    async streamWithFailover(messages, options = {}) {
        const providers = this.getOrderedProviders();
        if (providers.length === 0) {
            throw new Error('没有可用的 AI 提供商，请在设置中配置 API Key');
        }

        let lastError = null;
        for (const provider of providers) {
            try {
                const client = this.getClient(provider);
                // Test the stream by getting the first chunk
                const stream = client.chatStream(messages, options);
                return { stream, provider };
            } catch (e) {
                lastError = e;
                console.warn(`[PriorityLLM] ${provider} stream failed:`, e.message);
                this._notifyFailover(provider, providers);
            }
        }

        throw lastError || new Error('所有 AI 提供商均不可用');
    }

    _notifyFailover(failedProvider, allProviders) {
        const now = Date.now();
        if (now - this._lastFailoverTs < 3000) return;
        this._lastFailoverTs = now;

        const failedName = LLM_PROVIDERS[failedProvider]?.name || failedProvider;
        const nextIdx = allProviders.indexOf(failedProvider) + 1;
        const nextProvider = nextIdx < allProviders.length ? allProviders[nextIdx] : null;
        const nextName = nextProvider ? (LLM_PROVIDERS[nextProvider]?.name || nextProvider) : null;

        const msg = nextName
            ? `${failedName} 不可用，正在切换到 ${nextName}`
            : `${failedName} 不可用`;

        if (this.onFailover) {
            this.onFailover(failedProvider, nextProvider, msg);
        }
        if (typeof showToast === 'function') {
            showToast(msg);
        }
    }
}

// Exports
window.LLM_PROVIDERS = LLM_PROVIDERS;
window.LLMClient = LLMClient;
window.LLMManager = LLMManager;
window.PriorityLLMManager = PriorityLLMManager;
window.PromptTemplates = PromptTemplates;

// Use PriorityLLMManager as the global singleton
window.llmManager = new PriorityLLMManager();
window.priorityLLMManager = window.llmManager;
