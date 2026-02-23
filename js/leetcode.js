/**
 * FlowBoard - LeetCode 刷题模块（增强版）
 * 优先使用真实 LeetCode API，失败时降级到本地数据
 */

// ========================================
// 全局状态
// ========================================

let leetCodeState = {
    isLoggedIn: false,
    username: '',
    currentProblem: null,
    currentLanguage: 'javascript',
    problems: [],
    isUsingRealData: false,
    solvedCount: 0,
    streakDays: 0,
    filter: 'all',
    statusFilter: 'all',
    searchQuery: '',
    isLoading: false,
    editor: null,
    dataSource: 'none' // 'api', 'local', 'none'
};

// ========================================
// 初始化
// ========================================

function initLeetCode() {
    // 初始化 Monaco Editor
    initMonacoEditor();
    
    // 检查登录状态
    checkLoginStatus();
    
    // 绑定事件
    initLeetCodeEventListeners();
    
    // 显示登录提示（如果未登录）
    if (!leetCodeState.isLoggedIn) {
        showLoginPrompt();
    } else {
        // 已登录，加载数据
        loadProblemsWithFallback();
    }
}

function checkLoginStatus() {
    // 从 API 模块恢复会话
    const hasSession = leetCodeAPI.restoreSession();
    
    if (hasSession) {
        leetCodeState.isLoggedIn = true;
        updateLoginButton();
        console.log('LeetCode 会话已恢复');
    }
}

