/**
 * FlowBoard - 代码片段与智能提示配置
 * 为 Monaco Editor 提供代码补全和智能提示
 */

// ========================================
// 常用算法代码片段
// ========================================

const CodeSnippets = {
    // JavaScript/TypeScript 代码片段
    javascript: [
        {
            prefix: 'twosum',
            label: '两数之和 - 哈希表解法',
            detail: '使用哈希表在 O(n) 时间内解决两数之和问题',
            documentation: '两数之和的经典解法，使用哈希表存储已遍历的数字',
            insertText: `const map = new Map();
for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
        return [map.get(complement), i];
    }
    map.set(nums[i], i);
}
return [];`
        },
        {
            prefix: 'bfs',
            label: 'BFS 广度优先搜索',
            detail: '图的广度优先搜索模板',
            documentation: '使用队列实现图的广度优先搜索',
            insertText: `const queue = [start];
const visited = new Set([start]);

while (queue.length > 0) {
    const node = queue.shift();
    
    // 处理当前节点
    
    for (const neighbor of getNeighbors(node)) {
        if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
        }
    }
}`
        },
        {
            prefix: 'dfs',
            label: 'DFS 深度优先搜索',
            detail: '图的深度优先搜索模板',
            documentation: '递归实现图的深度优先搜索',
            insertText: `const visited = new Set();

function dfs(node) {
    if (visited.has(node)) return;
    
    visited.add(node);
    
    // 处理当前节点
    
    for (const neighbor of getNeighbors(node)) {
        dfs(neighbor);
    }
}

dfs(start);`
        },
        {
            prefix: 'dp',
            label: '动态规划模板',
            detail: '一维动态规划模板',
            documentation: '动态规划的标准实现结构',
            insertText: `const n = nums.length;
const dp = new Array(n).fill(0);

// 初始化

dp[0] = nums[0];

for (let i = 1; i < n; i++) {
    // 状态转移方程
    dp[i] = Math.max(dp[i - 1] + nums[i], nums[i]);
}

return dp[n - 1];`
        },
        {
            prefix: 'binarysearch',
            label: '二分查找模板',
            detail: '标准的二分查找实现',
            documentation: '在有序数组中查找目标值的二分查找算法',
            insertText: `let left = 0, right = nums.length - 1;

while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    if (nums[mid] === target) {
        return mid;
    } else if (nums[mid] < target) {
        left = mid + 1;
    } else {
        right = mid - 1;
    }
}

return -1;`
        },
        {
            prefix: 'quicksort',
            label: '快速排序',
            detail: '快速排序算法实现',
            documentation: '经典的分治排序算法，平均时间复杂度 O(n log n)',
            insertText: `function quickSort(nums, left = 0, right = nums.length - 1) {
    if (left >= right) return nums;
    
    const pivot = partition(nums, left, right);
    quickSort(nums, left, pivot - 1);
    quickSort(nums, pivot + 1, right);
    
    return nums;
}

function partition(nums, left, right) {
    const pivot = nums[right];
    let i = left;
    
    for (let j = left; j < right; j++) {
        if (nums[j] < pivot) {
            [nums[i], nums[j]] = [nums[j], nums[i]];
            i++;
        }
    }
    
    [nums[i], nums[right]] = [nums[right], nums[i]];
    return i;
}`
        },
        {
            prefix: 'linkedlist',
            label: '链表节点定义',
            detail: '单向链表节点类定义',
            documentation: 'LeetCode 链表题目的标准节点定义',
            insertText: `function ListNode(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
}`
        },
        {
            prefix: 'treenode',
            label: '二叉树节点定义',
            detail: '二叉树节点类定义',
            documentation: 'LeetCode 二叉树题目的标准节点定义',
            insertText: `function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}`
        },
        {
            prefix: 'unionfind',
            label: '并查集模板',
            detail: '并查集数据结构实现',
            documentation: '用于解决连通性问题的并查集模板',
            insertText: `class UnionFind {
    constructor(n) {
        this.parent = new Array(n).fill(0).map((_, i) => i);
        this.rank = new Array(n).fill(0);
    }
    
    find(x) {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]);
        }
        return this.parent[x];
    }
    
    union(x, y) {
        const px = this.find(x), py = this.find(y);
        if (px === py) return false;
        
        if (this.rank[px] < this.rank[py]) {
            this.parent[px] = py;
        } else if (this.rank[px] > this.rank[py]) {
            this.parent[py] = px;
        } else {
            this.parent[py] = px;
            this.rank[px]++;
        }
        return true;
    }
}`
        },
        {
            prefix: 'heap',
            label: '优先队列（堆）',
            detail: '使用堆实现优先队列',
            documentation: 'JavaScript 最小堆/优先队列实现',
            insertText: `class MinHeap {
    constructor() {
        this.heap = [];
    }
    
    push(val) {
        this.heap.push(val);
        this.bubbleUp(this.heap.length - 1);
    }
    
    pop() {
        if (this.heap.length === 0) return null;
        const min = this.heap[0];
        const end = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.bubbleDown(0);
        }
        return min;
    }
    
    bubbleUp(index) {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.heap[parent] <= this.heap[index]) break;
            [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
            index = parent;
        }
    }
    
    bubbleDown(index) {
        while (true) {
            let min = index;
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            
            if (left < this.heap.length && this.heap[left] < this.heap[min]) min = left;
            if (right < this.heap.length && this.heap[right] < this.heap[min]) min = right;
            
            if (min === index) break;
            [this.heap[index], this.heap[min]] = [this.heap[min], this.heap[index]];
            index = min;
        }
    }
}`
        },
        {
            prefix: 'slidingwindow',
            label: '滑动窗口模板',
            detail: '滑动窗口算法模板',
            documentation: '用于解决子数组/子字符串问题的滑动窗口模板',
            insertText: `let left = 0, right = 0;
const window = new Map();
let valid = 0;

while (right < s.length) {
    // 扩大窗口
    const c = s[right];
    right++;
    
    // 更新窗口数据
    
    while (窗口需要收缩) {
        // 缩小窗口
        const d = s[left];
        left++;
        
        // 更新窗口数据
    }
}`
        },
        {
            prefix: 'backtrack',
            label: '回溯算法模板',
            detail: '回溯算法通用模板',
            documentation: '用于解决排列、组合、子集等问题的回溯模板',
            insertText: `const result = [];
const path = [];

function backtrack(选择列表, start) {
    if (满足结束条件) {
        result.push([...path]);
        return;
    }
    
    for (let i = start; i < 选择列表.length; i++) {
        // 做选择
        path.push(选择列表[i]);
        
        backtrack(选择列表, i + 1);
        
        // 撤销选择
        path.pop();
    }
}

backtrack(nums, 0);
return result;`
        },
        {
            prefix: 'lca',
            label: '最近公共祖先（LCA）',
            detail: '二叉树最近公共祖先',
            documentation: '查找二叉树中两个节点的最近公共祖先',
            insertText: `function lowestCommonAncestor(root, p, q) {
    if (!root || root === p || root === q) return root;
    
    const left = lowestCommonAncestor(root.left, p, q);
    const right = lowestCommonAncestor(root.right, p, q);
    
    if (left && right) return root;
    return left || right;
}`
        }
    ],

    // Python 代码片段
    python: [
        {
            prefix: 'twosum',
            label: '两数之和 - 哈希表',
            detail: '使用字典在 O(n) 时间内解决两数之和',
            insertText: `hash_map = {}
for i, num in enumerate(nums):
    complement = target - num
    if complement in hash_map:
        return [hash_map[complement], i]
    hash_map[num] = i
return []`
        },
        {
            prefix: 'bfs',
            label: 'BFS 广度优先搜索',
            detail: '使用 deque 实现 BFS',
            insertText: `from collections import deque

queue = deque([start])
visited = {start}

while queue:
    node = queue.popleft()
    
    # 处理当前节点
    
    for neighbor in get_neighbors(node):
        if neighbor not in visited:
            visited.add(neighbor)
            queue.append(neighbor)`
        },
        {
            prefix: 'dfs',
            label: 'DFS 深度优先搜索',
            detail: '递归实现 DFS',
            insertText: `def dfs(node, visited):
    if node in visited:
        return
    
    visited.add(node)
    
    # 处理当前节点
    
    for neighbor in get_neighbors(node):
        dfs(neighbor, visited)

dfs(start, set())`
        },
        {
            prefix: 'dp',
            label: '动态规划模板',
            detail: '一维 DP 模板',
            insertText: `n = len(nums)
dp = [0] * n

# 初始化
dp[0] = nums[0]

for i in range(1, n):
    # 状态转移方程
    dp[i] = max(dp[i-1] + nums[i], nums[i])

return dp[-1]`
        },
        {
            prefix: 'binarysearch',
            label: '二分查找',
            detail: '标准二分查找实现',
            insertText: `left, right = 0, len(nums) - 1

while left <= right:
    mid = (left + right) // 2
    
    if nums[mid] == target:
        return mid
    elif nums[mid] < target:
        left = mid + 1
    else:
        right = mid - 1

return -1`
        },
        {
            prefix: 'unionfind',
            label: '并查集',
            detail: 'Python 并查集实现',
            insertText: `class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n
    
    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]
    
    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        
        if self.rank[px] < self.rank[py]:
            self.parent[px] = py
        elif self.rank[px] > self.rank[py]:
            self.parent[py] = px
        else:
            self.parent[py] = px
            self.rank[px] += 1
        return True`
        }
    ],

    // Java 代码片段
    java: [
        {
            prefix: 'twosum',
            label: '两数之和 - HashMap',
            detail: '使用 HashMap 在 O(n) 时间内解决两数之和',
            insertText: `Map<Integer, Integer> map = new HashMap<>();
for (int i = 0; i < nums.length; i++) {
    int complement = target - nums[i];
    if (map.containsKey(complement)) {
        return new int[] { map.get(complement), i };
    }
    map.put(nums[i], i);
}
return new int[0];`
        },
        {
            prefix: 'bfs',
            label: 'BFS 广度优先搜索',
            detail: '使用 Queue 实现 BFS',
            insertText: `Queue<Node> queue = new LinkedList<>();
Set<Node> visited = new HashSet<>();
queue.offer(start);
visited.add(start);

while (!queue.isEmpty()) {
    Node node = queue.poll();
    
    // 处理当前节点
    
    for (Node neighbor : getNeighbors(node)) {
        if (!visited.contains(neighbor)) {
            visited.add(neighbor);
            queue.offer(neighbor);
        }
    }
}`
        },
        {
            prefix: 'dfs',
            label: 'DFS 深度优先搜索',
            detail: '递归实现 DFS',
            insertText: `Set<Node> visited = new HashSet<>();

dfs(start, visited);

void dfs(Node node, Set<Node> visited) {
    if (visited.contains(node)) return;
    
    visited.add(node);
    
    // 处理当前节点
    
    for (Node neighbor : getNeighbors(node)) {
        dfs(neighbor, visited);
    }
}`
        },
        {
            prefix: 'binarysearch',
            label: '二分查找',
            detail: '标准二分查找实现',
            insertText: `int left = 0, right = nums.length - 1;

while (left <= right) {
    int mid = left + (right - left) / 2;
    
    if (nums[mid] == target) {
        return mid;
    } else if (nums[mid] < target) {
        left = mid + 1;
    } else {
        right = mid - 1;
    }
}

return -1;`
        },
        {
            prefix: 'dp',
            label: '动态规划模板',
            detail: '一维 DP 模板',
            insertText: `int n = nums.length;
int[] dp = new int[n];

// 初始化
dp[0] = nums[0];

for (int i = 1; i < n; i++) {
    // 状态转移方程
    dp[i] = Math.max(dp[i-1] + nums[i], nums[i]);
}

return dp[n-1];`
        }
    ],

    // C++ 代码片段
    cpp: [
        {
            prefix: 'twosum',
            label: '两数之和 - unordered_map',
            detail: '使用哈希表在 O(n) 时间内解决两数之和',
            insertText: `unordered_map<int, int> map;
for (int i = 0; i < nums.size(); i++) {
    int complement = target - nums[i];
    if (map.find(complement) != map.end()) {
        return {map[complement], i};
    }
    map[nums[i]] = i;
}
return {};`
        },
        {
            prefix: 'bfs',
            label: 'BFS 广度优先搜索',
            detail: '使用 queue 实现 BFS',
            insertText: `queue<Node*> q;
unordered_set<Node*> visited;
q.push(start);
visited.insert(start);

while (!q.empty()) {
    Node* node = q.front();
    q.pop();
    
    // 处理当前节点
    
    for (Node* neighbor : getNeighbors(node)) {
        if (!visited.count(neighbor)) {
            visited.insert(neighbor);
            q.push(neighbor);
        }
    }
}`
        },
        {
            prefix: 'dfs',
            label: 'DFS 深度优先搜索',
            detail: '递归实现 DFS',
            insertText: `void dfs(Node* node, unordered_set<Node*>& visited) {
    if (!node || visited.count(node)) return;
    
    visited.insert(node);
    
    // 处理当前节点
    
    for (Node* neighbor : getNeighbors(node)) {
        dfs(neighbor, visited);
    }
}`
        },
        {
            prefix: 'binarysearch',
            label: '二分查找',
            detail: '标准二分查找实现',
            insertText: `int left = 0, right = nums.size() - 1;

while (left <= right) {
    int mid = left + (right - left) / 2;
    
    if (nums[mid] == target) {
        return mid;
    } else if (nums[mid] < target) {
        left = mid + 1;
    } else {
        right = mid - 1;
    }
}

return -1;`
        }
    ]
};

