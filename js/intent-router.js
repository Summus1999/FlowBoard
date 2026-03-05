/**
 * FlowBoard - Intent Router & Agent Dispatch
 * Lightweight intent classifier + agent-specific prompt routing
 */

const INTENT_TYPES = {
    KNOWLEDGE_QA: 'knowledge_qa',
    PLANNING: 'planning',
    DECOMPOSE: 'decompose',
    REVIEW: 'review',
    CHAT: 'chat'
};

const INTENT_META = {
    [INTENT_TYPES.KNOWLEDGE_QA]: {
        label: '知识问答',
        icon: 'fa-book',
        color: '#3b82f6',
        description: 'RAG retrieval + contextual Q&A'
    },
    [INTENT_TYPES.PLANNING]: {
        label: '学习规划',
        icon: 'fa-clipboard-list',
        color: '#8b5cf6',
        description: 'AI-generated learning plans'
    },
    [INTENT_TYPES.DECOMPOSE]: {
        label: '任务拆解',
        icon: 'fa-sitemap',
        color: '#f59e0b',
        description: 'Break goals into subtasks'
    },
    [INTENT_TYPES.REVIEW]: {
        label: '进度复盘',
        icon: 'fa-chart-line',
        color: '#22c55e',
        description: 'Progress review & suggestions'
    },
    [INTENT_TYPES.CHAT]: {
        label: '自由对话',
        icon: 'fa-comments',
        color: '#6b7280',
        description: 'General conversation'
    }
};

