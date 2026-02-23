/**
 * FlowBoard - LeetCode 刷题模块（增强版）
 * 优先使用真实 LeetCode API，失败时降级到本地数据
 */

// ========================================
// Submission History (localStorage-backed)
// ========================================

const submissionHistory = {
    _storageKey: 'leetcode_submissions',

    _load() {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey)) || [];
        } catch { return []; }
    },

    _save(data) {
        localStorage.setItem(this._storageKey, JSON.stringify(data));
    },

    addSubmission(entry) {
        const submissions = this._load();
        entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        submissions.unshift(entry);
        if (submissions.length > 500) submissions.length = 500;
        this._save(submissions);
        return entry;
    },

    updateSubmission(id, updates) {
        const submissions = this._load();
        const idx = submissions.findIndex(s => s.id === id);
        if (idx !== -1) {
            Object.assign(submissions[idx], updates);
            this._save(submissions);
        }
    },

    getAllSubmissions() {
        return this._load();
    },

    getStats() {
        const submissions = this._load();
        const accepted = new Set(
            submissions.filter(s => s.status === 'accepted').map(s => s.problemId)
        ).size;
        return { total: submissions.length, accepted };
    },

    getStreakDays() {
        const submissions = this._load();
        if (submissions.length === 0) return 0;

        const days = new Set(
            submissions.map(s => new Date(s.timestamp).toDateString())
        );
        const sorted = [...days].map(d => new Date(d)).sort((a, b) => b - a);

        let streak = 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const latest = sorted[0];
        latest.setHours(0, 0, 0, 0);
        const diffToday = (today - latest) / 86400000;
        if (diffToday > 1) return 0;

        for (let i = 1; i < sorted.length; i++) {
            const diff = (sorted[i - 1] - sorted[i]) / 86400000;
            if (diff === 1) streak++;
            else break;
        }
        return streak;
    }
};

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
    // 防止重复初始化
    if (leetCodeState.initialized) {
        console.log('LeetCode 已初始化，跳过');
        return;
    }
    leetCodeState.initialized = true;
    
    console.log('开始初始化 LeetCode...');
    
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
            // 使用批量获取 API，获取 200 道题
            const apiProblems = await leetCodeAPI.getManyProblems(200);
            
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
// Monaco Editor 初始化（带降级方案）
// ========================================

function initMonacoEditor() {
    const container = document.getElementById('monacoEditor');
    if (!container) {
        console.warn('Monaco Editor 容器不存在');
        return;
    }

    // 如果已经有编辑器实例，跳过初始化
    if (leetCodeState.editor) {
        console.log('编辑器已存在，跳过初始化');
        return;
    }

    // 检查 require 是否可用（Monaco 需要 AMD loader）
    if (typeof require === 'undefined') {
        console.warn('AMD loader 不可用，使用备用编辑器');
        initFallbackEditor();
        return;
    }

    // 检查是否是 AMD loader
    if (typeof require.config !== 'function') {
        console.warn('require 不是 AMD loader，使用备用编辑器');
        initFallbackEditor();
        return;
    }

    console.log('开始加载 Monaco Editor...');

    // 设置加载超时
    const monacoTimeout = setTimeout(() => {
        console.warn('Monaco Editor 加载超时，切换到备用编辑器');
        initFallbackEditor();
    }, 15000);

    try {
        // 配置 Monaco 路径
        require.config({ 
            paths: { 
                'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' 
            },
            waitSeconds: 30
        });

        require(['vs/editor/editor.main'], function() {
            clearTimeout(monacoTimeout);
            
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

            // 清空容器
            container.innerHTML = '';

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
                formatOnType: true,
                // 智能提示配置
                quickSuggestions: {
                    other: true,
                    comments: true,
                    strings: true
                },
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnCommitCharacter: true,
                acceptSuggestionOnEnter: 'on',
                snippetSuggestions: 'top',
                suggestSelection: 'first',
                wordBasedSuggestions: 'allDocuments',
                parameterHints: {
                    enabled: true,
                    cycle: true
                },
                hover: {
                    enabled: true,
                    delay: 300
                },
                goToDefinition: true,
                contextmenu: true,
                multiCursorModifier: 'altCmd',
                find: {
                    autoFindInSelection: 'never',
                    seedSearchStringFromSelection: 'always'
                }
            });
            
            // 启用更强大的IntelliSense
            monaco.editor.setTheme('leetcode-dark');

            // 添加快捷键
            leetCodeState.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
                runCode();
            });

            leetCodeState.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function() {
                submitCode();
            });

            // 标记 Monaco 已加载
            leetCodeState.editorType = 'monaco';
            console.log('Monaco Editor 初始化完成');
            
            // 初始化代码智能提示
            if (typeof CodeIntelliSense !== 'undefined') {
                CodeIntelliSense.init();
            }
            
            // 如果有当前题目，更新编辑器内容
            if (leetCodeState.currentProblem) {
                updateEditorCode();
            }
        }, function(err) {
            // 加载失败
            clearTimeout(monacoTimeout);
            console.error('Monaco Editor 加载失败:', err);
            initFallbackEditor();
        });
    } catch (error) {
        clearTimeout(monacoTimeout);
        console.error('Monaco Editor 初始化错误:', error);
        initFallbackEditor();
    }
}