// ========================================
// Monaco Editor 代码补全提供者
// ========================================

class CodeCompletionProvider {
    constructor() {
        this.snippets = CodeSnippets;
    }

    // 为指定语言注册代码补全
    registerForLanguage(language) {
        if (!window.monaco) return;

        const snippets = this.snippets[language] || this.snippets.javascript;
        
        // 注册代码补全提供者
        monaco.languages.registerCompletionItemProvider(language === 'cpp' ? 'cpp' : 
            language === 'csharp' ? 'csharp' : language, {
            provideCompletionItems: (model, position) => {
                const suggestions = snippets.map(snippet => ({
                    label: {
                        label: snippet.label,
                        detail: snippet.detail,
                        description: 'LeetCode 模板'
                    },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    documentation: snippet.documentation || snippet.detail,
                    insertText: snippet.insertText,
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    prefix: snippet.prefix,
                    sortText: '0' + snippet.prefix
                }));

                // 添加常用代码片段
                const commonSnippets = this.getCommonSnippets(language);
                suggestions.push(...commonSnippets);

                return { suggestions };
            },
            triggerCharacters: ['.'],
            resolveCompletionItem: (item) => item
        });
    }

    // 获取常用代码片段
    getCommonSnippets(language) {
        const common = [];
        
        if (language === 'javascript' || language === 'typescript') {
            common.push(
                {
                    label: { label: 'console.log', detail: '打印输出' },
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'console.log(${1:message});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'for loop', detail: 'for 循环' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'foreach', detail: 'forEach 遍历' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '${1:array}.forEach((${2:item}) => {\n\t$0\n});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'map', detail: 'map 映射' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '${1:array}.map((${2:item}) => {\n\treturn $0;\n});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'filter', detail: 'filter 过滤' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '${1:array}.filter((${2:item}) => {\n\treturn $0;\n});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'reduce', detail: 'reduce 归约' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '${1:array}.reduce((${2:acc}, ${3:curr}) => {\n\treturn $0;\n}, ${4:initial});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }
            );
        } else if (language === 'python') {
            common.push(
                {
                    label: { label: 'print', detail: '打印输出' },
                    kind: monaco.languages.CompletionItemKind.Function,
                    insertText: 'print(${1:message})',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'for range', detail: 'range 循环' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'for ${1:i} in range(${2:n}):\n\t$0',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'for enumerate', detail: 'enumerate 遍历' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'for ${1:i}, ${2:item} in enumerate(${3:iterable}):\n\t$0',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                },
                {
                    label: { label: 'list comprehension', detail: '列表推导式' },
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '[${1:expr} for ${2:item} in ${3:iterable}]',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                }
            );
        }
        
        return common;
    }
}

// ========================================
// 代码智能提示管理器
// ========================================

const CodeIntelliSense = {
    provider: new CodeCompletionProvider(),
    
    // 初始化代码提示
    init() {
        if (!window.monaco) {
            console.warn('Monaco Editor 未加载，跳过代码提示初始化');
            return;
        }
        
        // 为支持的语言注册代码补全
        const languages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust'];
        languages.forEach(lang => {
            this.provider.registerForLanguage(lang);
        });
        
        console.log('代码智能提示已初始化');
    },
    
    // 为特定语言重新注册
    registerLanguage(language) {
        this.provider.registerForLanguage(language);
    }
};

console.log('代码片段模块已加载，支持', Object.keys(CodeSnippets).length, '种语言的代码补全');