const IntentRouter = {

    // Rule-based keyword patterns (fast, zero-cost pre-filter)
    _keywordPatterns: {
        [INTENT_TYPES.KNOWLEDGE_QA]: [
            /根据.*(文档|资料|知识库|笔记)/,
            /帮我(查|找|搜|检索)/,
            /知识库.*中/,
            /在.*(文档|资料).*里/
        ],
        [INTENT_TYPES.PLANNING]: [
            /制定.*计划/, /生成.*计划/, /学习.*规划/,
            /帮我.*规划/, /制定.*路线/, /学习路线/,
            /如何学习/, /怎么学/
        ],
        [INTENT_TYPES.DECOMPOSE]: [
            /拆解.*任务/, /拆分.*任务/, /分解.*目标/,
            /帮我拆/, /任务.*拆/,
            /分成.*步骤/, /具体.*步骤/
        ],
        [INTENT_TYPES.REVIEW]: [
            /复盘/, /总结.*进度/, /学习.*回顾/,
            /本周.*总结/, /进度.*报告/, /学习.*分析/,
            /完成.*情况/, /学习.*怎么样/
        ]
    },

    /**
     * Classify user intent. Uses keyword matching first; falls back to LLM if ambiguous.
     * @param {string} userMessage - latest user input
     * @param {Array} history - recent conversation messages [{role, content}]
     * @returns {Promise<{intent: string, confidence: number, method: string}>}
     */
    async classify(userMessage, history = []) {
        // Phase 1: keyword pre-filter
        const keywordResult = this._classifyByKeywords(userMessage);
        if (keywordResult.confidence >= 0.8) {
            return { ...keywordResult, method: 'keyword' };
        }

        // Phase 2: RAG toggle override
        const ragActive = document.getElementById('aiChatRagToggle')?.classList.contains('active');
        if (ragActive) {
            return { intent: INTENT_TYPES.KNOWLEDGE_QA, confidence: 0.9, method: 'rag_toggle' };
        }

        // Phase 3: LLM-based classification (~100 tokens)
        try {
            const llmResult = await this._classifyByLLM(userMessage, history);
            return { ...llmResult, method: 'llm' };
        } catch (e) {
            console.warn('[IntentRouter] LLM classification failed, defaulting to chat:', e.message);
            return { intent: INTENT_TYPES.CHAT, confidence: 0.5, method: 'fallback' };
        }
    },

    _classifyByKeywords(text) {
        for (const [intent, patterns] of Object.entries(this._keywordPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    return { intent, confidence: 0.85 };
                }
            }
        }
        return { intent: INTENT_TYPES.CHAT, confidence: 0.4 };
    },

    async _classifyByLLM(userMessage, history) {
        const classifyPrompt = `Classify the user intent into exactly ONE of these categories:
- knowledge_qa: user asks questions that should be answered from their personal knowledge base / documents
- planning: user wants to create or modify a learning plan / study roadmap
- decompose: user wants to break down a goal or task into smaller subtasks
- review: user asks for progress review, weekly summary, or study analysis
- chat: general conversation, greetings, or anything else

Recent context (last 2 messages):
${history.slice(-2).map(m => `${m.role}: ${m.content.slice(0, 100)}`).join('\n')}

Current user message: ${userMessage}

Respond with ONLY the category name (e.g. "chat"). No explanation.`;

        const client = priorityLLMManager.getClient();
        const response = await client.chat(
            [{ role: 'user', content: classifyPrompt }],
            { maxTokens: 10, temperature: 0.1 }
        );

        const raw = response.content.trim().toLowerCase().replace(/[^a-z_]/g, '');
        const validIntents = Object.values(INTENT_TYPES);
        const intent = validIntents.includes(raw) ? raw : INTENT_TYPES.CHAT;

        return { intent, confidence: intent === raw ? 0.9 : 0.5 };
    },

    /**
     * Build the system prompt and pre-process context for a given intent.
     * @returns {Promise<{systemPrompt: string, context: string, agentMeta: object}>}
     */
    async prepareAgentContext(intent, userMessage) {
        const meta = INTENT_META[intent];

        switch (intent) {
            case INTENT_TYPES.KNOWLEDGE_QA:
                return this._prepareKnowledgeQA(userMessage, meta);

            case INTENT_TYPES.PLANNING:
                return this._preparePlanning(userMessage, meta);

            case INTENT_TYPES.DECOMPOSE:
                return this._prepareDecompose(userMessage, meta);

            case INTENT_TYPES.REVIEW:
                return this._prepareReview(userMessage, meta);

            default:
                return {
                    systemPrompt: '你是 FlowBoard 的 AI 助手，回答用户问题时使用中文，简洁专业。',
                    context: '',
                    agentMeta: meta
                };
        }
    },

    async _prepareKnowledgeQA(query, meta) {
        let context = '';
        try {
            if (typeof ragEngine !== 'undefined' && ragEngine.retrieve) {
                const results = await ragEngine.retrieve(query, 3);
                if (results.length > 0) {
                    context = results.map((r, i) =>
                        `[${i + 1}] (来源: ${r.fileName || '未知'}) ${r.content}`
                    ).join('\n\n');
                }
            }
        } catch (e) {
            console.warn('[IntentRouter] RAG retrieval failed:', e.message);
        }

        const systemPrompt = context
            ? PromptTemplates.ragQA(query, context)
            : '你是 FlowBoard 的 AI 助手。用户想查询知识库，但知识库暂无相关内容。请根据你的通用知识尽力回答，并提示用户可以导入相关文档到知识库。';

        return { systemPrompt, context, agentMeta: meta };
    },

    async _preparePlanning(query, meta) {
        const systemPrompt = `你是一位资深学习规划专家。用户正在请求制定学习计划。

## 输出要求
1. 以 Markdown 格式输出结构化学习计划
2. 包含：计划概述、阶段划分（3-5 个阶段）、每阶段目标和任务、里程碑、推荐资源
3. 每个阶段标题格式：## 阶段 N：标题
4. 使用中文，语气专业友好`;

        return { systemPrompt, context: '', agentMeta: meta };
    },

    async _prepareDecompose(query, meta) {
        const systemPrompt = `你是一位任务拆解专家。用户需要将一个目标或任务拆解为可执行的小任务。

## 输出要求
1. 将目标拆解为 5-15 个具体可执行任务
2. 每个任务包含：标题、预估耗时、难度（简单/中等/困难）、简要描述
3. 按执行顺序排列，标注依赖关系
4. 以 Markdown 列表格式输出
5. 使用中文`;

        return { systemPrompt, context: '', agentMeta: meta };
    },

    async _prepareReview(query, meta) {
        let dataContext = '';
        try {
            const tasks = await flowboardDB.getAll('tasks');
            const completed = tasks.filter(t => t.status === 'done').length;
            const total = tasks.length;

            const pomodoroRecords = await flowboardDB.getAll('pomodoroRecords');
            const now = new Date();
            const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
            const weekPomos = pomodoroRecords.filter(r => new Date(r.startTime) >= weekAgo);

            const studyRecords = await flowboardDB.getAll('studyRecords');
            const weekStudy = studyRecords.filter(r => new Date(r.date) >= weekAgo);
            const totalMinutes = weekStudy.reduce((s, r) => s + (r.minutes || 0), 0);

            dataContext = `## 本周学习数据
- 任务完成: ${completed}/${total} (完成率 ${total > 0 ? ((completed / total) * 100).toFixed(0) : 0}%)
- 本周番茄钟: ${weekPomos.length} 个 (约 ${weekPomos.length * 25} 分钟)
- 本周学习时长: ${(totalMinutes / 60).toFixed(1)} 小时
- 日均学习: ${(totalMinutes / 7 / 60).toFixed(1)} 小时`;

        } catch (e) {
            dataContext = '（数据收集失败，请基于对话内容进行复盘）';
        }

        const systemPrompt = `你是一位学习教练，正在帮用户做学习进度复盘。

${dataContext}

## 输出要求
1. 本周概览（数据总结）
2. 完成情况分析
3. 效率和节奏评估
4. 存在的问题和瓶颈
5. 下周改进建议
6. 鼓励语

使用中文，Markdown 格式，语气友好专业。`;

        return { systemPrompt, context: dataContext, agentMeta: meta };
    },

    /**
     * 调用后端 crewAI 接口执行多 Agent 任务
     * 支持 planning / decompose / review 三类意图
     * 后端不可用时抛出异常，由调用方决定是否降级
     * 
     * @param {string} intent - INTENT_TYPES 之一
     * @param {string} userMessage - 用户输入
     * @returns {Promise<{success: boolean, result: string, crew_type: string}>}
     */
    async tryCrewExecution(intent, userMessage) {
        const serviceUrl = (window.aiSettingsState?.serviceUrl || 'http://localhost:8000').replace(/\/+$/, '');

        let endpoint, body;

        switch (intent) {
            case INTENT_TYPES.PLANNING:
                endpoint = '/crews/plan';
                body = {
                    goal: userMessage,
                    weekly_hours: 10,
                };
                break;

            case INTENT_TYPES.DECOMPOSE:
                endpoint = '/crews/decompose';
                body = {
                    task_title: userMessage.slice(0, 100),
                    task_description: userMessage,
                    estimated_hours: 10,
                };
                break;

            case INTENT_TYPES.REVIEW: {
                endpoint = '/crews/review';
                let tasksData = '[]';
                try {
                    const tasks = await flowboardDB.getAll('tasks');
                    tasksData = JSON.stringify(tasks.slice(0, 50).map(t => ({
                        title: t.title || t.name || '',
                        status: t.status || 'pending',
                        hours: t.estimatedHours || t.hours || 0,
                    })));
                } catch (_) {}
                body = {
                    period: 'weekly',
                    tasks_data: tasksData,
                };
                break;
            }

            default:
                return null;
        }

        const response = await fetch(`${serviceUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120000), // crewAI 最多等 2 分钟
        });

        if (!response.ok) {
            throw new Error(`crewAI backend ${response.status}`);
        }

        return await response.json();
    }
};

window.INTENT_TYPES = INTENT_TYPES;
window.INTENT_META = INTENT_META;
window.IntentRouter = IntentRouter;
