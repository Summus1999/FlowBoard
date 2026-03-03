/**
 * FlowBoard 测试桩数据
 * 用于单元测试的模拟数据
 */

// ============================================
// 用户数据
// ============================================

export const mockUser = {
  id: 'user_001',
  name: '测试用户',
  role: 'PRO MEMBER',
  avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
};

// ============================================
// 密码管理数据
// ============================================

export const mockPasswords = [
  {
    id: 1,
    platform: '微信',
    username: 'wxid_test',
    password: '********',
    category: 'social',
    icon: 'fab fa-weixin',
    color: 'linear-gradient(135deg, #07C160, #05a350)',
    strength: 'strong'
  },
  {
    id: 2,
    platform: '支付宝',
    username: '138****8888',
    password: '********',
    category: 'finance',
    icon: 'fas fa-wallet',
    color: 'linear-gradient(135deg, #1677FF, #0958d9)',
    strength: 'strong'
  },
  {
    id: 3,
    platform: 'LeetCode',
    username: 'coder@test.com',
    password: '********',
    category: 'work',
    icon: 'fas fa-code',
    color: 'linear-gradient(135deg, #FFA116, #e5900f)',
    strength: 'medium'
  }
];

// ============================================
// 笔记数据
// ============================================

export const mockNotes = [
  {
    id: 1741040000000,
    title: 'JavaScript 学习笔记',
    content: `# JavaScript 基础

## 变量声明
- var: 函数作用域
- let: 块级作用域
- const: 常量

## 函数
\`\`\`javascript
function hello() {
  console.log('Hello');
}
\`\`\``,
    category: 'study',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-04T08:30:00.000Z'
  },
  {
    id: 1741126400000,
    title: '项目会议记录',
    content: '本周项目进度：\n- 完成登录模块\n- 修复3个bug\n- 下周计划：优化性能',
    category: 'work',
    createdAt: '2026-03-02T14:00:00.000Z',
    updatedAt: '2026-03-02T14:00:00.000Z'
  },
  {
    id: 1741212800000,
    title: '生活灵感',
    content: '阅读清单：\n1. 《代码大全》\n2. 《设计模式》\n3. 《重构》',
    category: 'life',
    createdAt: '2026-03-03T09:00:00.000Z',
    updatedAt: '2026-03-03T09:00:00.000Z'
  }
];

// ============================================
// 日程事件数据
// ============================================

export const mockEvents = [
  {
    id: 1741040000000,
    title: '项目进度会议',
    date: '2026-03-04',
    time: '10:00',
    type: 'work',
    desc: '与团队讨论本周项目进度'
  },
  {
    id: 1741126400000,
    title: '健身运动',
    date: '2026-03-04',
    time: '18:00',
    type: 'study',
    desc: '去健身房锻炼1小时'
  },
  {
    id: 1741212800000,
    title: '提交月度报告',
    date: '2026-03-05',
    time: '17:00',
    type: 'leisure',
    desc: '记得提交本月的月度工作报告'
  }
];

// ============================================
// 待办事项数据
// ============================================

export const mockTodos = [
  {
    id: 1,
    text: '更新项目文档',
    completed: false,
    tag: '紧急'
  },
  {
    id: 2,
    text: '修改账户密码',
    completed: true,
    tag: '一般'
  },
  {
    id: 3,
    text: '查看今日资讯',
    completed: false,
    tag: '日常'
  },
  {
    id: 4,
    text: '备份重要数据',
    completed: false,
    tag: '重要'
  }
];

// ============================================
// LeetCode 题目数据
// ============================================

export const mockProblems = [
  {
    id: 1,
    title: '两数之和',
    titleEn: 'Two Sum',
    titleSlug: 'two-sum',
    difficulty: 'easy',
    status: 'solved',
    tags: ['数组', '哈希表'],
    acceptance: '52.3%',
    source: 'local'
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
    source: 'local'
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
    source: 'local'
  }
];

export const mockSubmissions = [
  {
    id: 'sub_001',
    problemId: 1,
    problemTitle: 'Two Sum',
    status: 'accepted',
    runtime: '60ms',
    memory: '42MB',
    language: 'javascript',
    timestamp: '2026-03-03T10:00:00.000Z'
  },
  {
    id: 'sub_002',
    problemId: 1,
    problemTitle: 'Two Sum',
    status: 'accepted',
    runtime: '55ms',
    memory: '40MB',
    language: 'python',
    timestamp: '2026-03-04T09:00:00.000Z'
  }
];

// ============================================
// GitHub 仓库数据
// ============================================

export const mockRepos = [
  {
    id: 1,
    name: 'flowboard',
    description: '个人工作台桌面应用',
    language: 'JavaScript',
    stargazers_count: 128,
    forks_count: 32,
    updated_at: '2026-03-04T08:00:00Z',
    last_commit: '2026-03-04T08:00:00Z',
    last_commit_message: 'feat: add AI chat feature',
    html_url: 'https://github.com/test/flowboard'
  },
  {
    id: 2,
    name: 'leetcode-practice',
    description: '算法练习笔记',
    language: 'Python',
    stargazers_count: 56,
    forks_count: 12,
    updated_at: '2026-03-03T10:00:00Z',
    last_commit: '2026-03-03T10:00:00Z',
    last_commit_message: 'add: dynamic programming solutions',
    html_url: 'https://github.com/test/leetcode-practice'
  }
];

export const mockGithubUser = {
  login: 'testuser',
  public_repos: 15,
  followers: 128,
  total_stars: 350
};

// ============================================
// 应用中心数据
// ============================================

