# FlowBoard 单元测试计划

> 版本: v1.0  
> 创建日期: 2026-03-04  
> 覆盖范围: 前端 JS 模块 + 后端 Python 服务

---

## 1. 测试架构概览

```
tests/
├── TEST_PLAN.md                 # 本测试计划文档
├── unit/                        # 单元测试
│   ├── frontend/               # 前端单元测试 (Jest)
│   │   ├── db-core.test.js
│   │   ├── sidebar-registry.test.js
│   │   ├── app.test.js
│   │   ├── notes.test.js
│   │   ├── calendar.test.js
│   │   ├── leetcode.test.js
│   │   ├── github.test.js
│   │   ├── ai-chat.test.js
│   │   ├── task-board.test.js
│   │   └── app-center.test.js
│   └── backend/                # 后端单元测试 (pytest)
│       ├── test_model_gateway.py
│       ├── test_retrieval_service.py
│       ├── test_config_api.py
│       ├── test_session_service.py
│       └── test_plan_service.py
├── integration/                # 集成测试
│   ├── frontend-backend.test.js
│   └── ai-workflow.test.js
├── e2e/                       # E2E 测试
│   └── smoke.test.js
├── setup/                     # 测试配置
│   ├── jest.config.js
│   ├── jest.setup.js
│   └── conftest.py
└── mocks/                     # 测试桩数据
    ├── mock-data.js
    └── mock-providers.js
```

---

## 2. 前端测试 (JavaScript)

### 2.1 测试环境配置

| 配置项 | 值 |
|--------|-----|
| 测试框架 | Jest 29.x |
| 模拟库 | jest-dom, @testing-library/dom |
| 覆盖率目标 | 核心模块 ≥ 80% |
| 执行命令 | `npm run test:unit` |

### 2.2 测试模块清单

#### Module 1: db-core.js (IndexedDB 存储层)

**测试文件**: `tests/unit/frontend/db-core.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| DB-001 | 数据库初始化成功 | 调用 `flowboardDB.init()` | 返回 db 实例 | P0 |
| DB-002 | 重复初始化返回同一实例 | 第二次调用 init() | 返回已存在的 db 实例 | P0 |
| DB-003 | 通用 CRUD - 写入数据 | `put('passwords', {...})` | 成功写入并返回 key | P0 |
| DB-004 | 通用 CRUD - 读取数据 | `get('passwords', id)` | 返回完整数据对象 | P0 |
| DB-005 | 通用 CRUD - 更新数据 | `put('passwords', {...})` 已存在的 key | 数据被更新 | P0 |
| DB-006 | 通用 CRUD - 删除数据 | `delete('passwords', id)` | 数据被删除 | P0 |
| DB-007 | 批量写入操作 | `batchPut('tasks', [task1, task2])` | 所有数据写入成功 | P1 |
| DB-008 | 按索引查询 | `getByIndex('tasks', 'status', 'todo')` | 返回匹配状态的任务列表 | P1 |
| DB-009 | KV 存储操作 | `setKV('theme', 'dark')` + `getKV('theme')` | 正确存储和读取 | P0 |
| DB-010 | 生成唯一 ID | `generateId('task_')` | 返回带前缀的唯一字符串 | P1 |
| DB-011 | 获取所有数据 | `getAll('passwords')` | 返回数组形式的所有数据 | P1 |
| DB-012 | 清空表数据 | `clear('tasks')` | 表被清空 | P2 |

#### Module 2: sidebar-registry.js (侧边栏注册中心)

**测试文件**: `tests/unit/frontend/sidebar-registry.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| SB-001 | 注册分组 | `registerSection({id:'tools', title:'工具'})` | 分组被添加到状态 | P0 |
| SB-002 | 注册入口项 | `registerItem({page:'notes', title:'笔记'...})` | 入口被添加到状态 | P0 |
| SB-003 | 更新已存在的入口 | 重新注册同 page 的入口 | 数据被合并更新 | P0 |
| SB-004 | 禁用入口 | `setItemEnabled('github', false)` | enabled 设为 false | P0 |
| SB-005 | 启用入口 | `setItemEnabled('github', true)` | enabled 设为 true | P0 |
| SB-006 | 删除自定义入口 | `unregisterItem('custom-page')` | 从状态中移除 | P0 |
| SB-007 | 删除内置入口标记为移除 | `unregisterItem('leetcode')` | removed 设为 true, enabled 设为 false | P0 |
| SB-008 | 移动入口位置 | `moveItem('calendar', {sectionId:'core', order:10})` | sectionId 和 order 更新 | P1 |
| SB-009 | 获取状态快照 | `getState()` | 返回深拷贝的状态对象 | P1 |
| SB-010 | 监听变化事件 | `onChange(callback)` | 状态变更时触发回调 | P1 |
| SB-011 | 取消监听 | `dispose()` 返回的函数 | 回调不再被触发 | P1 |
| SB-012 | 重置布局 | `resetLayout()` | 恢复到默认布局 | P1 |
| SB-013 | 持久化到 localStorage | 任意修改操作 | 数据自动保存到 localStorage | P0 |
| SB-014 | 从 localStorage 恢复 | 页面重新加载 | 恢复上次保存的布局 | P0 |

