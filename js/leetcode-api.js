/**
 * LeetCode API 服务模块
 * 提供与 LeetCode 官方/第三方 API 的交互
 */

class LeetCodeAPI {
    constructor() {
        // GraphQL API 端点
        this.baseURL = 'https://leetcode.com';
        this.cnBaseURL = 'https://leetcode.cn';
        this.graphQLEndpoint = '/graphql';
        
        // 缓存
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
        
        // 用户会话
        this.session = null;
        this.csrfToken = null;
    }

    // ========================================
    // 工具方法
    // ========================================
    
    /**
     * 发送 GraphQL 请求
     */
    async graphqlQuery(query, variables = {}, endpoint = 'global') {
        const baseURL = endpoint === 'cn' ? this.cnBaseURL : this.baseURL;
        
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        // 如果有会话信息，添加到请求头
        if (this.session) {
            headers['Cookie'] = `LEETCODE_SESSION=${this.session}`;
        }
        if (this.csrfToken) {
            headers['X-CSRFToken'] = this.csrfToken;
        }

        try {
            const response = await fetch(`${baseURL}${this.graphQLEndpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.errors) {
                throw new Error(data.errors[0].message);
            }

            return data.data;
        } catch (error) {
            console.error('GraphQL query failed:', error);
            throw error;
        }
    }

    /**
     * 检查是否已登录
     */
    isLoggedIn() {
        return !!this.session;
    }

    /**
     * 设置会话信息
     */
    setSession(session, csrfToken = null) {
        this.session = session;
        this.csrfToken = csrfToken;
        localStorage.setItem('leetcode_session', session);
        if (csrfToken) {
            localStorage.setItem('leetcode_csrf', csrfToken);
        }
    }

    /**
     * 从本地存储恢复会话
     */
    restoreSession() {
        const session = localStorage.getItem('leetcode_session');
        const csrfToken = localStorage.getItem('leetcode_csrf');
        if (session) {
            this.session = session;
            this.csrfToken = csrfToken;
            return true;
        }
        return false;
    }

    /**
     * 清除会话
     */
    clearSession() {
        this.session = null;
        this.csrfToken = null;
        localStorage.removeItem('leetcode_session');
        localStorage.removeItem('leetcode_csrf');
    }

    // ========================================
    // 题目相关 API
    // ========================================

    /**
     * 获取所有题目列表
     */
    async getAllProblems() {
        const cacheKey = 'all_problems';
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const query = `
            query problemsetQuestionList {
                problemsetQuestionList: questionList {
                    total: totalNum
                    questions: data {
                        acRate
                        difficulty
                        freqBar
                        frontendQuestionId: questionFrontendId
                        isFavor
                        paidOnly: isPaidOnly
                        status
                        title
                        titleSlug
                        topicTags {
                            name
                            id
                            slug
                        }
                        hasSolution
                        hasVideoSolution
                    }
                }
            }
        `;

        try {
            const data = await this.graphqlQuery(query);
            const problems = data.problemsetQuestionList.questions.map(q => ({
                id: parseInt(q.frontendQuestionId),
                title: q.title,
                titleSlug: q.titleSlug,
                titleEn: q.titleSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                difficulty: q.difficulty.toLowerCase(),
                status: q.status === 'AC' ? 'solved' : q.status === 'TRIED' ? 'attempted' : 'unsolved',
                acceptance: (q.acRate * 100).toFixed(1) + '%',
                isPaidOnly: q.paidOnly,
                tags: q.topicTags.map(t => t.name),
                hasSolution: q.hasSolution,
                hasVideoSolution: q.hasVideoSolution
            }));

            this.setCache(cacheKey, problems);
            return problems;
        } catch (error) {
            console.error('Failed to fetch problems:', error);
            return null;
        }
    }

    /**
     * 获取单个题目详情
     */
    async getProblemDetail(titleSlug) {
        const cacheKey = `problem_${titleSlug}`;
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const query = `
            query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionId
                    questionFrontendId
                    boundTopicId
                    title
                    titleSlug
                    content
                    translatedTitle
                    translatedContent
                    difficulty
                    likes
                    dislikes
                    isLiked
                    similarQuestions
                    contributors {
                        username
                        profileUrl
                        avatarUrl
                        __typename
                    }
                    langToValidPlayground
                    topicTags {
                        name
                        slug
                        translatedName
                        __typename
                    }
                    companyTagStats
                    codeSnippets {
                        lang
                        langSlug
                        code
                        __typename
                    }
                    stats
                    hints
                    solution {
                        id
                        canSeeDetail
                        __typename
                    }
                    status
                    sampleTestCase
                    metaData
                    judgerAvailable
                    judgeType
                    mysqlSchemas
                    enableRunCode
                    enableTestMode
                    envInfo
                    libraryUrl
                    adminUrl
                    challengeQuestion {
                        id
                        date
                        incompleteChallengeCount
                        streakCount
                        type
                        __typename
                    }
                    __typename
                }
            }
        `;

        try {
            const data = await this.graphqlQuery(query, { titleSlug });
            const q = data.question;

            // 解析代码模板
            const templates = {};
            if (q.codeSnippets) {
                q.codeSnippets.forEach(snippet => {
                    const langMap = {
                        'cpp': 'cpp',
                        'java': 'java',
                        'python': 'python',
                        'python3': 'python',
                        'c': 'c',
                        'csharp': 'csharp',
                        'javascript': 'javascript',
                        'typescript': 'typescript',
                        'php': 'php',
                        'swift': 'swift',
                        'kotlin': 'kotlin',
                        'dart': 'dart',
                        'go': 'go',
                        'ruby': 'ruby',
                        'scala': 'scala',
                        'rust': 'rust',
                        'racket': 'racket',
                        'erlang': 'erlang',
                        'elixir': 'elixir'
                    };
                    const lang = langMap[snippet.langSlug];
                    if (lang) {
                        templates[lang] = snippet.code;
                    }
                });
            }

            const problem = {
                id: parseInt(q.questionFrontendId),
                title: q.translatedTitle || q.title,
                titleEn: q.title,
                titleSlug: q.titleSlug,
                difficulty: q.difficulty.toLowerCase(),
                status: q.status === 'AC' ? 'solved' : q.status === 'TRIED' ? 'attempted' : 'unsolved',
                description: q.translatedContent || q.content,
                likes: q.likes,
                dislikes: q.dislikes,
                tags: q.topicTags.map(t => t.translatedName || t.name),
                templates: templates,
                metadata: JSON.parse(q.metaData || '{}'),
                sampleTestCase: q.sampleTestCase
            };

            this.setCache(cacheKey, problem);
            return problem;
        } catch (error) {
            console.error('Failed to fetch problem detail:', error);
            return null;
        }
    }

    /**
     * 获取每日一题
     */
    async getDailyProblem() {
        const query = `
            questionOfToday {
                activeDailyCodingChallengeQuestion {
                    date
                    userStatus
                    link
                    question {
                        acRate
                        difficulty
                        freqBar
                        frontendQuestionId: questionFrontendId
                        isFavor
                        paidOnly: isPaidOnly
                        status
                        title
                        titleSlug
                        hasVideoSolution
                        hasSolution
                        topicTags {
                            name
                            id
                            slug
                        }
                    }
                }
            }
        `;

        try {
            const data = await this.graphqlQuery(query);
            return data.activeDailyCodingChallengeQuestion;
        } catch (error) {
            console.error('Failed to fetch daily problem:', error);
            return null;
        }
    }

    // ========================================
    // 用户相关 API
    // ========================================

    /**
     * 获取用户信息
     */
    async getUserProfile(username) {
        const query = `
            query userProfile($username: String!) {
                matchedUser(username: $username) {
                    username
                    githubUrl
                    twitterUrl
                    linkedinUrl
                    profile {
                        realName
                        websites
                        countryName
                        company
                        school
                        aboutMe
                        starRating
                    }
                    submitStats {
                        acSubmissionNum {
                            difficulty
                            count
                            submissions
                        }
                        totalSubmissionNum {
                            difficulty
                            count
                            submissions
                        }
                    }
                    contributions {
                        points
                        questionCount
                        testcaseCount
                    }
                }
            }
        `;

        try {
            const data = await this.graphqlQuery(query, { username });
            return data.matchedUser;
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            return null;
        }
    }

    /**
     * 获取用户提交记录
     */
    async getUserSubmissions(username, limit = 20) {
        const query = `
            query recentSubmissions($username: String!, $limit: Int) {
                recentSubmissionList(username: $username, limit: $limit) {
                    title
                    titleSlug
                    timestamp
                    statusDisplay
                    lang
                    __typename
                }
            }
        `;

        try {
            const data = await this.graphqlQuery(query, { username, limit });
            return data.recentSubmissionList.map(sub => ({
                title: sub.title,
                titleSlug: sub.titleSlug,
                timestamp: new Date(parseInt(sub.timestamp) * 1000),
                status: sub.statusDisplay.toLowerCase(),
                language: sub.lang
            }));
        } catch (error) {
            console.error('Failed to fetch submissions:', error);
            return null;
        }
    }

    /**
     * 获取用户解题统计
     */
    async getUserStats(username) {
        const query = `
            query userProblemsSolved($username: String!) {
                matchedUser(username: $username) {
                    submitStats {
                        acSubmissionNum {
                            difficulty
                            count
                        }
                    }
                }
            }
        `;

        try {
            const data = await this.graphqlQuery(query, { username });
            const stats = data.matchedUser.submitStats.acSubmissionNum;
            return {
                total: stats.find(s => s.difficulty === 'All')?.count || 0,
                easy: stats.find(s => s.difficulty === 'Easy')?.count || 0,
                medium: stats.find(s => s.difficulty === 'Medium')?.count || 0,
                hard: stats.find(s => s.difficulty === 'Hard')?.count || 0
            };
        } catch (error) {
            console.error('Failed to fetch user stats:', error);
            return null;
        }
    }

    // ========================================
    // 提交代码相关
    // ========================================

    /**
     * 运行代码测试
     */
    async runCode(titleSlug, code, language, testCase = '') {
        if (!this.isLoggedIn()) {
            throw new Error('请先登录');
        }

        const url = `${this.baseURL}/problems/${titleSlug}/interpret_solution/`;
        
        const body = {
            lang: language,
            question_id: titleSlug,
            typed_code: code,
            data_input: testCase
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.csrfToken,
                    'Cookie': `LEETCODE_SESSION=${this.session}`
                },
                body: JSON.stringify(body)
            });

            return await response.json();
        } catch (error) {
            console.error('Failed to run code:', error);
            throw error;
        }
    }

    /**
     * 提交代码
     */
    async submitCode(titleSlug, code, language) {
        if (!this.isLoggedIn()) {
            throw new Error('请先登录');
        }

        const url = `${this.baseURL}/problems/${titleSlug}/submit/`;
        
        const body = {
            lang: language,
            question_id: titleSlug,
            typed_code: code
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.csrfToken,
                    'Cookie': `LEETCODE_SESSION=${this.session}`
                },
                body: JSON.stringify(body)
            });

            return await response.json();
        } catch (error) {
            console.error('Failed to submit code:', error);
            throw error;
        }
    }

    /**
     * 获取提交结果
     */
    async getSubmissionResult(submissionId) {
        const url = `${this.baseURL}/submissions/detail/${submissionId}/check/`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Cookie': `LEETCODE_SESSION=${this.session}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to get submission result:', error);
            throw error;
        }
    }

    // ========================================
    // 缓存管理
    // ========================================

    getCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.time < this.cacheExpiry) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            time: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

// 创建全局实例
const leetCodeAPI = new LeetCodeAPI();

// 尝试恢复会话
leetCodeAPI.restoreSession();

console.log('LeetCode API 模块已加载');
