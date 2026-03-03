# FlowBoard AI API 多厂商接入方案

## 1 现状总览

### 1.1 架构

FlowBoard 是一个 Electron 桌面应用，AI 能力由本地 ai_service 提供:

- 前端: Electron + Vanilla JS，设置页可管理各厂商 API Key
- 后端: ai_service (FastAPI + LangGraph + LangChain)，本地轻量运行，零外部服务依赖

### 1.2 技术栈选型 (路径三: 轻量本地模式)

| 组件 | 选型 | 说明 |
|---|---|---|
| 关系数据库 | SQLite (aiosqlite) | 嵌入式，无需安装，数据存本地文件 |
| 向量数据库 | ChromaDB (嵌入式) | pip install 即用，支持 HNSW + cosine |
| 缓存 | 内存 TTL 缓存 | 替代 Redis，单进程桌面场景足够 |
| LLM 编排 | LangGraph + LangChain | 不变 |
| 模型网关 | ModelGateway (OpenAI 兼容) | 支持 Qwen / Kimi / GLM / 硅基流动，注册表扩展 |
| API 框架 | FastAPI | 不变 |

所有数据存储在 `ai_service/local_data/` 目录:
```
local_data/
  flowboard.db     <- SQLite (sessions, plans, tasks, memory, RAG metadata)
  chroma/          <- ChromaDB (embedding vectors)
```

---

## 2 已实现功能

### 2.1 设置页 AI 配置 UI

在 `index.html` 的 `#page-settings` 中已实现 "AI 服务配置" 卡片:

```
+---------------------------------------------------+
|  AI 服务配置                                        |
+---------------------------------------------------+
|                                                     |
|  AI 服务地址: [http://localhost:8000_____]           |
|  API Token:   [____________________________]        |
|  [测试连接]                                [状态灯]  |
|                                                     |
|  -- 模型提供商 ------------------------------------ |
|                                                     |
|  +- 通义千问 (Qwen) ----------------------------+   |
|  | API Key: [sk-***...***      ] [眼睛] [测试]   |   |
|  | 状态: * 已连接    模型: qwen-max              |   |
|  +----------------------------------------------+   |
|                                                     |
|  +- Kimi (Moonshot) ----------------------------+   |
|  | API Key: [sk-***...***      ] [眼睛] [测试]   |   |
|  | 状态: * 已连接                                |   |
|  +----------------------------------------------+   |
|                                                     |
|  +- 智谱 GLM -----------------------------------+   |
|  | API Key: [__________________] [眼睛] [测试]   |   |
|  | 状态: o 未配置                                |   |
|  +----------------------------------------------+   |
|                                                     |
|  +- 硅基流动 -----------------------------------+   |
|  | API Key: [sk-***...***      ] [眼睛] [测试]   |   |
|  | 状态: * 已连接                                |   |
|  +----------------------------------------------+   |
|                                                     |
|  -- 调用优先级（拖拽排序）-------------------------- |
|  1. Qwen  2. Kimi  3. 硅基流动  ... 任一可用即可   |
|                                                     |
|  -- 预算控制 -------------------------------------- |
|  月度预算(元):  [150.00]                            |
|  已用/剩余:     Y23.40 / Y126.60  ====----         |
|                                                     |
|  [保存配置]                                          |
+---------------------------------------------------+
```

### 2.2 前端 Provider 注册表

`js/ai-settings.js` 定义 Provider 注册表:

```javascript
const AI_PROVIDERS = {
    qwen: {
        name: '通义千问',
        icon: 'fa-solid fa-brain',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
        keyPrefix: 'sk-',
        docsUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/api-details'
    },
    kimi: {
        name: 'Kimi (Moonshot)',
        icon: 'fa-solid fa-moon',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        keyPrefix: 'sk-',
        docsUrl: 'https://platform.moonshot.cn/docs'
    },
    glm: {
        name: '智谱 GLM',
        icon: 'fa-solid fa-robot',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4', 'glm-4-flash'],
        keyPrefix: '',
        docsUrl: 'https://open.bigmodel.cn/dev/api'
    },
    silflow: {
        name: '硅基流动',
        icon: 'fa-solid fa-bolt',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'],
        keyPrefix: 'sk-',
        docsUrl: 'https://docs.siliconflow.cn'
    }
};
```