#### Module 3: app.js (主应用逻辑)

**测试文件**: `tests/unit/frontend/app.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| APP-001 | 页面切换 | `showPage('notes')` | 对应 page 显示，导航项激活 | P0 |
| APP-002 | 切换时调用页面初始化器 | 切换到 leetcode 页面 | 调用 `initLeetCode()` | P0 |
| APP-003 | 密码强度检测-强密码 | `checkPasswordStrength('Abc123!@#')` | 返回 'strong' | P0 |
| APP-004 | 密码强度检测-中等密码 | `checkPasswordStrength('Abc12345')` | 返回 'medium' | P0 |
| APP-005 | 密码强度检测-弱密码 | `checkPasswordStrength('123456')` | 返回 'weak' | P0 |
| APP-006 | 渲染密码卡片 | 调用 `renderPasswordCards()` | DOM 中渲染密码卡片 | P0 |
| APP-007 | 分类筛选密码 | 点击分类按钮 'finance' | 只显示金融类密码 | P0 |
| APP-008 | 更新安全评分 | 密码数据变更 | 圆环进度和分数更新 | P0 |
| APP-009 | 主题切换 | 点击主题卡片 | body class 变更，样式更新 | P0 |
| APP-010 | 毛玻璃效果开关 | 切换 toggleGlass | CSS 变量 --glass-blur 更新 | P1 |
| APP-011 | 保存 UI 设置 | 任意设置变更 | 保存到 localStorage | P0 |
| APP-012 | 加载 UI 设置 | 页面初始化 | 应用保存的设置 | P0 |

#### Module 4: notes.js (Markdown 笔记)

**测试文件**: `tests/unit/frontend/notes.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| NOTE-001 | 加载笔记列表 | 调用 `initNotes()` | 从 localStorage 加载笔记 | P0 |
| NOTE-002 | 创建新笔记 | `createNewNote()` | 新增笔记到列表，ID 自动生成 | P0 |
| NOTE-003 | 选择笔记 | `selectNote(id)` | 编辑器填充笔记内容 | P0 |
| NOTE-004 | 保存当前笔记 | `saveCurrentNote()` | 数据保存到 localStorage | P0 |
| NOTE-005 | 删除笔记 | `deleteNote(id)` | 从列表和存储中移除 | P0 |
| NOTE-006 | 搜索笔记 | `searchNotes()` 输入关键词 | 过滤显示匹配的笔记 | P1 |
| NOTE-007 | 按分类筛选 | `filterNotes('work')` | 只显示工作类笔记 | P1 |
| NOTE-008 | 编辑器模式切换-Markdown | `switchEditorMode('markdown')` | 显示编辑器，隐藏预览 | P0 |
| NOTE-009 | 编辑器模式切换-预览 | `switchEditorMode('preview')` | 隐藏编辑器，显示预览 | P0 |
| NOTE-010 | 编辑器模式切换-分屏 | `switchEditorMode('split')` | 同时显示编辑器和预览 | P0 |
| NOTE-011 | Markdown 预览渲染 | 编辑器输入 Markdown | 预览区正确渲染 HTML | P0 |
| NOTE-012 | 插入 Markdown 语法 | `insertMarkdown('**', '**')` | 编辑器插入粗体语法 | P1 |
| NOTE-013 | 自动保存触发 | 输入后等待 2 秒 | 自动调用保存 | P1 |
| NOTE-014 | 字数统计 | 编辑器输入文本 | 状态栏显示正确字数 | P1 |