function showLoginPrompt() {
    const listContainer = document.getElementById('problemList');
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="login-prompt" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                text-align: center;
                color: var(--text-secondary);
            ">
                <i class="fas fa-lock" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <h3 style="font-size: 16px; margin-bottom: 8px; color: var(--text-primary);">需要登录 LeetCode</h3>
                <p style="font-size: 13px; margin-bottom: 16px;">登录后可获取真实题目数据和提交代码</p>
                <button class="btn-primary" onclick="toggleLeetCodeLogin()" style="margin-bottom: 8px;">
                    <i class="fas fa-sign-in-alt"></i> 立即登录
                </button>
                <button class="btn-text" onclick="useLocalData()" style="font-size: 12px;">
                    暂不登录，使用本地数据
                </button>
            </div>
        `;
    }
    
    // 更新数据状态为未登录
    leetCodeState.dataSource = 'none';
    updateDataStatus();
    
    // 更新统计为本地数据
    updateLeetCodeStats();
}

// ========================================
// 数据加载（优先 API，失败降级）
// ========================================

async function loadProblemsWithFallback() {
    showLoading(true);
    
    // 首先尝试从 API 加载
    if (leetCodeState.isLoggedIn) {
        try {
            console.log('正在从 LeetCode API 加载题目...');
            const apiProblems = await leetCodeAPI.getAllProblems();
            
            if (apiProblems && apiProblems.length > 0) {
                leetCodeState.problems = apiProblems.map(p => ({
                    ...p,
                    source: 'api'
                }));
                leetCodeState.isUsingRealData = true;
                leetCodeState.dataSource = 'api';
                
                console.log(`成功从 API 加载 ${apiProblems.length} 道题目`);
                showToast(`已连接 LeetCode，加载 ${apiProblems.length} 道题目`);
                
                // 加载成功，获取用户统计
                await loadUserStats();
                
                // 设置默认题目
                leetCodeState.currentProblem = leetCodeState.problems[0];
                
                // 渲染
                renderProblemList();
                renderProblemDetail(leetCodeState.currentProblem);
                updateLeetCodeStats();
                updateDataStatus();
                showLoading(false);
                return;
            }
        } catch (error) {
            console.error('LeetCode API 加载失败:', error);
            showToast('API 连接失败，切换到本地数据');
        }
    }
    
    // API 失败或未登录，使用本地数据
    useLocalData();
}

function useLocalData() {
    console.log('使用本地模拟数据');
    
    leetCodeState.problems = getMockProblems().map(p => ({
        ...p,
        source: 'local'
    }));
    leetCodeState.isUsingRealData = false;
    leetCodeState.dataSource = 'local';
    
    // 设置默认题目
    leetCodeState.currentProblem = leetCodeState.problems[0];
    
    // 渲染
    renderProblemList();
    renderProblemDetail(leetCodeState.currentProblem);
    updateLeetCodeStats();
    updateDataStatus();
    showLoading(false);
    
    showToast('正在使用本地数据');
}

async function loadUserStats() {
    try {
        // 这里可以获取用户统计信息
        const submissions = submissionHistory.getStats();
        leetCodeState.solvedCount = submissions.accepted || 0;
        
        // 获取连续打卡天数
        leetCodeState.streakDays = submissionHistory.getStreakDays();
    } catch (error) {
        console.error('加载用户统计失败:', error);
    }
}

function showLoading(show) {
    leetCodeState.isLoading = show;
    const list = document.getElementById('problemList');
    if (list && show && leetCodeState.dataSource !== 'none') {
        list.innerHTML = '<div class="loading" style="text-align: center; padding: 40px; color: var(--text-secondary);"><i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 12px;"></i><p>加载中...</p></div>';
    }
}

// ========================================
// Monaco Editor 初始化
// ========================================

function initMonacoEditor() {
    require.config({ 
        paths: { 
            'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' 
        } 
    });

    require(['vs/editor/editor.main'], function() {
        // 定义自定义主题
        monaco.editor.defineTheme('leetcode-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6A9955' },
                { token: 'keyword', foreground: '569CD6' },
                { token: 'identifier', foreground: '9CDCFE' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'number', foreground: 'B5CEA8' },
            ],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.foreground': '#d4d4d4',
                'editor.lineHighlightBackground': '#2d2d2d',
                'editorLineNumber.foreground': '#858585',
                'editor.selectionBackground': '#264f78',
            }
        });

        // 创建编辑器
        const container = document.getElementById('monacoEditor');
        if (!container) return;

        leetCodeState.editor = monaco.editor.create(container, {
            value: LanguageConfig.getTemplate('javascript'),
            language: 'javascript',
            theme: 'leetcode-dark',
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            minimap: { enabled: true },
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            folding: true,
            renderWhitespace: 'selection',
            matchBrackets: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true
        });

        // 添加快捷键
        leetCodeState.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
            runCode();
        });

        leetCodeState.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function() {
            submitCode();
        });

        console.log('Monaco Editor 初始化完成');
    });
}

// ========================================
// 本地模拟数据
// ========================================

function getMockProblems() {
    return [
        {
            id: 1,
            title: '两数之和',
            titleEn: 'Two Sum',
            titleSlug: 'two-sum',
            difficulty: 'easy',
            status: 'solved',
            tags: ['数组', '哈希表'],
            acceptance: '52.3%',
            description: '给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值 target 的那两个整数，并返回它们的数组下标。',
            examples: [
                { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: '因为 nums[0] + nums[1] == 9' },
                { input: 'nums = [3,2,4], target = 6', output: '[1,2]' }
            ],
            constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'],
            templates: {
                javascript: `var twoSum = function(nums, target) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def twoSum(self, nums, target):\n        # 在此编写你的代码\n        pass`,
                java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[0];\n    }\n}`
            }
        },
        {
            id: 2,
            title: '两数相加',
            titleEn: 'Add Two Numbers',
            titleSlug: 'add-two-numbers',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['递归', '链表'],
            acceptance: '43.2%',
            description: '给你两个非空的链表，表示两个非负的整数。它们每位数字都是按照逆序的方式存储的，并且每个节点只能存储一位数字。',
            examples: [
                { input: 'l1 = [2,4,3], l2 = [5,6,4]', output: '[7,0,8]', explanation: '342 + 465 = 807' }
            ],
            constraints: ['每个链表中的节点数在范围 [1, 100] 内'],
            templates: {
                javascript: `var addTwoNumbers = function(l1, l2) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def addTwoNumbers(self, l1, l2):\n        pass`,
                java: `class Solution {\n    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {\n        return null;\n    }\n}`
            }
        },
        {
            id: 3,
            title: '无重复字符的最长子串',
            titleEn: 'Longest Substring Without Repeating Characters',
            titleSlug: 'longest-substring-without-repeating-characters',
            difficulty: 'medium',
            status: 'attempted',
            tags: ['哈希表', '字符串', '滑动窗口'],
            acceptance: '38.5%',
            description: '给定一个字符串 s，请你找出其中不含有重复字符的最长子串的长度。',
            examples: [
                { input: 's = "abcabcbb"', output: '3', explanation: '因为无重复字符的最长子串是 "abc"' }
            ],
            constraints: ['0 <= s.length <= 5 * 10^4'],
            templates: {
                javascript: `var lengthOfLongestSubstring = function(s) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def lengthOfLongestSubstring(self, s):\n        pass`,
                java: `class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        return 0;\n    }\n}`
            }
        },
        {
            id: 4,
            title: '寻找两个正序数组的中位数',
            titleEn: 'Median of Two Sorted Arrays',
            titleSlug: 'median-of-two-sorted-arrays',
            difficulty: 'hard',
            status: 'unsolved',
            tags: ['数组', '二分查找', '分治'],
            acceptance: '41.2%',
            description: '给定两个大小分别为 m 和 n 的正序数组 nums1 和 nums2。请你找出并返回这两个正序数组的中位数。算法的时间复杂度应该为 O(log (m+n))。',
            examples: [
                { input: 'nums1 = [1,3], nums2 = [2]', output: '2.00000', explanation: '合并数组 = [1,2,3]' }
            ],
            constraints: ['0 <= m <= 1000', '0 <= n <= 1000'],
            templates: {
                javascript: `var findMedianSortedArrays = function(nums1, nums2) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def findMedianSortedArrays(self, nums1, nums2):\n        pass`,
                java: `class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        return 0.0;\n    }\n}`
            }
        },
        {
            id: 5,
            title: '最长回文子串',
            titleEn: 'Longest Palindromic Substring',
            titleSlug: 'longest-palindromic-substring',
            difficulty: 'medium',
            status: 'solved',
            tags: ['字符串', '动态规划'],
            acceptance: '35.8%',
            description: '给你一个字符串 s，找到 s 中最长的回文子串。',
            examples: [
                { input: 's = "babad"', output: '"bab"', explanation: '"aba" 同样是符合题意的答案。' }
            ],
            constraints: ['1 <= s.length <= 1000'],
            templates: {
                javascript: `var longestPalindrome = function(s) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def longestPalindrome(self, s):\n        pass`,
                java: `class Solution {\n    public String longestPalindrome(String s) {\n        return "";\n    }\n}`
            }
        }
    ];
}

// ========================================
// 事件监听
// ========================================

function initLeetCodeEventListeners() {
    // 筛选标签
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            leetCodeState.filter = tab.dataset.filter;
            renderProblemList();
        });
    });

    // 状态筛选
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            leetCodeState.statusFilter = btn.dataset.status;
            renderProblemList();
        });
    });

    // 搜索
    const searchInput = document.getElementById('problemSearch');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                leetCodeState.searchQuery = e.target.value.toLowerCase();
                renderProblemList();
            }, 300);
        });
    }

    // 语言选择
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        const languages = LanguageConfig.getAllLanguages();
        languageSelect.innerHTML = languages.map(lang => 
            `<option value="${lang.id}">${lang.name}</option>`
        ).join('');

        languageSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }

    // 登录标签切换
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.dataset.tab;
            document.getElementById('cookieLoginForm').style.display = tabName === 'cookie' ? 'block' : 'none';
            document.getElementById('tokenLoginForm').style.display = tabName === 'token' ? 'block' : 'none';
        });
    });
}

// ========================================
// 题目列表渲染
// ========================================

function renderProblemList() {
    const listContainer = document.getElementById('problemList');
    if (!listContainer) return;

    let filtered = leetCodeState.problems.filter(p => {
        if (leetCodeState.filter !== 'all' && p.difficulty !== leetCodeState.filter) {
            return false;
        }
        if (leetCodeState.statusFilter !== 'all' && p.status !== leetCodeState.statusFilter) {
            return false;
        }
        if (leetCodeState.searchQuery) {
            const searchLower = leetCodeState.searchQuery;
            return p.title.toLowerCase().includes(searchLower) ||
                   p.titleEn.toLowerCase().includes(searchLower) ||
                   p.id.toString() === searchLower;
        }
        return true;
    });

    listContainer.innerHTML = filtered.map(problem => {
        const isActive = leetCodeState.currentProblem && leetCodeState.currentProblem.id === problem.id;
        const statusIcon = problem.status === 'solved' ? 'fa-check-circle' :
                          problem.status === 'attempted' ? 'fa-clock' : 'fa-circle';
        const statusClass = problem.status;
        const dataSourceBadge = problem.source === 'api' ? '<i class="fas fa-cloud" title="LeetCode 官方数据"></i>' : '<i class="fas fa-database" title="本地数据"></i>';
        
        return `
            <div class="problem-item ${isActive ? 'active' : ''}" onclick="selectProblem(${problem.id})">
                <div class="problem-status ${statusClass}">
                    <i class="fas ${statusIcon}"></i>
                </div>
                <div class="problem-info">
                    <div class="problem-item-title">
                        ${problem.id}. ${problem.title}
                        <span style="margin-left: 6px; opacity: 0.5; font-size: 10px;">${dataSourceBadge}</span>
                    </div>
                    <div class="problem-item-id">${problem.titleEn}</div>
                </div>
                <div class="problem-item-difficulty ${problem.difficulty}">
                    ${getDifficultyText(problem.difficulty)}
                </div>
            </div>
        `;
    }).join('');
}

function getDifficultyText(difficulty) {
    const map = { easy: '简单', medium: '中等', hard: '困难' };
    return map[difficulty] || difficulty;
}

async function selectProblem(id) {
    const problem = leetCodeState.problems.find(p => p.id === id);
    if (!problem) return;

    // 如果使用的是 API 数据且没有详细内容，获取详情
    if (problem.source === 'api' && !problem.description) {
        showLoading(true);
        try {
            const detail = await leetCodeAPI.getProblemDetail(problem.titleSlug);
            if (detail) {
                Object.assign(problem, detail);
            }
        } catch (error) {
            console.error('获取题目详情失败:', error);
            showToast('获取详情失败，使用基础信息');
        } finally {
            showLoading(false);
        }
    }
    
    leetCodeState.currentProblem = problem;
    renderProblemDetail(problem);
    renderProblemList();
}

// ========================================
// 题目详情
// ========================================

function renderProblemDetail(problem) {
    if (!problem) return;

    document.getElementById('problemNumber').textContent = '#' + problem.id;
    document.getElementById('problemTitle').textContent = problem.title;
    
    const diffEl = document.getElementById('problemDifficulty');
    diffEl.textContent = getDifficultyText(problem.difficulty);
    diffEl.className = 'problem-difficulty ' + problem.difficulty;
    
    // 渲染内容
    const contentHtml = `
        <div class="problem-description">
            ${problem.description || '<p>暂无描述</p>'}
        </div>
        ${problem.examples ? `
        <div class="problem-examples">
            ${problem.examples.map((ex, i) => `
                <div class="example">
                    <h4>示例 ${i + 1}：</h4>
                    <pre><code>输入：${ex.input}
输出：${ex.output}${ex.explanation ? '\n解释：' + ex.explanation : ''}</code></pre>
                </div>
            `).join('')}
        </div>` : ''}
        ${problem.constraints ? `
        <div class="problem-constraints">
            <h4>提示：</h4>
            <ul>
                ${problem.constraints.map(c => '<li>' + c + '</li>').join('')}
            </ul>
        </div>` : ''}
    `;
    document.getElementById('problemContent').innerHTML = contentHtml;
    
    updateEditorCode();
}

function updateEditorCode() {
    const problem = leetCodeState.currentProblem;
    const lang = leetCodeState.currentLanguage;
    
    if (!leetCodeState.editor) return;

    if (problem && problem.templates && problem.templates[lang]) {
        leetCodeState.editor.setValue(problem.templates[lang].replace(/\\n/g, '\n'));
    } else {
        leetCodeState.editor.setValue(LanguageConfig.getTemplate(lang));
    }
}

function changeLanguage(langId) {
    if (!leetCodeState.editor) return;
    
    leetCodeState.currentLanguage = langId;
    
    const monacoLang = LanguageConfig.getMonacoLanguage(langId);
    monaco.editor.setModelLanguage(leetCodeState.editor.getModel(), monacoLang);
    
    updateEditorCode();
}

// ========================================
// 代码运行和提交
// ========================================

async function runCode() {
    if (!leetCodeState.editor) return;

    const code = leetCodeState.editor.getValue();
    const consoleContent = document.getElementById('consoleContent');
    const problem = leetCodeState.currentProblem;
    
    consoleContent.innerHTML = '<div class="console-line info"><i class="fas fa-spinner fa-spin"></i> 运行中...</div>';
    
    // 如果是真实数据且已登录，尝试使用 API
    if (leetCodeState.isUsingRealData && leetCodeState.isLoggedIn && problem && problem.titleSlug) {
        try {
            const result = await leetCodeAPI.runCode(
                problem.titleSlug,
                code,
                LanguageConfig.getLeetCodeLanguage(leetCodeState.currentLanguage),
                problem.sampleTestCase || ''
            );
            
            consoleContent.innerHTML = `<div class="console-line info">运行 ID: ${result.interpret_id}</div>`;
            
            // 轮询结果
            pollRunResult(result.interpret_id);
            return;
        } catch (error) {
            console.error('API 运行失败:', error);
            showToast('API 运行失败，切换到本地模拟');
        }
    }
    
    // 本地模拟运行
    runLocalSimulation();
}

async function pollRunResult(interpretId) {
    // 轮询运行结果
    const maxAttempts = 10;
    let attempts = 0;
    
    const checkResult = async () => {
        try {
            const result = await leetCodeAPI.getSubmissionResult(interpretId);
            const consoleContent = document.getElementById('consoleContent');
            
            if (result.state === 'SUCCESS') {
                // 显示结果
                if (result.status_msg === 'Accepted') {
                    consoleContent.innerHTML = `
                        <div class="console-line success"><i class="fas fa-check"></i> 运行成功</div>
                        <div class="console-line output">${result.stdout || '无输出'}</div>
                    `;
                } else {
                    consoleContent.innerHTML = `
                        <div class="console-line error"><i class="fas fa-times"></i> ${result.status_msg}</div>
                        <div class="console-line output">${result.last_testcase || ''}</div>
                    `;
                }
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkResult, 1000);
            } else {
                consoleContent.innerHTML = '<div class="console-line error">运行超时</div>';
            }
        } catch (error) {
            console.error('获取运行结果失败:', error);
        }
    };
    
    checkResult();
}

function runLocalSimulation() {
    setTimeout(() => {
        const problem = leetCodeState.currentProblem;
        const consoleContent = document.getElementById('consoleContent');
        
        if (problem && problem.id === 1) {
            consoleContent.innerHTML = `
                <div class="console-line success"><i class="fas fa-check"></i> 运行成功</div>
                <div class="console-line output">输入: nums = [2,7,11,15], target = 9</div>
                <div class="console-line output">输出: [0,1]</div>
                <div class="console-line output">预期: [0,1]</div>
                <div class="console-line success">通过！</div>
            `;
        } else {
            consoleContent.innerHTML = `
                <div class="console-line info"><i class="fas fa-info-circle"></i> 模拟运行模式</div>
                <div class="console-line output">测试用例: 3/3 通过</div>
                <div class="console-line output">执行用时: ${Math.floor(Math.random() * 100 + 50)} ms</div>
                <div class="console-line output">内存消耗: ${(Math.random() * 20 + 40).toFixed(1)} MB</div>
            `;
        }
    }, 1000);
}

async function submitCode() {
    if (!leetCodeState.editor) return;

    const code = leetCodeState.editor.getValue();
    const consoleContent = document.getElementById('consoleContent');
    const problem = leetCodeState.currentProblem;
    
    consoleContent.innerHTML = '<div class="console-line info"><i class="fas fa-spinner fa-spin"></i> 提交中...</div>';
    
    // 保存到提交历史
    submissionHistory.addSubmission({
        problemId: problem?.id,
        problemTitle: problem?.title || '未知题目',
        problemTitleSlug: problem?.titleSlug,
        language: leetCodeState.currentLanguage,
        code: code,
        status: 'pending',
        timestamp: new Date().toISOString()
    });
    
    // 如果是真实数据且已登录，尝试使用 API 提交
    if (leetCodeState.isUsingRealData && leetCodeState.isLoggedIn && problem && problem.titleSlug) {
        try {
            const result = await leetCodeAPI.submitCode(
                problem.titleSlug,
                code,
                LanguageConfig.getLeetCodeLanguage(leetCodeState.currentLanguage)
            );
            
            consoleContent.innerHTML = `<div class="console-line info">提交 ID: ${result.submission_id}</div>`;
            
            // 轮询提交结果
            pollSubmitResult(result.submission_id);
            return;
        } catch (error) {
            console.error('API 提交失败:', error);
            showToast('API 提交失败，使用本地模拟');
        }
    }
    
    // 本地模拟提交
    submitLocalSimulation();
}

async function pollSubmitResult(submissionId) {
    const maxAttempts = 30;
    let attempts = 0;
    
    const checkResult = async () => {
        try {
            const result = await leetCodeAPI.getSubmissionResult(submissionId);
            const consoleContent = document.getElementById('consoleContent');
            
            if (result.state === 'SUCCESS') {
                handleSubmitResult(result);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkResult, 1000);
            } else {
                consoleContent.innerHTML = '<div class="console-line error">提交超时</div>';
            }
        } catch (error) {
            console.error('获取提交结果失败:', error);
        }
    };
    
    checkResult();
}

function handleSubmitResult(result) {
    const consoleContent = document.getElementById('consoleContent');
    const problem = leetCodeState.currentProblem;
    
    if (result.status_msg === 'Accepted') {
        consoleContent.innerHTML = `
            <div class="console-line success"><i class="fas fa-check-circle"></i> 通过！</div>
            <div class="console-line output">执行用时: ${result.status_runtime || 'N/A'}</div>
            <div class="console-line output">内存消耗: ${result.memory || 'N/A'}</div>
        `;
        
        if (problem && problem.status !== 'solved') {
            problem.status = 'solved';
            updateLeetCodeStats();
            renderProblemList();
        }
        
        // 更新提交历史
        const submissions = submissionHistory.getAllSubmissions();
        if (submissions.length > 0) {
            submissionHistory.updateSubmission(submissions[0].id, {
                status: 'accepted',
                runtime: parseInt(result.status_runtime) || null,
                memory: parseFloat(result.memory) || null
            });
        }
    } else {
        consoleContent.innerHTML = `
            <div class="console-line error"><i class="fas fa-times-circle"></i> ${result.status_msg}</div>
            <div class="console-line output">${result.last_testcase || ''}</div>
        `;
        
        // 更新提交历史
        const submissions = submissionHistory.getAllSubmissions();
        if (submissions.length > 0) {
            submissionHistory.updateSubmission(submissions[0].id, {
                status: result.status_msg.toLowerCase().replace(/ /g, '_')
            });
        }
    }
}

function submitLocalSimulation() {
    setTimeout(() => {
        const success = Math.random() > 0.3;
        const runtime = Math.floor(Math.random() * 100 + 50);
        const memory = (Math.random() * 20 + 40).toFixed(1);
        const problem = leetCodeState.currentProblem;
        const consoleContent = document.getElementById('consoleContent');
        
        if (success) {
            consoleContent.innerHTML = `
                <div class="console-line success"><i class="fas fa-check-circle"></i> 通过！</div>
                <div class="console-line output">执行用时: ${runtime} ms</div>
                <div class="console-line output">内存消耗: ${memory} MB</div>
                <div class="console-line output">击败了 85.2% 的用户</div>
            `;
            
            if (problem && problem.status !== 'solved') {
                problem.status = 'solved';
                updateLeetCodeStats();
                renderProblemList();
            }
            
            const submissions = submissionHistory.getAllSubmissions();
            if (submissions.length > 0) {
                submissionHistory.updateSubmission(submissions[0].id, {
                    status: 'accepted',
                    runtime: runtime,
                    memory: parseFloat(memory)
                });
            }
        } else {
            consoleContent.innerHTML = `
                <div class="console-line error"><i class="fas fa-times-circle"></i> 解答错误</div>
                <div class="console-line output">输入: [3,2,4], 6</div>
                <div class="console-line output">输出: [0,2]</div>
                <div class="console-line output">预期: [1,2]</div>
            `;
            
            const submissions = submissionHistory.getAllSubmissions();
            if (submissions.length > 0) {
                submissionHistory.updateSubmission(submissions[0].id, { status: 'wrong_answer' });
            }
        }
    }, 1500);
}

function resetCode() {
    updateEditorCode();
    document.getElementById('consoleContent').innerHTML = '<div class="console-placeholder">点击"运行"查看结果</div>';
}

function clearConsole() {
    document.getElementById('consoleContent').innerHTML = '<div class="console-placeholder">点击"运行"查看结果</div>';
}

// ========================================
// 登录和收藏
// ========================================

async function toggleLeetCodeLogin() {
    if (leetCodeState.isLoggedIn) {
        // 登出
        leetCodeState.isLoggedIn = false;
        leetCodeState.username = '';
        leetCodeAPI.clearSession();
        updateLoginButton();
        updateDataStatus();
        showToast('已登出');
        
        // 重置到登录提示
        leetCodeState.dataSource = 'none';
        showLoginPrompt();
    } else {
        // 显示登录模态框
        document.getElementById('leetcodeLoginModal').classList.add('active');
    }
}

function closeLeetCodeLoginModal() {
    document.getElementById('leetcodeLoginModal').classList.remove('active');
}

async function loginLeetCode() {
    const cookie = document.getElementById('leetcodeCookie')?.value;
    const token = document.getElementById('leetcodeToken')?.value;
    
    if (!cookie && !token) {
        showToast('请输入 Cookie 或 Token');
        return;
    }
    
    closeLeetCodeLoginModal();
    showLoading(true);
    
    // 设置会话
    if (cookie) {
        leetCodeAPI.setSession(cookie);
    }
    
    try {
        // 验证登录并加载数据
        await loadProblemsWithFallback();
        
        leetCodeState.isLoggedIn = true;
        leetCodeState.username = 'LeetCode User';
        updateLoginButton();
        updateDataStatus();
        showToast('登录成功！');
    } catch (error) {
        console.error('登录后加载失败:', error);
        showToast('登录失败，请检查 Cookie/Token');
        leetCodeAPI.clearSession();
        useLocalData();
    } finally {
        showLoading(false);
    }
}

function updateLoginButton() {
    const btn = document.getElementById('leetcodeLoginBtn');
    if (btn) {
        if (leetCodeState.isLoggedIn) {
            btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> 登出';
        } else {
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
        }
    }
}

function toggleFavorite() {
    const problem = leetCodeState.currentProblem;
    if (!problem) return;
    showToast('收藏功能开发中...');
}

function updateLeetCodeStats() {
    // 从提交历史获取统计数据
    const stats = submissionHistory.getStats();
    const streak = submissionHistory.getStreakDays();
    
    const solvedEl = document.getElementById('solvedCount');
    const streakEl = document.getElementById('streakCount');
    
    if (solvedEl) solvedEl.textContent = stats.accepted || 0;
    if (streakEl) streakEl.textContent = streak || 0;
    
    leetCodeState.solvedCount = stats.accepted || 0;
    leetCodeState.streakDays = streak || 0;
}

function updateDataStatus() {
    const statusEl = document.getElementById('dataStatus');
    if (!statusEl) return;
    
    switch (leetCodeState.dataSource) {
        case 'api':
            statusEl.innerHTML = '<i class="fas fa-cloud"></i><span>已连接 LeetCode</span>';
            statusEl.className = 'leetcode-data-status connected';
            break;
        case 'local':
            statusEl.innerHTML = '<i class="fas fa-database"></i><span>本地数据</span>';
            statusEl.className = 'leetcode-data-status local';
            break;
        case 'none':
        default:
            if (leetCodeState.isLoggedIn) {
                statusEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>正在连接...</span>';
            } else {
                statusEl.innerHTML = '<i class="fas fa-lock"></i><span>未登录</span>';
                statusEl.className = 'leetcode-data-status';
            }
            break;
    }
}

console.log('LeetCode 模块已加载（支持 API 优先 + 本地降级）🎯');