新增 Provider 只需在此注册表追加一条，UI 自动渲染。

### 2.3 交互逻辑

| 操作 | 行为 |
|---|---|
| 页面加载 | 通过 IPC 加载加密配置，Key 做掩码展示(前4后4) |
| 点击"眼睛"图标 | 切换 Key 明文/掩码显示 |
| 点击"测试" | 通过 IPC -> Electron 主进程 -> 后端 `/api/v1/config/providers/test` |
| 点击"保存配置" | IPC 加密存储 + IPC 同步给后端 + 热更新 |
| 切换默认/降级模型 | 更新路由策略 |

---

## 3 Electron 主进程

### 3.1 IPC 接口

在 `electron/preload.js` 暴露以下方法:

| IPC Channel | preload 方法名 | 说明 |
|---|---|---|
| `ai-config-save` | `saveAiConfig(config)` | 保存 AI 配置 (API Key 加密后写入 config.json) |
| `ai-config-load` | `loadAiConfig()` | 加载 AI 配置 (解密后返回，Key 做掩码) |
| `ai-config-test` | `testAiProvider(provider, apiKey)` | 测试指定 Provider 连接 |
| `ai-service-status` | `getAiServiceStatus()` | 检查后端健康状态 |
| `ai-config-sync-to-backend` | `syncAiConfigToBackend()` | 同步配置到后端 (走主进程，绕过 CORS) |

所有后端 HTTP 调用均在 Electron 主进程中发起 (Node.js 环境无 CORS 限制)，前端通过 IPC 触发。

### 3.2 加密存储

使用 Electron `safeStorage` API:

- 保存: `safeStorage.encryptString(apiKey).toString('base64')` -> 写入 config.json
- 加载: `safeStorage.decryptString(Buffer.from(encrypted, 'base64'))` -> 返回原文
- 降级: safeStorage 不可用时使用 AES-256-CBC 加密

底层依赖操作系统密钥链:
- macOS: Keychain
- Windows: DPAPI
- Linux: libsecret / gnome-keyring

### 3.3 config.json 结构

```json
{
  "windowWidth": 1400,
  "windowHeight": 900,
  "isMaximized": false,
  "aiConfig": {
    "serviceUrl": "http://localhost:8000",
    "apiToken": "",
    "providers": {
      "qwen": {
        "apiKey": "<safeStorage encrypted base64>",
        "enabled": true
      },
      "kimi": {
        "apiKey": "<safeStorage encrypted base64>",
        "enabled": true
      },
      "glm": {
        "apiKey": "<safeStorage encrypted base64>",
        "enabled": false
      },
      "silflow": {
        "apiKey": "<safeStorage encrypted base64>",
        "enabled": true
      }
    },
    "defaultProvider": "qwen",
    "fallbackProvider": "kimi",
    "monthlyBudget": 150.0
  }
}
```

apiToken 用于远程部署场景；本地运行留空即可。

---

## 4 后端设计

### 4.1 轻量本地基础设施

#### 数据库 (SQLite)

`app/core/database.py`:
- 同步引擎: `sqlite:///local_data/flowboard.db`
- 异步引擎: `sqlite+aiosqlite:///local_data/flowboard.db`
- WAL 模式 + 外键支持
- 启动时自动建表

#### 向量存储 (ChromaDB)

`app/services/vector_store.py`:
- 嵌入式 PersistentClient，数据持久化到 `local_data/chroma/`
- Collection: `rag_chunks`，距离函数 cosine
- 接口: `upsert_embeddings()`, `query_similar()`, `delete_embeddings()`

#### 缓存 (内存)

`app/core/redis.py` (保留文件名，接口不变):
- `_MemoryStore`: 带 TTL 的内存 dict
- 接口与 aioredis.Redis 一致: `get()`, `set()`, `delete()`, `exists()`, `expire()`
- `RedisCache` 封装保持不变，上层代码无需修改

### 4.2 数据模型

所有 JSONB 类型替换为 JSON (SQLAlchemy 通用类型，SQLite 兼容):