#### Module 5: calendar.js (日程管理)

**测试文件**: `tests/unit/frontend/calendar.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| CAL-001 | 加载日程事件 | `initCalendar()` | 从 localStorage 加载事件 | P0 |
| CAL-002 | 渲染日历网格 | 当前月份 2026-03 | 正确渲染 3 月的日历 | P0 |
| CAL-003 | 切换月份-上一月 | `changeMonth(-1)` | 显示 2 月的日历 | P0 |
| CAL-004 | 切换月份-下一月 | `changeMonth(1)` | 显示 4 月的日历 | P0 |
| CAL-005 | 选择日期 | 点击 15 号 | 右侧显示 15 日的日程 | P0 |
| CAL-006 | 添加日程 | 填写标题、时间保存 | 日程添加到列表和日历 | P0 |
| CAL-007 | 编辑日程 | 点击现有日程 | 弹出编辑弹窗，数据回填 | P0 |
| CAL-008 | 删除日程 | 编辑弹窗中点击删除 | 日程被移除 | P0 |
| CAL-009 | 日程类型分类 | 添加工作类日程 | 显示蓝色指示点 | P1 |
| CAL-010 | 日期格式化 | `formatDateISO(date)` | 返回 '2026-03-15' | P1 |
| CAL-011 | 渲染今日标记 | 当前日期 | 今日格子有特殊样式 | P1 |

#### Module 6: leetcode.js (LeetCode 刷题)

**测试文件**: `tests/unit/frontend/leetcode.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| LC-001 | 检查登录状态 | 有保存的 session | `isLoggedIn` 设为 true | P0 |
| LC-002 | 显示登录提示 | 未登录状态 | 列表显示登录提示 | P0 |
| LC-003 | 加载题目列表 | 已登录 | 从 API 加载题目 | P0 |
| LC-004 | 题目筛选-难度 | 选择 'easy' | 只显示简单题 | P0 |
| LC-005 | 题目筛选-状态 | 选择 'solved' | 只显示已解决题目 | P0 |
| LC-006 | 搜索题目 | 输入 '两数之和' | 过滤显示匹配题目 | P1 |
| LC-007 | 选择题目 | 点击题目项 | 右侧显示题目详情 | P0 |
| LC-008 | 语言切换 | 选择 'python' | 编辑器语言切换 | P0 |
| LC-009 | 代码运行 | 点击运行按钮 | 控制台显示执行结果 | P0 |
| LC-010 | 代码提交 | 点击提交按钮 | 提交记录保存，统计更新 | P0 |
| LC-011 | 代码重置 | 点击重置按钮 | 编辑器恢复初始模板 | P1 |
| LC-012 | 添加提交记录 | `submissionHistory.addSubmission()` | 记录被添加，最多 500 条 | P1 |
| LC-013 | 计算连续打卡 | 有提交记录 | 正确计算 streakDays | P1 |

#### Module 7: github.js (GitHub 追踪)