export const mockAppsV1 = [
  {
    id: 'app_001',
    name: 'VS Code',
    path: 'C:/Program Files/VS Code/Code.exe',
    icon: 'fas fa-code',
    color: '#22c55e'
  },
  {
    id: 'app_002',
    name: 'Chrome',
    path: 'C:/Program Files/Chrome/chrome.exe',
    icon: 'fab fa-chrome',
    color: '#4285f4'
  }
];

export const mockAppsV2 = {
  version: 2,
  apps: [
    {
      id: 'app_1740000000000',
      name: 'VS Code',
      path: 'C:/Program Files/VS Code/Code.exe',
      order: 10,
      iconMeta: {
        mode: 'preset',
        presetClass: 'fas fa-code',
        emoji: '',
        imageDataUrl: '',
        bgColor: '#22c55e',
        fgColor: '#ffffff'
      },
      createdAt: '2026-02-25T10:00:00.000Z',
      updatedAt: '2026-02-25T10:00:00.000Z'
    },
    {
      id: 'app_1740003600000',
      name: '微信',
      path: 'C:/Program Files/WeChat/WeChat.exe',
      order: 20,
      iconMeta: {
        mode: 'emoji',
        presetClass: '',
        emoji: '💬',
        imageDataUrl: '',
        bgColor: '#07C160',
        fgColor: '#ffffff'
      },
      createdAt: '2026-02-26T10:00:00.000Z',
      updatedAt: '2026-02-26T10:00:00.000Z'
    }
  ]
};

// ============================================
// AI 会话数据
// ============================================

export const mockChatSessions = [
  {
    id: 'chat_001',
    title: 'JavaScript 学习咨询',
    createdAt: 1741040000000,
    updatedAt: 1741043600000,
    isPinned: true,
    model: 'qwen',
    messageCount: 12
  },
  {
    id: 'chat_002',
    title: '算法问题解答',
    createdAt: 1740953600000,
    updatedAt: 1740957200000,
    isPinned: false,
    model: 'kimi',
    messageCount: 8
  }
];

export const mockChatMessages = [
  {
    id: 'msg_001',
    sessionId: 'chat_001',
    role: 'user',
    content: '帮我解释一下闭包',
    timestamp: 1741040000000
  },
  {
    id: 'msg_002',
    sessionId: 'chat_001',
    role: 'assistant',
    content: '闭包是指函数能够记住并访问它的词法作用域...',
    timestamp: 1741040100000,
    provider: 'qwen',
    intent: '知识问答'
  }
];

// ============================================
// 任务看板数据
// ============================================

export const mockTasks = [
  {
    id: 'task_001',
    title: '完成登录页面',
    description: '实现用户登录表单和验证逻辑',
    difficulty: 'medium',
    estimatedHours: 4,
    status: 'doing',
    boardId: 'default',
    planId: 'plan_001',
    createdAt: 1741040000000
  },
  {
    id: 'task_002',
    title: '编写单元测试',
    description: '为核心模块编写测试用例',
    difficulty: 'easy',
    estimatedHours: 2,
    status: 'todo',
    boardId: 'default',
    createdAt: 1741043600000
  },
  {
    id: 'task_003',
    title: '优化性能',
    description: '减少首屏加载时间',
    difficulty: 'hard',
    estimatedHours: 8,
    status: 'review',
    boardId: 'default',
    createdAt: 1740953600000
  }
];

// ============================================
// 侧边栏配置数据
// ============================================

export const mockSidebarLayout = {
  version: 1,
  sections: [
    { id: 'core', title: '', order: 10 },
    { id: 'tools', title: '工具', order: 20 }
  ],
  items: [
    { page: 'dashboard', title: '我的主页', icon: 'fas fa-th-large', sectionId: 'core', order: 10, enabled: true, removed: false, source: 'builtin' },
    { page: 'notes', title: '笔记记录', icon: 'fas fa-sticky-note', sectionId: 'tools', order: 10, enabled: true, removed: false, source: 'builtin' },
    { page: 'calendar', title: '日程管理', icon: 'fas fa-calendar-alt', sectionId: 'tools', order: 20, enabled: true, removed: false, source: 'builtin' },
    { page: 'github', title: 'GitHub', icon: 'fab fa-github', sectionId: 'tools', order: 30, enabled: false, removed: true, source: 'builtin' },
    { page: 'custom', title: '自定义', icon: 'fas fa-star', sectionId: 'tools', order: 40, enabled: true, removed: false, source: 'custom' }
  ]
};

// ============================================
// 工具函数
// ============================================

export function createMockDOM() {
  document.body.innerHTML = `
    <div id="app">
      <aside class="sidebar">
        <nav class="sidebar-nav"></nav>
      </aside>
      <main class="main-content">
        <div class="page active" id="page-dashboard"></div>
        <div class="page" id="page-notes">
          <div id="notesList"></div>
          <input id="noteTitleInput" />
          <textarea id="noteMarkdownEditor"></textarea>
          <div id="notePreviewPane"></div>
        </div>
        <div class="page" id="page-calendar">
          <div id="calendarDays"></div>
          <div id="eventsList"></div>
        </div>
        <div class="page" id="page-leetcode">
          <div id="problemList"></div>
          <div id="monacoEditor"></div>
        </div>
        <div class="page" id="page-github">
          <div id="githubRepos"></div>
        </div>
        <div class="page" id="page-apps">
          <div id="appsGrid"></div>
        </div>
        <div class="page" id="page-settings">
          <div id="aiSettingsContainer"></div>
        </div>
      </main>
    </div>
    <div id="ai-chat-container"></div>
  `;
}

export function clearMockDOM() {
  document.body.innerHTML = '';
}