| 模型 | 表名 | 说明 |
|---|---|---|
| Session | sessions | 会话 |
| Message | messages | 消息 |
| ShortTermMemory | memory_short_term | 短期记忆 (会话级) |
| LongTermMemory | memory_long_term | 长期记忆 (用户级) |
| Plan | plans | 学习计划 |
| PlanVersion | plan_versions | 计划版本 |
| Task | tasks | 任务 |
| RAGDocument | rag_documents | RAG 文档元数据 |
| RAGDocVersion | rag_doc_versions | 文档版本 |
| RAGChunk | rag_chunks | 文档分块 (embedding 存 ChromaDB) |
| RAGIndexVersion | rag_index_versions | 索引版本 |
| RetrievalLog | retrieval_logs | 检索日志 |

RAGChunk 不再包含 embedding (Vector) 和 tsv (TSVECTOR) 列；向量存储在 ChromaDB 中，以 chunk_id 为 key。

### 4.3 ModelGateway

支持 Qwen / Kimi / GLM，注册表模式:

```python
PROVIDER_REGISTRY = {
    ModelProvider.QWEN: {
        "name": "通义千问",
        "config_key_prefix": "QWEN",
        "default_base_url": "https://dashscope.aliyuncs.com/api/v1",
        "profiles": { ... },
        "pricing": { ... }
    },
    ModelProvider.KIMI: { ... },
    ModelProvider.GLM: { ... },
}
```

关键方法:
- `reload_clients(provider_configs)`: 热重载，不重启服务
- `test_connection(provider, api_key)`: 测试 Key 有效性
- `generate()` / `generate_stream()`: 统一调用接口
- `embed()`: 生成 embedding 向量

### 4.4 检索服务 (RAG)

`app/services/retrieval_service.py`:

混合检索流程:
1. 稀疏检索: SQLite 关键词匹配 (LIKE)
2. 稠密检索: ChromaDB cosine 相似度
3. RRF 融合: Reciprocal Rank Fusion
4. Rerank: 预留接口 (当前直接返回)

`app/services/indexing_service.py`:
- 文档解析 -> 分块 -> embedding 生成 (调用 ModelGateway.embed)
- 分块元数据存 SQLite (rag_chunks 表)
- 向量存 ChromaDB (vector_store.upsert_embeddings)

### 4.5 配置管理 API

`app/api/routes/config.py`:

安全策略: localhost 直接放行；远程请求需要 Bearer token (API_TOKEN 环境变量)。

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/v1/config/providers` | POST | 更新 Provider 配置并热更新 |
| `/api/v1/config/providers` | GET | 查询各 Provider 状态 |
| `/api/v1/config/providers/test` | POST | 测试单个 Provider 连接 |
| `/api/v1/config/providers/registry` | GET | 获取 Provider 注册表 |

---

## 5 配置同步流程

### 5.1 用户手动保存

```
1. 用户在设置页填写 API Key，点击 [保存配置]
2. 前端调用 IPC: electronAPI.saveAiConfig(config)
   -> Electron Main 加密 Key，写入 config.json
3. 前端调用 IPC: electronAPI.syncAiConfigToBackend()
   -> Electron Main 解密 Key，HTTP POST 发给后端