**测试文件**: `tests/unit/frontend/github.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| GH-001 | 检查登录状态 | 有保存的 username | `isLoggedIn` 设为 true | P0 |
| GH-002 | 保存登录信息 | 输入 username | 保存到 localStorage | P0 |
| GH-003 | 加载仓库列表 | 已登录 | 调用 GitHub API 获取仓库 | P0 |
| GH-004 | 用户不存在处理 | 输入不存在的 username | 显示错误提示 | P0 |
| GH-005 | 网络错误处理 | 网络断开 | 显示错误提示 | P0 |
| GH-006 | 渲染仓库卡片 | 获取到仓库数据 | DOM 中渲染仓库信息 | P0 |
| GH-007 | 统计信息更新 | 加载完成后 | Star/Fork/语言统计更新 | P0 |
| GH-008 | 打开外部链接 | 点击仓库卡片 | 调用 electronAPI.openExternal | P0 |
| GH-009 | 登出功能 | 点击登出 | 清除登录信息，显示空状态 | P0 |
| GH-010 | 格式化相对时间 | `formatTimeAgo('2026-03-03')` | 返回 '1天前' | P1 |

#### Module 8: ai-chat.js (AI 对话)

**测试文件**: `tests/unit/frontend/ai-chat.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| AI-001 | 加载会话列表 | `ChatState.loadSessions()` | 从 IndexedDB 加载会话 | P0 |
| AI-002 | 创建新会话 | `ChatState.createSession('测试')` | 会话被创建并设为当前 | P0 |
| AI-003 | 删除会话 | `ChatState.deleteSession(id)` | 会话和相关消息被删除 | P0 |
| AI-004 | 置顶会话 | `ChatState.pinSession(id, true)` | 会话 isPinned 设为 true | P1 |
| AI-005 | 添加消息 | `ChatState.addMessage(...)` | 消息被保存，会话更新 | P0 |
| AI-006 | 获取消息历史 | `ChatState.getMessages(sessionId)` | 按时间排序的消息列表 | P0 |
| AI-007 | 重命名会话 | `ChatState.renameSession(id, '新标题')` | 会话标题更新 | P1 |
| AI-008 | 打开对话面板 | `AIChatUI.open()` | 面板显示，加载数据 | P0 |
| AI-009 | 关闭对话面板 | `AIChatUI.close()` | 面板隐藏 | P0 |
| AI-010 | 发送消息 | 输入消息点击发送 | 用户消息显示，调用 AI | P0 |
| AI-011 | 流式响应 | AI 返回流式数据 | 内容逐字显示 | P0 |
| AI-012 | 复制消息 | 点击复制按钮 | 内容写入剪贴板 | P1 |
| AI-013 | 导出对话 | 点击导出 | 生成 Markdown 文件下载 | P1 |
| AI-014 | 清空上下文 | 点击清空按钮 | 当前会话消息被清空 | P1 |

#### Module 9: task-board.js (任务看板)