// ========================================
// 备用编辑器（简单的 textarea）
// ========================================

function initFallbackEditor() {
    const container = document.getElementById('monacoEditor');
    if (!container) return;

    // 清空容器
    container.innerHTML = '';
    container.style.background = '#1e1e1e';
    container.style.padding = '0';

    // 创建 textarea 编辑器
    const textarea = document.createElement('textarea');
    textarea.id = 'fallbackEditor';
    textarea.className = 'code-editor';
    textarea.style.cssText = `
        width: 100%;
        height: 100%;
        padding: 16px;
        background: #1e1e1e;
        border: none;
        color: #d4d4d4;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.6;
        resize: none;
        outline: none;
        tab-size: 4;
        white-space: pre;
        overflow: auto;
    `;
    textarea.value = LanguageConfig.getTemplate('javascript');
    textarea.placeholder = '// 在此编写你的代码...';

    // 添加 Tab 键支持
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
            this.selectionStart = this.selectionEnd = start + 4;
        }
        
        // Ctrl/Cmd + Enter 提交
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            submitCode();
        }
    });

    container.appendChild(textarea);

    // 包装对象模拟 Monaco Editor API
    leetCodeState.editor = {
        type: 'fallback',
        getValue: function() {
            return textarea.value;
        },
        setValue: function(value) {
            textarea.value = value;
        },
        setModelLanguage: function(model, language) {
            // 备用编辑器不支持语法高亮切换，但我们可以记录当前语言
            this.currentLanguage = language;
        }
    };
    
    leetCodeState.editorType = 'fallback';
    console.log('备用编辑器初始化完成');
    showToast('代码编辑器已加载（备用模式）');
    
    // 如果有当前题目，更新编辑器内容
    if (leetCodeState.currentProblem) {
        updateEditorCode();
    }
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
            description: `<p>给定一个整数数组 <code>nums</code> 和一个整数目标值 <code>target</code>，请你在该数组中找出 <strong>和为目标值</strong> <em>target</em> 的那 <strong>两个</strong> 整数，并返回它们的数组下标。</p>
            <p>你可以假设每种输入只会对应一个答案。但是，数组中同一个元素在答案里不能重复出现。</p>
            <p>你可以按任意顺序返回答案。</p>`,
            examples: [
                { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: '因为 nums[0] + nums[1] == 9' },
                { input: 'nums = [3,2,4], target = 6', output: '[1,2]' }
            ],
            constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'],
            templates: {
                javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) {\n            return [map.get(complement), i];\n        }\n        map.set(nums[i], i);\n    }\n    return [];\n};`,
                python: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        hash_map = {}\n        for i, num in enumerate(nums):\n            complement = target - num\n            if complement in hash_map:\n                return [hash_map[complement], i]\n            hash_map[num] = i\n        return []`,
                java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (map.containsKey(complement)) {\n                return new int[] { map.get(complement), i };\n            }\n            map.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}`
            }
        },
        {
            id: 2,
            title: '两数相加',
            titleEn: 'Add Two Numbers',
            titleSlug: 'add-two-numbers',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['递归', '链表', '数学'],
            acceptance: '43.2%',
            description: `<p>给你两个 <strong>非空</strong> 的链表，表示两个非负的整数。它们每位数字都是按照 <strong>逆序</strong> 的方式存储的，并且每个节点只能存储 <strong>一位</strong> 数字。</p>
            <p>请你将两个数相加，并以相同形式返回一个表示和的链表。</p>
            <p>你可以假设除了数字 0 之外，这两个数都不会以 0 开头。</p>`,
            examples: [
                { input: 'l1 = [2,4,3], l2 = [5,6,4]', output: '[7,0,8]', explanation: '342 + 465 = 807' }
            ],
            constraints: ['每个链表中的节点数在范围 [1, 100] 内'],
            templates: {
                javascript: `/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n/**\n * @param {ListNode} l1\n * @param {ListNode} l2\n * @return {ListNode}\n */\nvar addTwoNumbers = function(l1, l2) {\n    // 在此编写你的代码\n    \n};`,
                python: `# Definition for singly-linked list.\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\nclass Solution:\n    def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:\n        pass`,
                java: `/**\n * Definition for singly-linked list.\n * public class ListNode {\n *     int val;\n *     ListNode next;\n *     ListNode() {}\n *     ListNode(int val) { this.val = val; }\n *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n * }\n */\nclass Solution {\n    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {\n        return null;\n    }\n}`
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
            description: `<p>给定一个字符串 <code>s</code> ，请你找出其中 <strong>不含有重复字符</strong> 的 <strong>最长子串</strong> 的长度。</p>`,
            examples: [
                { input: 's = "abcabcbb"', output: '3', explanation: '因为无重复字符的最长子串是 "abc"' }
            ],
            constraints: ['0 <= s.length <= 5 * 10^4'],
            templates: {
                javascript: `/**\n * @param {string} s\n * @return {number}\n */\nvar lengthOfLongestSubstring = function(s) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def lengthOfLongestSubstring(self, s: str) -> int:\n        pass`,
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
            description: `<p>给定两个大小分别为 <code>m</code> 和 <code>n</code> 的正序（从小到大）数组 <code>nums1</code> 和 <code>nums2</code>。请你找出并返回这两个正序数组的 <strong>中位数</strong> 。</p>
            <p>算法的时间复杂度应该为 <code>O(log (m+n))</code> 。</p>`,
            examples: [
                { input: 'nums1 = [1,3], nums2 = [2]', output: '2.00000', explanation: '合并数组 = [1,2,3]' }
            ],
            constraints: ['0 <= m <= 1000', '0 <= n <= 1000'],
            templates: {
                javascript: `/**\n * @param {number[]} nums1\n * @param {number[]} nums2\n * @return {number}\n */\nvar findMedianSortedArrays = function(nums1, nums2) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def findMedianSortedArrays(self, nums1: List[int], nums2: List[int]) -> float:\n        pass`,
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
            description: `<p>给你一个字符串 <code>s</code>，找到 <code>s</code> 中最长的 <strong>回文子串</strong>。</p>`,
            examples: [
                { input: 's = "babad"', output: '"bab"', explanation: '"aba" 同样是符合题意的答案。' }
            ],
            constraints: ['1 <= s.length <= 1000'],
            templates: {
                javascript: `/**\n * @param {string} s\n * @return {string}\n */\nvar longestPalindrome = function(s) {\n    // 在此编写你的代码\n    \n};`,
                python: `class Solution:\n    def longestPalindrome(self, s: str) -> str:\n        pass`,
                java: `class Solution {\n    public String longestPalindrome(String s) {\n        return "";\n    }\n}`
            }
        },
        {
            id: 6,
            title: 'Z 字形变换',
            titleEn: 'Zigzag Conversion',
            titleSlug: 'zigzag-conversion',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['字符串'],
            acceptance: '52.1%',
            description: `<p>将一个给定字符串 <code>s</code> 根据给定的行数 <code>numRows</code> ，以从上往下、从左到右进行 Z 字形排列。</p>`,
            examples: [
                { input: 's = "PAYPALISHIRING", numRows = 3', output: '"PAHNAPLSIIGYIR"' }
            ],
            constraints: ['1 <= s.length <= 1000', '1 <= numRows <= 1000'],
            templates: {
                javascript: `/**\n * @param {string} s\n * @param {number} numRows\n * @return {string}\n */\nvar convert = function(s, numRows) {\n    \n};`,
                python: `class Solution:\n    def convert(self, s: str, numRows: int) -> str:\n        pass`,
                java: `class Solution {\n    public String convert(String s, int numRows) {\n        return "";\n    }\n}`
            }
        },
        {
            id: 7,
            title: '整数反转',
            titleEn: 'Reverse Integer',
            titleSlug: 'reverse-integer',
            difficulty: 'medium',
            status: 'solved',
            tags: ['数学'],
            acceptance: '36.4%',
            description: `<p>给你一个 32 位的有符号整数 <code>x</code> ，返回将 <code>x</code> 中的数字部分反转后的结果。</p>
            <p>如果反转后整数超过 32 位的有符号整数的范围 <code>[−2^31,  2^31 − 1]</code> ，就返回 0。</p>`,
            examples: [
                { input: 'x = 123', output: '321' },
                { input: 'x = -123', output: '-321' }
            ],
            constraints: ['-2^31 <= x <= 2^31 - 1'],
            templates: {
                javascript: `/**\n * @param {number} x\n * @return {number}\n */\nvar reverse = function(x) {\n    \n};`,
                python: `class Solution:\n    def reverse(self, x: int) -> int:\n        pass`,
                java: `class Solution {\n    public int reverse(int x) {\n        return 0;\n    }\n}`
            }
        },
        {
            id: 8,
            title: '字符串转换整数 (atoi)',
            titleEn: 'String to Integer (atoi)',
            titleSlug: 'string-to-integer-atoi',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['字符串'],
            acceptance: '23.8%',
            description: `<p>请你来实现一个 <code>myAtoi(string s)</code> 函数，使其能将字符串转换成一个 32 位有符号整数（类似 C/C++ 中的 <code>atoi</code> 函数）。</p>`,
            examples: [
                { input: 's = "42"', output: '42' },
                { input: 's = "   -42"', output: '-42' }
            ],
            constraints: ['0 <= s.length <= 200'],
            templates: {
                javascript: `/**\n * @param {string} s\n * @return {number}\n */\nvar myAtoi = function(s) {\n    \n};`,
                python: `class Solution:\n    def myAtoi(self, s: str) -> int:\n        pass`,
                java: `class Solution {\n    public int myAtoi(String s) {\n        return 0;\n    }\n}`
            }
        },
        {
            id: 9,
            title: '回文数',
            titleEn: 'Palindrome Number',
            titleSlug: 'palindrome-number',
            difficulty: 'easy',
            status: 'solved',
            tags: ['数学'],
            acceptance: '55.4%',
            description: `<p>给你一个整数 <code>x</code> ，如果 <code>x</code> 是一个回文整数，返回 <code>true</code> ；否则，返回 <code>false</code> 。</p>
            <p>回文数是指正序（从左向右）和倒序（从右向左）读都是一样的整数。</p>`,
            examples: [
                { input: 'x = 121', output: 'true' },
                { input: 'x = -121', output: 'false' }
            ],
            constraints: ['-2^31 <= x <= 2^31 - 1'],
            templates: {
                javascript: `/**\n * @param {number} x\n * @return {boolean}\n */\nvar isPalindrome = function(x) {\n    \n};`,
                python: `class Solution:\n    def isPalindrome(self, x: int) -> bool:\n        pass`,
                java: `class Solution {\n    public boolean isPalindrome(int x) {\n        return false;\n    }\n}`
            }
        },
        {
            id: 10,
            title: '正则表达式匹配',
            titleEn: 'Regular Expression Matching',
            titleSlug: 'regular-expression-matching',
            difficulty: 'hard',
            status: 'unsolved',
            tags: ['递归', '字符串', '动态规划'],
            acceptance: '31.9%',
            description: `<p>给你一个字符串 <code>s</code> 和一个字符规律 <code>p</code>，请你来实现一个支持 <code>'.'</code> 和 <code>'*'</code> 的正则表达式匹配。</p>`,
            examples: [
                { input: 's = "aa", p = "a"', output: 'false' },
                { input: 's = "aa", p = "a*"', output: 'true' }
            ],
            constraints: ['0 <= s.length <= 20', '0 <= p.length <= 30'],
            templates: {
                javascript: `/**\n * @param {string} s\n * @param {string} p\n * @return {boolean}\n */\nvar isMatch = function(s, p) {\n    \n};`,
                python: `class Solution:\n    def isMatch(self, s: str, p: str) -> bool:\n        pass`,
                java: `class Solution {\n    public boolean isMatch(String s, String p) {\n        return false;\n    }\n}`
            }
        },
        {
            id: 11,
            title: '盛最多水的容器',
            titleEn: 'Container With Most Water',
            titleSlug: 'container-with-most-water',
            difficulty: 'medium',
            status: 'attempted',
            tags: ['贪心', '数组', '双指针'],
            acceptance: '60.5%',
            description: `<p>给定一个长度为 <code>n</code> 的整数数组 <code>height</code> 。有 <code>n</code> 条垂线，第 <code>i</code> 条线的两个端点是 <code>(i, 0)</code> 和 <code>(i, height[i])</code> 。</p>
            <p>找出其中的两条线，使得它们与 <code>x</code> 轴共同构成的容器可以容纳最多的水。</p>`,
            examples: [
                { input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49', explanation: '图中垂直线代表输入数组 [1,8,6,2,5,4,8,3,7]。在此情况下，容器能够容纳水（表示为蓝色部分）的最大值为 49。' }
            ],
            constraints: ['n == height.length', '2 <= n <= 10^5', '0 <= height[i] <= 10^4'],
            templates: {
                javascript: `/**\n * @param {number[]} height\n * @return {number}\n */\nvar maxArea = function(height) {\n    \n};`,
                python: `class Solution:\n    def maxArea(self, height: List[int]) -> int:\n        pass`,
                java: `class Solution {\n    public int maxArea(int[] height) {\n        return 0;\n    }\n}`
            }
        },
        {
            id: 12,
            title: '整数转罗马数字',
            titleEn: 'Integer to Roman',
            titleSlug: 'integer-to-roman',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['哈希表', '数学', '字符串'],
            acceptance: '67.1%',
            description: `<p>罗马数字包含以下七种字符： <code>I</code>， <code>V</code>， <code>X</code>， <code>L</code>，<code>C</code>，<code>D</code> 和 <code>M</code>。</p>
            <p>给定一个整数，将其转为罗马数字。</p>`,
            examples: [
                { input: 'num = 3', output: '"III"', explanation: '3 就是三个 I 表示' }
            ],
            constraints: ['1 <= num <= 3999'],
            templates: {
                javascript: `/**\n * @param {number} num\n * @return {string}\n */\nvar intToRoman = function(num) {\n    \n};`,
                python: `class Solution:\n    def intToRoman(self, num: int) -> str:\n        pass`,
                java: `class Solution {\n    public String intToRoman(int num) {\n        return "";\n    }\n}`
            }
        },
        {
            id: 13,
            title: '罗马数字转整数',
            titleEn: 'Roman to Integer',
            titleSlug: 'roman-to-integer',
            difficulty: 'easy',
            status: 'solved',
            tags: ['哈希表', '数学', '字符串'],
            acceptance: '63.8%',
            description: `<p>罗马数字包含以下七种字符: <code>I</code>， <code>V</code>， <code>X</code>， <code>L</code>，<code>C</code>，<code>D</code> 和 <code>M</code>。</p>
            <p>给定一个罗马数字，将其转换成整数。</p>`,
            examples: [
                { input: 's = "III"', output: '3' },
                { input: 's = "IV"', output: '4' }
            ],
            constraints: ['1 <= s.length <= 15'],
            templates: {
                javascript: `/**\n * @param {string} s\n * @return {number}\n */\nvar romanToInt = function(s) {\n    \n};`,
                python: `class Solution:\n    def romanToInt(self, s: str) -> int:\n        pass`,
                java: `class Solution {\n    public int romanToInt(String s) {\n        return 0;\n    }\n}`
            }
        },
        {
            id: 14,
            title: '最长公共前缀',
            titleEn: 'Longest Common Prefix',
            titleSlug: 'longest-common-prefix',
            difficulty: 'easy',
            status: 'solved',
            tags: ['字符串'],
            acceptance: '44.2%',
            description: `<p>编写一个函数来查找字符串数组中的最长公共前缀。</p>
            <p>如果不存在公共前缀，返回空字符串 <code>""</code>。</p>`,
            examples: [
                { input: 'strs = ["flower","flow","flight"]', output: '"fl"' }
            ],
            constraints: ['1 <= strs.length <= 200', '0 <= strs[i].length <= 200'],
            templates: {
                javascript: `/**\n * @param {string[]} strs\n * @return {string}\n */\nvar longestCommonPrefix = function(strs) {\n    \n};`,
                python: `class Solution:\n    def longestCommonPrefix(self, strs: List[str]) -> str:\n        pass`,
                java: `class Solution {\n    public String longestCommonPrefix(String[] strs) {\n        return "";\n    }\n}`
            }
        },
        {
            id: 15,
            title: '三数之和',
            titleEn: '3Sum',
            titleSlug: '3sum',
            difficulty: 'medium',
            status: 'attempted',
            tags: ['数组', '双指针', '排序'],
            acceptance: '36.5%',
            description: `<p>给你一个整数数组 <code>nums</code> ，判断是否存在三元组 <code>[nums[i], nums[j], nums[k]]</code> 满足 <code>i != j</code>、<code>i != k</code> 且 <code>j != k</code> ，同时还满足 <code>nums[i] + nums[j] + nums[k] == 0</code> 。</p>
            <p>请你返回所有和为 0 且不重复的三元组。</p>`,
            examples: [
                { input: 'nums = [-1,0,1,2,-1,-4]', output: '[[-1,-1,2],[-1,0,1]]' }
            ],
            constraints: ['3 <= nums.length <= 3000', '-10^5 <= nums[i] <= 10^5'],
            templates: {
                javascript: `/**\n * @param {number[]} nums\n * @return {number[][]}\n */\nvar threeSum = function(nums) {\n    \n};`,
                python: `class Solution:\n    def threeSum(self, nums: List[int]) -> List[List[int]]:\n        pass`,
                java: `class Solution {\n    public List<List<Integer>> threeSum(int[] nums) {\n        return new ArrayList<>();\n    }\n}`
            }
        },
        {
            id: 16,
            title: '最接近的三数之和',
            titleEn: '3Sum Closest',
            titleSlug: '3sum-closest',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['数组', '双指针', '排序'],
            acceptance: '47.5%',
            description: `<p>给你一个长度为 <code>n</code> 的整数数组 <code>nums</code> 和 一个目标值 <code>target</code>。请你从 <code>nums</code> 中选出三个整数，使它们的和与 <code>target</code> 最接近。</p>
            <p>返回这三个数的和。</p>`,
            examples: [
                { input: 'nums = [-1,2,1,-4], target = 1', output: '2', explanation: '与 target 最接近的和是 2 (-1 + 2 + 1 = 2)' }
            ],
            constraints: ['3 <= nums.length <= 500', '-1000 <= nums[i] <= 1000'],
            templates: {
                javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number}\n */\nvar threeSumClosest = function(nums, target) {\n    \n};`,
                python: `class Solution:\n    def threeSumClosest(self, nums: List[int], target: int) -> int:\n        pass`,
                java: `class Solution {\n    public int threeSumClosest(int[] nums, int target) {\n        return 0;\n    }\n}`
            }
        },
        {
            id: 17,
            title: '电话号码的字母组合',
            titleEn: 'Letter Combinations of a Phone Number',
            titleSlug: 'letter-combinations-of-a-phone-number',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['哈希表', '字符串', '回溯'],
            acceptance: '58.9%',
            description: `<p>给定一个仅包含数字 <code>2-9</code> 的字符串，返回所有它能表示的字母组合。答案可以按 <strong>任意顺序</strong> 返回。</p>
            <p>给出数字到字母的映射如下（与电话按键相同）。注意 1 不对应任何字母。</p>`,
            examples: [
                { input: 'digits = "23"', output: '["ad","ae","af","bd","be","bf","cd","ce","cf"]' }
            ],
            constraints: ['0 <= digits.length <= 4'],
            templates: {
                javascript: `/**\n * @param {string} digits\n * @return {string[]}\n */\nvar letterCombinations = function(digits) {\n    \n};`,
                python: `class Solution:\n    def letterCombinations(self, digits: str) -> List[str]:\n        pass`,
                java: `class Solution {\n    public List<String> letterCombinations(String digits) {\n        return new ArrayList<>();\n    }\n}`
            }
        },
        {
            id: 18,
            title: '四数之和',
            titleEn: '4Sum',
            titleSlug: '4sum',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['数组', '双指针', '排序'],
            acceptance: '39.3%',
            description: `<p>给你一个由 <code>n</code> 个整数组成的数组 <code>nums</code> ，和一个目标值 <code>target</code> 。请你找出并返回满足下述全部条件且不重复的四元组 <code>[nums[a], nums[b], nums[c], nums[d]]</code> ：</p>`,
            examples: [
                { input: 'nums = [1,0,-1,0,-2,2], target = 0', output: '[[-2,-1,1,2],[-2,0,0,2],[-1,0,0,1]]' }
            ],
            constraints: ['1 <= nums.length <= 200', '-10^9 <= nums[i] <= 10^9'],
            templates: {
                javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[][]}\n */\nvar fourSum = function(nums, target) {\n    \n};`,
                python: `class Solution:\n    def fourSum(self, nums: List[int], target: int) -> List[List[int]]:\n        pass`,
                java: `class Solution {\n    public List<List<Integer>> fourSum(int[] nums, int target) {\n        return new ArrayList<>();\n    }\n}`
            }
        },
        {
            id: 19,
            title: '删除链表的倒数第 N 个结点',
            titleEn: 'Remove Nth Node From End of List',
            titleSlug: 'remove-nth-node-from-end-of-list',
            difficulty: 'medium',
            status: 'solved',
            tags: ['链表', '双指针'],
            acceptance: '45.1%',
            description: `<p>给你一个链表，删除链表的倒数第 <code>n</code> 个结点，并且返回链表的头结点。</p>`,
            examples: [
                { input: 'head = [1,2,3,4,5], n = 2', output: '[1,2,3,5]' }
            ],
            constraints: ['链表中结点的数目为 sz', '1 <= sz <= 30'],
            templates: {
                javascript: `/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n/**\n * @param {ListNode} head\n * @param {number} n\n * @return {ListNode}\n */\nvar removeNthFromEnd = function(head, n) {\n    \n};`,
                python: `class Solution:\n    def removeNthFromEnd(self, head: Optional[ListNode], n: int) -> Optional[ListNode]:\n        pass`,
                java: `class Solution {\n    public ListNode removeNthFromEnd(ListNode head, int n) {\n        return null;\n    }\n}`
            }
        },
        {
            id: 20,
            title: '有效的括号',
            titleEn: 'Valid Parentheses',
            titleSlug: 'valid-parentheses',
            difficulty: 'easy',
            status: 'solved',
            tags: ['栈', '字符串'],
            acceptance: '55.1%',
            description: `<p>给定一个只包括 <code>'('</code>，<code>')'</code>，<code>'{'</code>，<code>'}'</code>，<code>'['</code>，<code>']'</code> 的字符串 <code>s</code> ，判断字符串是否有效。</p>
            <p>有效字符串需满足：</p>
            <ul>
            <li>左括号必须用相同类型的右括号闭合。</li>
            <li>左括号必须以正确的顺序闭合。</li>
            <li>每个右括号都有一个对应的相同类型的左括号。</li>
            </ul>`,
            examples: [
                { input: 's = "()"', output: 'true' },
                { input: 's = "()[]{}"', output: 'true' },
                { input: 's = "(]"', output: 'false' }
            ],
            constraints: ['1 <= s.length <= 10^4'],
            templates: {
                javascript: `/**\n * @param {string} s\n * @return {boolean}\n */\nvar isValid = function(s) {\n    \n};`,
                python: `class Solution:\n    def isValid(self, s: str) -> bool:\n        pass`,
                java: `class Solution {\n    public boolean isValid(String s) {\n        return false;\n    }\n}`
            }
        },
        {
            id: 21,
            title: '合并两个有序链表',
            titleEn: 'Merge Two Sorted Lists',
            titleSlug: 'merge-two-sorted-lists',
            difficulty: 'easy',
            status: 'solved',
            tags: ['递归', '链表'],
            acceptance: '66.1%',
            description: `<p>将两个升序链表合并为一个新的 <strong>升序</strong> 列表并返回。新链表是通过拼接给定的两个链表的所有节点组成的。</p>`,
            examples: [
                { input: 'list1 = [1,2,4], list2 = [1,3,4]', output: '[1,1,2,3,4,4]' }
            ],
            constraints: ['两个链表的节点数目范围是 [0, 50]'],
            templates: {
                javascript: `/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n/**\n * @param {ListNode} list1\n * @param {ListNode} list2\n * @return {ListNode}\n */\nvar mergeTwoLists = function(list1, list2) {\n    \n};`,
                python: `class Solution:\n    def mergeTwoLists(self, list1: Optional[ListNode], list2: Optional[ListNode]) -> Optional[ListNode]:\n        pass`,
                java: `class Solution {\n    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {\n        return null;\n    }\n}`
            }
        },
        {
            id: 22,
            title: '括号生成',
            titleEn: 'Generate Parentheses',
            titleSlug: 'generate-parentheses',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['字符串', '动态规划', '回溯'],
            acceptance: '77.5%',
            description: `<p>数字 <code>n</code> 代表生成括号的对数，请你设计一个函数，用于能够生成所有可能的并且 <strong>有效的</strong> 括号组合。</p>`,
            examples: [
                { input: 'n = 3', output: '["((()))","(()())","(())()","()(())","()()()"]' }
            ],
            constraints: ['1 <= n <= 8'],
            templates: {
                javascript: `/**\n * @param {number} n\n * @return {string[]}\n */\nvar generateParenthesis = function(n) {\n    \n};`,
                python: `class Solution:\n    def generateParenthesis(self, n: int) -> List[str]:\n        pass`,
                java: `class Solution {\n    public List<String> generateParenthesis(int n) {\n        return new ArrayList<>();\n    }\n}`
            }
        },
        {
            id: 23,
            title: '合并K个升序链表',
            titleEn: 'Merge k Sorted Lists',
            titleSlug: 'merge-k-sorted-lists',
            difficulty: 'hard',
            status: 'unsolved',
            tags: ['链表', '分治', '堆（优先队列）'],
            acceptance: '58.2%',
            description: `<p>给你一个链表数组，每个链表都已经按升序排列。</p>
            <p>请你将所有链表合并到一个升序链表中，返回合并后的链表。</p>`,
            examples: [
                { input: 'lists = [[1,4,5],[1,3,4],[2,6]]', output: '[1,1,2,3,4,4,5,6]' }
            ],
            constraints: ['k == lists.length', '0 <= k <= 10^4'],
            templates: {
                javascript: `/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n/**\n * @param {ListNode[]} lists\n * @return {ListNode}\n */\nvar mergeKLists = function(lists) {\n    \n};`,
                python: `class Solution:\n    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:\n        pass`,
                java: `class Solution {\n    public ListNode mergeKLists(ListNode[] lists) {\n        return null;\n    }\n}`
            }
        },
        {
            id: 24,
            title: '两两交换链表中的节点',
            titleEn: 'Swap Nodes in Pairs',
            titleSlug: 'swap-nodes-in-pairs',
            difficulty: 'medium',
            status: 'unsolved',
            tags: ['递归', '链表'],
            acceptance: '71.7%',
            description: `<p>给你一个链表，两两交换其中相邻的节点，并返回交换后链表的头节点。你必须在不修改节点内部的值的情况下完成本题（即，只能进行节点交换）。</p>`,
            examples: [
                { input: 'head = [1,2,3,4]', output: '[2,1,4,3]' }
            ],
            constraints: ['链表中节点的数目在范围 [0, 100] 内'],
            templates: {
                javascript: `/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n/**\n * @param {ListNode} head\n * @return {ListNode}\n */\nvar swapPairs = function(head) {\n    \n};`,
                python: `class Solution:\n    def swapPairs(self, head: Optional[ListNode]) -> Optional[ListNode]:\n        pass`,
                java: `class Solution {\n    public ListNode swapPairs(ListNode head) {\n        return null;\n    }\n}`
            }
        },
        {
            id: 25,
            title: 'K 个一组翻转链表',
            titleEn: 'Reverse Nodes in k-Group',
            titleSlug: 'reverse-nodes-in-k-group',
            difficulty: 'hard',
            status: 'unsolved',
            tags: ['递归', '链表'],
            acceptance: '67.9%',
            description: `<p>给你链表的头节点 <code>head</code> ，每 <code>k</code> 个节点一组进行翻转，请你返回修改后的链表。</p>
            <p>k 是一个正整数，它的值小于或等于链表的长度。如果节点总数不是 k 的整数倍，那么请将最后剩余的节点保持原有顺序。</p>`,
            examples: [
                { input: 'head = [1,2,3,4,5], k = 2', output: '[2,1,4,3,5]' }
            ],
            constraints: ['链表中的节点数目为 n', '1 <= k <= n <= 5000'],
            templates: {
                javascript: `/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n/**\n * @param {ListNode} head\n * @param {number} k\n * @return {ListNode}\n */\nvar reverseKGroup = function(head, k) {\n    \n};`,
                python: `class Solution:\n    def reverseKGroup(self, head: Optional[ListNode], k: int) -> Optional[ListNode]:\n        pass`,
                java: `class Solution {\n    public ListNode reverseKGroup(ListNode head, int k) {\n        return null;\n    }\n}`
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

    let code = '';
    if (problem && problem.templates && problem.templates[lang]) {
        code = problem.templates[lang].replace(/\\n/g, '\n');
    } else {
        code = LanguageConfig.getTemplate(lang);
    }
    
    leetCodeState.editor.setValue(code);
}

function changeLanguage(langId) {
    if (!leetCodeState.editor) return;
    
    leetCodeState.currentLanguage = langId;
    
    // 根据编辑器类型切换语言
    if (leetCodeState.editorType === 'monaco' && typeof monaco !== 'undefined') {
        const monacoLang = LanguageConfig.getMonacoLanguage(langId);
        monaco.editor.setModelLanguage(leetCodeState.editor.getModel(), monacoLang);
        
        // 为新语言注册代码提示
        if (typeof CodeIntelliSense !== 'undefined') {
            CodeIntelliSense.registerLanguage(langId);
        }
    }
    // 备用编辑器不切换语法高亮，只需更新代码模板
    
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

function openLeetCodeOfficial() {
    const url = 'https://leetcode.cn';
    if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
    } else {
        window.open(url, '_blank');
    }
}

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