4. 后端 ModelGateway 热更新 Client
5. 前端展示保存成功 + 各 Provider 连接状态
```

### 5.2 应用启动自动同步

```
1. Electron App 启动
2. ai_service 本地启动 (pip install + uvicorn)
3. 前端加载 -> ai-settings.js 初始化
4. 通过 IPC 检测后端健康 -> 连接成功后同步配置
5. 后端用收到的 Key 初始化 ModelGateway
6. AI 功能就绪
```

---

## 6 安全设计

| 层面 | 措施 |
|---|---|
| 存储安全 | API Key 使用 Electron safeStorage 加密，底层依赖 OS 密钥链 |
| 展示安全 | 前端展示时掩码处理，仅显示前4位和后4位 |
| 传输安全 | 本地模式走 localhost HTTP；远程模式需 Bearer token |
| 接口安全 | verify_access(): localhost 直接放行，远程验证 API_TOKEN |
| 日志安全 | API Key 不写入任何日志 |

---

## 7 文件变更清单 (已实现)

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `index.html` | 修改 | settings 页新增 AI 服务配置卡片容器 |
| `js/ai-settings.js` | 新增 | AI 设置页交互逻辑 + Provider 注册表 |
| `css/style.css` | 修改 | 新增 AI 设置相关样式 |
| `electron/preload.js` | 修改 | 暴露 5 个 AI 配置 IPC 方法 |
| `electron/main.js` | 修改 | IPC handler (加密/解密/测试/同步) + Bearer auth |
| `ai_service/app/core/config.py` | 重写 | SQLite + ChromaDB 路径配置，去除 PG/Redis |
| `ai_service/app/core/database.py` | 重写 | SQLite 引擎 (sync + async)，WAL 模式 |
| `ai_service/app/core/redis.py` | 重写 | 内存 TTL 缓存，接口不变 |
| `ai_service/app/models/base.py` | 修改 | 去除 PostgreSQL 专用类型 |
| `ai_service/app/models/session.py` | 修改 | JSONB -> JSON |
| `ai_service/app/models/memory.py` | 修改 | JSONB -> JSON |
| `ai_service/app/models/plan.py` | 修改 | JSONB -> JSON，补充缺失的 TaskStatus 枚举 |
| `ai_service/app/models/rag.py` | 重写 | 去除 Vector/TSVECTOR，embedding 存 ChromaDB |
| `ai_service/app/services/vector_store.py` | 新增 | ChromaDB 封装 (upsert/query/delete) |
| `ai_service/app/services/model_gateway.py` | 修改 | 注册表模式 + GLM + 热更新 + 测试连接 |
| `ai_service/app/services/retrieval_service.py` | 重写 | pgvector -> ChromaDB, PG FTS -> keyword match |
| `ai_service/app/services/retrieval_service_v2.py` | 重写 | 委托给 v1，去除所有 PG 原生 SQL |
| `ai_service/app/services/indexing_service.py` | 修改 | embedding 存入 ChromaDB |
| `ai_service/app/api/routes/config.py` | 新增 | 配置管理 API + Bearer token 认证 |
| `ai_service/app/main.py` | 修改 | SQLite 初始化，去除预热 |
| `ai_service/requirements.txt` | 重写 | 去除 psycopg2/pgvector/redis，加入 chromadb/aiosqlite |
| `ai_service/.env.example` | 重写 | 轻量模式配置模板 |

---

## 8 启动方式

### 本地模式 (推荐，零依赖)

```bash
cd ai_service
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

然后在 FlowBoard 设置页:
- AI 服务地址: `http://localhost:8000`
- API Token: 留空
- 配置好 Qwen/Kimi/GLM 的 API Key
- 点"保存配置"

### 远程模式 (可选，Docker 部署)

对于有云服务器的用户，仍可使用 docker-compose 部署 (PostgreSQL + Redis + ai_service)。
相关文件保留在仓库中: `ai_service/docker-compose.yml`, `ai_service/deploy.sh`。
远程部署时需在 .env 中配置 API_TOKEN，客户端设置页填入对应 Token。

---

## 9 未来扩展

### 9.1 新增 Provider

所有主流 LLM 厂商均提供 OpenAI 兼容接口:

| Provider | Base URL | 接入工作量 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | 前后端各加一条注册 |
| 豆包 (ByteDance) | `https://ark.cn-beijing.volces.com/api/v3` | 前后端各加一条注册 |
| OpenAI (代理) | 用户自定义 base_url | 前后端各加一条注册 |
| 自定义 Provider | 用户填写 base_url + model name | 增加"自定义提供商"输入框 |

### 9.2 路径三到路径一的迁移

如果未来数据量增长需要更强的数据库:
- SQLite -> PostgreSQL: 修改 DATABASE_URL 环境变量即可
- ChromaDB -> pgvector: 重写 vector_store.py 的 3 个函数
- 内存缓存 -> Redis: 修改 redis.py 恢复 aioredis 实现

上层业务代码 (LangGraph, Agent, RAG chain) 完全不需要改动。