**测试文件**: `tests/unit/frontend/task-board.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| TB-001 | 初始化看板 | `TaskBoardUI.init()` | 渲染四列看板 | P0 |
| TB-002 | 加载任务 | `TaskBoardUI.loadTasks()` | 从 IndexedDB 加载任务 | P0 |
| TB-003 | 创建任务卡片 | `createTaskCard(task)` | 返回 DOM 元素 | P0 |
| TB-004 | 添加任务 | `TaskBoardUI.addTask('todo')` | 新任务添加到待办列 | P0 |
| TB-005 | 编辑任务 | `TaskBoardUI.editTask(id)` | 弹出编辑弹窗 | P0 |
| TB-006 | 删除任务 | `TaskBoardUI.deleteTask(id)` | 任务被移除 | P0 |
| TB-007 | 拖拽开始 | `onDragStart(e, task)` | 记录拖拽任务，添加样式 | P1 |
| TB-008 | 拖放任务 | 拖到进行中列 | 任务状态更新为 doing | P1 |
| TB-009 | 同步计划任务状态 | 任务拖到 done 列 | 关联计划中的任务标记完成 | P1 |
| TB-010 | 更新列计数 | 任务移动后 | 各列顶部计数更新 | P1 |

#### Module 10: app-center.js (应用中心)

**测试文件**: `tests/unit/frontend/app-center.test.js`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| AC-001 | 加载应用列表 | `initAppCenter()` | 从 localStorage 加载应用 | P0 |
| AC-002 | 数据迁移 v1→v2 | 旧数组格式数据 | 自动迁移为 v2 对象格式 | P0 |
| AC-003 | 添加应用 | 填写名称和路径 | 应用被添加到列表 | P0 |
| AC-004 | 编辑应用 | 修改应用信息 | 数据更新 | P0 |
| AC-005 | 删除应用 | 点击删除 | 应用被移除 | P0 |
| AC-006 | 预设图标模式 | 选择预设图标 | iconMeta.mode = 'preset' | P0 |
| AC-007 | Emoji 图标模式 | 输入 Emoji | iconMeta.mode = 'emoji' | P0 |
| AC-008 | 图片图标模式 | 上传图片 | iconMeta.mode = 'image' | P0 |
| AC-009 | 图片压缩 | 上传大图 | 图片被压缩到 96x96 | P1 |
| AC-010 | 启动应用 | 双击应用卡片 | 调用 Electron 启动应用 | P0 |
| AC-011 | 进入排序模式 | 点击排序按钮 | 显示拖拽手柄，禁用双击 | P1 |
| AC-012 | 拖拽排序 | 拖动卡片到新位置 | order 值更新，持久化 | P1 |

---

## 3. 后端测试 (Python)

### 3.1 测试环境配置

| 配置项 | 值 |
|--------|-----|
| 测试框架 | pytest 7.x |
| 异步测试 | pytest-asyncio |
| HTTP 测试 | httpx, pytest-fastapi |
| 覆盖率 | pytest-cov |
| 覆盖率目标 | 核心模块 ≥ 85% |
| 执行命令 | `pytest tests/unit/backend -v --cov` |

### 3.2 测试模块清单

#### Module 11: model_gateway.py (模型网关)

**测试文件**: `tests/unit/backend/test_model_gateway.py`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| MG-001 | 初始化模型客户端 | 配置 Qwen API Key | 客户端初始化成功 | P0 |
| MG-002 | 热重载配置 | 更新 Provider 配置 | 只重新初始化变化的 Provider | P0 |
| MG-003 | 测试连接成功 | 有效的 API Key | 返回连接成功状态 | P0 |
| MG-004 | 测试连接失败 | 无效的 API Key | 返回连接失败和错误信息 | P0 |
| MG-005 | 单 Provider 生成 | 调用 generate() | 返回生成的文本 | P0 |
| MG-006 | 流式生成 | 调用 generate_stream() | 返回 AsyncIterator | P0 |
| MG-007 | 嵌入向量生成 | 调用 embed() | 返回向量列表 | P1 |
| MG-008 | 多 Provider 优先级路由 | Provider1 失败 | 自动切换到 Provider2 | P0 |
| MG-009 | 所有 Provider 失败 | 全部不可用 | 抛出异常，返回友好错误 | P0 |
| MG-010 | 注册表模式扩展 | 添加新 Provider 配置 | 无需修改核心代码即可支持 | P1 |
| MG-011 | 成本统计 | 任意生成调用 | 正确统计 token 消耗和成本 | P1 |

#### Module 12: retrieval_service.py (检索服务)

**测试文件**: `tests/unit/backend/test_retrieval_service.py`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| RS-001 | 混合检索 | query='深度学习' | 返回稀疏+稠密检索融合结果 | P0 |
| RS-002 | RRF 融合排序 | 两组检索结果 | 正确计算融合分数并排序 | P0 |
| RS-003 | Rerank 重排序 | query + passages | 返回重排序后的结果 | P1 |
| RS-004 | 低置信度标记 | confidence < 0.9 | 添加风险提示 | P0 |
| RS-005 | 检索超时降级 | 检索超时 | 返回直接生成结果+风险警告 | P0 |
| RS-006 | 空查询处理 | query='' | 返回空结果或提示 | P1 |
| RS-007 | 特殊字符处理 | query='<>!@#' | 正确处理无异常 | P1 |
| RS-008 | 中英文混合检索 | query='Python 入门' | 正确返回双语结果 | P1 |

#### Module 13: config.py (配置管理 API)

**测试文件**: `tests/unit/backend/test_config_api.py`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| CFG-001 | 获取 Provider 状态 | GET /api/v1/config/providers | 返回各 Provider 状态 | P0 |
| CFG-002 | 更新 Provider 配置 | POST 新配置 | 热更新成功，返回新状态 | P0 |
| CFG-003 | 测试 Provider 连接 | POST /test | 返回测试结果 | P0 |
| CFG-004 | 获取注册表信息 | GET /registry | 返回支持的 Provider 列表 | P1 |
| CFG-005 | localhost 免认证 | 127.0.0.1 请求 | 无需 token 直接访问 | P0 |
| CFG-006 | 远程请求需认证 | 非本地 IP 请求 | 验证 Bearer token | P0 |
| CFG-007 | 无效 token 拒绝 | 错误的 token | 返回 401 | P0 |

#### Module 14: session_service.py (会话服务)

**测试文件**: `tests/unit/backend/test_session_service.py`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| SS-001 | 创建会话 | POST /api/v1/sessions | 返回新会话 ID | P0 |
| SS-002 | 获取会话列表 | GET /api/v1/sessions | 返回用户会话列表 | P0 |
| SS-003 | 获取会话详情 | GET /sessions/{id} | 返回会话和消息 | P0 |
| SS-004 | 删除会话 | DELETE /sessions/{id} | 会话被删除 | P0 |
| SS-005 | 更新会话标题 | PATCH /sessions/{id} | 标题更新 | P1 |
| SS-006 | 分页获取消息 | GET /messages?cursor=xxx | 返回下一页消息 | P1 |

#### Module 15: plan_service.py (学习计划服务)

**测试文件**: `tests/unit/backend/test_plan_service.py`

| 用例 ID | 测试场景 | 输入 | 期望输出 | 优先级 |
|---------|----------|------|----------|--------|
| PS-001 | 生成计划提案 | POST /plans/propose | 返回计划提案内容 | P0 |
| PS-002 | 确认计划 | POST /plans/{id}/confirm | 计划进入执行态 | P0 |
| PS-003 | 版本回滚 | POST /plans/{id}/rollback | 回滚到指定版本 | P0 |
| PS-004 | 获取版本历史 | GET /plans/{id}/versions | 返回版本列表 | P1 |
| PS-005 | 批量更新任务 | POST /tasks/batch-update | 需要二次确认 | P0 |
| PS-006 | 删除计划 | DELETE /plans/{id} | 计划被删除（软删除） | P0 |

---

## 4. 集成测试

### 4.1 前后端集成

**测试文件**: `tests/integration/frontend-backend.test.js`

| 用例 ID | 测试场景 | 优先级 |
|---------|----------|--------|
| INT-001 | 前端配置保存后后端热更新成功 | P0 |
| INT-002 | AI 对话完整流程：发送→流式响应→显示 | P0 |
| INT-003 | 学习计划生成→确认→写入日程联动 | P0 |
| INT-004 | 知识库文档导入→索引→检索问答 | P0 |

### 4.2 AI 工作流集成

**测试文件**: `tests/integration/ai-workflow.test.js`

| 用例 ID | 测试场景 | 优先级 |
|---------|----------|--------|
| AIW-001 | Intent Router 正确分类用户意图 | P0 |
| AIW-002 | Planner Agent 生成可执行计划 | P0 |
| AIW-003 | RAG QA Agent 返回带引用的答案 | P0 |
| AIW-004 | 人类在环确认流程正常工作 | P0 |

---

## 5. 测试数据规范

### 5.1 Mock 数据结构

```javascript
// mock-user.js
export const mockUser = {
  id: 'user_001',
  name: '测试用户',
  avatar: 'data:image/png;base64,...'
};

// mock-passwords.js
export const mockPasswords = [
  {
    id: 1,
    platform: '测试平台',
    username: 'test@example.com',
    password: '********',
    category: 'work',
    strength: 'strong'
  }
];

// mock-notes.js
export const mockNotes = [
  {
    id: 1741040000000,
    title: '测试笔记',
    content: '# 标题\n内容',
    category: 'work',
    createdAt: '2026-03-04T00:00:00.000Z',
    updatedAt: '2026-03-04T00:00:00.000Z'
  }
];

// mock-events.js
export const mockEvents = [
  {
    id: 1741040000000,
    title: '测试日程',
    date: '2026-03-04',
    time: '10:00',
    type: 'work'
  }
];
```

### 5.2 Python Fixture

```python
# conftest.py
import pytest

@pytest.fixture
def mock_db():
    """创建内存 SQLite 数据库"""
    # 返回测试数据库连接

@pytest.fixture
def mock_provider_config():
    """模拟 Provider 配置"""
    return {
        "qwen": {"api_key": "sk-test", "enabled": True},
        "kimi": {"api_key": "sk-test", "enabled": False}
    }

@pytest.fixture
def test_client(mock_db):
    """FastAPI 测试客户端"""
    from app.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)
```

---

## 6. 测试执行策略

### 6.1 执行命令

```bash
# 运行所有测试
npm run test

# 仅前端单元测试
npm run test:unit:frontend

# 仅后端单元测试
npm run test:unit:backend

# 集成测试
npm run test:integration

# 带覆盖率报告
npm run test:coverage

# 监视模式
npm run test:watch
```

### 6.2 CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install Dependencies
        run: |
          npm ci
          pip install -r ai_service/requirements.txt
          pip install pytest pytest-asyncio pytest-cov
      - name: Run Frontend Tests
        run: npm run test:unit:frontend -- --coverage
      - name: Run Backend Tests
        run: pytest tests/unit/backend --cov=ai_service --cov-report=xml
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
```

---

## 7. 验收标准

### 7.1 覆盖率要求

| 模块 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 |
|------|-----------|-----------|-----------|
| db-core.js | ≥ 85% | ≥ 80% | ≥ 90% |
| sidebar-registry.js | ≥ 80% | ≥ 75% | ≥ 85% |
| app.js | ≥ 75% | ≥ 70% | ≥ 80% |
| notes.js | ≥ 80% | ≥ 75% | ≥ 85% |
| ai-chat.js | ≥ 75% | ≥ 70% | ≥ 80% |
| model_gateway.py | ≥ 90% | ≥ 85% | ≥ 90% |
| retrieval_service.py | ≥ 85% | ≥ 80% | ≥ 85% |

### 7.2 质量门禁

- [ ] 所有 P0 测试用例通过
- [ ] 核心模块覆盖率达标
- [ ] 无严重 Bug（Blocker/Critical）
- [ ] 测试执行时间 < 5 分钟

---

## 8. 后续优化计划

### Phase 2 (2周后)
- 补充 E2E 测试（Playwright）
- 性能基准测试
- 视觉回归测试

### Phase 3 (1个月后)
- 契约测试（Pact）
- 混沌测试
- 负载测试

---

**文档版本历史**

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-03-04 | 初始版本 | AI Assistant |
