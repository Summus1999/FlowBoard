# FlowBoard AI API 多厂商接入方案

## 1 现状分析

### 1.1 当前架构

FlowBoard 的 AI 能力分为两层:

- 前端 (Electron + Vanilla JS): 设置页面仅包含 UI 主题、显示、通知、系统等配置项，没有 AI 相关设置入口。前端与 ai_service 之间尚未建立通信链路。
- 后端 (ai_service/): 基于 FastAPI + LangGraph + LangChain，已实现 ModelGateway 统一封装 Qwen 和 Kimi 两家模型调用，支持路由、降级、成本统计。

### 1.2 核心问题

| 问题 | 说明 |
|---|---|
| API Key 无 UI 入口 | 用户只能通过手动编辑 `.env` 文件配置 Key，无法在界面上管理 |
| 不支持运行时切换 | 修改 Key 需要重启 ai_service 才能生效 |
| Provider 有限 | 仅支持 Qwen + Kimi，不支持 GLM 等 |
| 前后端未对接 | 前端没有任何代码调用 ai_service 的 API |

---

## 2 方案目标

1. 在设置页新增 "AI 服务配置" 板块，用户可在 UI 上管理各厂商 API Key
2. 兼容 Qwen / Kimi / GLM 三家，并预留 DeepSeek、豆包等扩展位
3. API Key 使用 Electron safeStorage 加密存储，不存 localStorage
4. 支持运行时热更新，修改 Key 后无需重启后端服务
5. 提供连接测试能力，用户可验证 Key 是否有效

---

## 3 整体架构

### 3.1 数据流向

```
用户在设置页输入 API Key
        |
        v
  前端 JS (ai-settings.js)
        |
        v  Electron IPC (加密存储)
  Electron Main (main.js) <--> config.json (safeStorage 加密)
        |
        v  IPC 返回
  前端 JS 拿到配置
        |
        v  HTTP POST /api/v1/config/providers
  ai_service 后端 (FastAPI)
        |
        v  热更新
  ModelGateway (运行时重新初始化 Client)
```

### 3.2 关键设计决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| Key 存储位置 | Electron config.json (safeStorage 加密) | localStorage 明文不安全；safeStorage 使用 OS 级密钥链加密 |
| 前端→后端传输 | HTTP localhost | 仅本机通信，不经外网 |
| Provider 注册方式 | 注册表模式 | 新增 Provider 只需前后端各加一条注册，不动核心逻辑 |
| 模型调用协议 | OpenAI 兼容接口 | Qwen/Kimi/GLM/DeepSeek 均提供 OpenAI 兼容 API |
| 配置生效方式 | 热更新 | 通过 ModelGateway.reload_clients() 重新初始化，无需重启 |

---

## 4 前端设计

### 4.1 设置页 UI 布局

在 `index.html` 的 `#page-settings` 中新增 `settings-card`，位于"系统设置"卡片之后:

```
+---------------------------------------------------+
|  AI 服务配置                                        |
+---------------------------------------------------+
|                                                     |
|  AI 服务地址: [http://localhost:8000_____]           |
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
|  -- 默认模型路由 ---------------------------------- |
|  主力模型:   [v Qwen    ]                           |
|  降级模型:   [v Kimi    ]                           |
|                                                     |
|  -- 预算控制 -------------------------------------- |
|  月度预算(元):  [150.00]                            |
|  已用/剩余:     Y23.40 / Y126.60  ====----         |
|                                                     |
|  [保存配置]                                          |
+---------------------------------------------------+
```

### 4.2 前端 Provider 注册表

新增 `js/ai-settings.js`，定义 Provider 注册表:

```javascript
const AI_PROVIDERS = {
    qwen: {
        name: '通义千问',
        icon: 'china',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
        keyPrefix: 'sk-',
        docsUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/api-details'
    },
    kimi: {
        name: 'Kimi (Moonshot)',
        icon: 'moon',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        keyPrefix: 'sk-',
        docsUrl: 'https://platform.moonshot.cn/docs'
    },
    glm: {
        name: '智谱 GLM',
        icon: 'brain',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4', 'glm-4-flash'],
        keyPrefix: '',
        docsUrl: 'https://open.bigmodel.cn/dev/api'
    }
};
```

新增 Provider 只需在此注册表追加一条，UI 自动渲染。

### 4.3 交互逻辑

| 操作 | 行为 |
|---|---|
| 页面加载 | 通过 IPC 加载加密配置，Key 做掩码展示(前4后4) |
| 点击"眼睛"图标 | 切换 Key 明文/掩码显示 |
| 点击"测试" | 调用后端 `/api/v1/config/providers/test` 验证 Key |
| 点击"保存配置" | IPC 加密存储 + HTTP 同步给后端 + 热更新 |
| 切换默认/降级模型 | 更新路由策略 |

---

## 5 Electron 主进程设计

### 5.1 新增 IPC 接口

在 `electron/preload.js` 暴露以下方法:

| IPC Channel | 方向 | 说明 |
|---|---|---|
| `ai-config-save` | Renderer -> Main | 保存 AI 配置 (API Key 加密后写入 config.json) |
| `ai-config-load` | Renderer -> Main | 加载 AI 配置 (解密后返回，Key 做掩码) |
| `ai-config-load-raw` | Renderer -> Main | 加载原始 Key (仅用于发送给后端) |
| `ai-config-test` | Renderer -> Main | 测试指定 Provider 连接 |

### 5.2 加密存储方案

使用 Electron `safeStorage` API:

- 保存: `safeStorage.encryptString(apiKey).toString('base64')` -> 写入 config.json
- 加载: `safeStorage.decryptString(Buffer.from(encrypted, 'base64'))` -> 返回原文

safeStorage 底层使用操作系统级密钥链:
- macOS: Keychain
- Windows: DPAPI
- Linux: libsecret / gnome-keyring

### 5.3 config.json 新增字段结构

```json
{
  "windowWidth": 1400,
  "windowHeight": 900,
  "isMaximized": false,
  "aiConfig": {
    "serviceUrl": "http://localhost:8000",
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
      }
    },
    "defaultProvider": "qwen",
    "fallbackProvider": "kimi",
    "monthlyBudget": 150.0
  }
}
```

---

## 6 后端设计

### 6.1 新增 GLM Provider

修改 `ai_service/app/services/model_gateway.py`:

ModelProvider 枚举新增:
```python
class ModelProvider(str, Enum):
    QWEN = "qwen"
    KIMI = "kimi"
    GLM = "glm"
```

GLM 模型映射:

| Profile | GLM Model |
|---|---|
| HIGH_QUALITY | glm-4 |
| BALANCED | glm-4-flash |
| COST_EFFECTIVE | glm-4-flash |

GLM 定价 (每千 token, RMB):

| Model | Input | Output |
|---|---|---|
| glm-4 | 0.1 | 0.1 |
| glm-4-flash | 0.001 | 0.001 |

### 6.2 Provider 注册表模式

将现有的硬编码逻辑重构为注册表:

```python
PROVIDER_REGISTRY = {
    ModelProvider.QWEN: {
        "config_key_prefix": "QWEN",
        "default_base_url": "https://dashscope.aliyuncs.com/api/v1",
        "profiles": {
            ModelProfile.HIGH_QUALITY: "qwen-max",
            ModelProfile.BALANCED: "qwen-plus",
            ModelProfile.COST_EFFECTIVE: "qwen-turbo",
            ModelProfile.EMBEDDING: "text-embedding-v3",
        },
        "pricing": {
            "qwen-max": {"input": 0.04, "output": 0.12},
            "qwen-plus": {"input": 0.004, "output": 0.012},
            "qwen-turbo": {"input": 0.002, "output": 0.006},
        }
    },
    ModelProvider.KIMI: {
        "config_key_prefix": "KIMI",
        "default_base_url": "https://api.moonshot.cn/v1",
        "profiles": {
            ModelProfile.HIGH_QUALITY: "moonshot-v1-32k",
            ModelProfile.BALANCED: "moonshot-v1-8k",
            ModelProfile.COST_EFFECTIVE: "moonshot-v1-8k",
        },
        "pricing": {
            "moonshot-v1-8k": {"input": 0.012, "output": 0.012},
            "moonshot-v1-32k": {"input": 0.024, "output": 0.024},
        }
    },
    ModelProvider.GLM: {
        "config_key_prefix": "GLM",
        "default_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "profiles": {
            ModelProfile.HIGH_QUALITY: "glm-4",
            ModelProfile.BALANCED: "glm-4-flash",
            ModelProfile.COST_EFFECTIVE: "glm-4-flash",
        },
        "pricing": {
            "glm-4": {"input": 0.1, "output": 0.1},
            "glm-4-flash": {"input": 0.001, "output": 0.001},
        }
    },
}
```

新增 Provider 只需:
1. ModelProvider 枚举加一项
2. PROVIDER_REGISTRY 加一条
3. config.py 加对应 XXX_API_KEY / XXX_BASE_URL

### 6.3 ModelGateway 新增方法

```python
def reload_clients(self, provider_configs: dict):
    """Hot-reload model clients with new API keys.
    Only re-initialize changed providers."""

async def test_connection(self, provider: ModelProvider, api_key: str) -> dict:
    """Test if a provider API key is valid by sending a minimal request.
    Returns: {"success": bool, "latency_ms": float, "error": str | None}"""
```

### 6.4 新增配置管理 API

新增 `ai_service/app/api/routes/config.py`:

#### POST /api/v1/config/providers

更新 Provider 配置并热更新 ModelGateway。

Request:
```json
{
  "providers": {
    "qwen": { "api_key": "sk-xxx", "enabled": true },
    "kimi": { "api_key": "sk-xxx", "enabled": true },
    "glm":  { "api_key": "sk-xxx", "enabled": false }
  },
  "default_provider": "qwen",
  "fallback_provider": "kimi",
  "monthly_budget": 150.0
}
```

Response:
```json
{
  "status": "ok",
  "active_providers": ["qwen", "kimi"]
}
```

#### GET /api/v1/config/providers

查询当前 Provider 状态。

Response:
```json
{
  "providers": {
    "qwen":  { "enabled": true, "connected": true, "model": "qwen-max" },
    "kimi":  { "enabled": true, "connected": true, "model": "moonshot-v1-8k" },
    "glm":   { "enabled": false, "connected": false, "model": "glm-4-flash" }
  },
  "default_provider": "qwen",
  "fallback_provider": "kimi",
  "monthly_budget": 150.0,
  "cost_used": 23.4
}
```

#### POST /api/v1/config/providers/test

测试单个 Provider 的 API Key 有效性。

Request:
```json
{
  "provider": "qwen",
  "api_key": "sk-xxx"
}
```

Response:
```json
{
  "provider": "qwen",
  "success": true,
  "latency_ms": 342,
  "error": null
}
```

### 6.5 config.py 新增字段

```python
# GLM config
GLM_API_KEY: Optional[str] = None
GLM_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4"
GLM_DEFAULT_MODEL: str = "glm-4-flash"
```

---

## 7 配置同步流程

### 7.1 用户手动保存

```
1. 用户在设置页填写 API Key，点击 [保存配置]
2. 前端调用 IPC: electronAPI.saveAiConfig(config)
   -> Electron Main 加密 Key，写入 config.json
3. 前端调用 IPC: electronAPI.loadAiConfigRaw()
   -> 获取未掩码的原始 Key
4. 前端发 HTTP POST /api/v1/config/providers
   -> 将原始 Key 发送给后端
5. 后端 ModelGateway 热更新 Client
6. 前端展示保存成功 + 各 Provider 连接状态
```

### 7.2 应用启动自动同步

```
1. Electron App 启动
2. ai_service 后端启动 (独立进程或 Electron spawn)
3. 前端加载 -> ai-settings.js 初始化
4. 读取加密配置 -> 解密 -> 发送给后端 POST /api/v1/config/providers
5. 后端用收到的 Key 初始化 ModelGateway
6. 初始化完成，AI 功能就绪
```

---

## 8 安全设计

| 层面 | 措施 |
|---|---|
| 存储安全 | API Key 使用 Electron safeStorage 加密，底层依赖 OS 密钥链 |
| 展示安全 | 前端展示时掩码处理，仅显示前4位和后4位 |
| 传输安全 | 前端→后端走 localhost HTTP，不经外网 |
| 接口安全 | /api/v1/config/* 限制只接受 127.0.0.1 来源请求 |
| 日志安全 | API Key 不写入任何日志 |
| 内存安全 | 原始 Key 仅在 IPC 传输和 HTTP 发送时短暂存在于前端内存 |

---

## 9 文件变更清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `index.html` | 修改 | settings 页新增 AI 服务配置卡片 |
| `js/ai-settings.js` | 新增 | AI 设置页交互逻辑 + Provider 注册表 |
| `css/style.css` | 修改 | 新增 AI 设置相关样式 |
| `electron/preload.js` | 修改 | 新增 4 个 AI 配置 IPC 方法 |
| `electron/main.js` | 修改 | 新增 IPC handler (加密存储/加载/测试) |
| `ai_service/app/core/config.py` | 修改 | 新增 GLM 配置字段 |
| `ai_service/app/services/model_gateway.py` | 修改 | 新增 GLM Provider + 注册表 + 热更新 + 测试连接 |
| `ai_service/app/api/routes/config.py` | 新增 | 配置管理 REST API |
| `ai_service/app/main.py` | 修改 | 注册 config 路由 |
| `ai_service/.env.example` | 修改 | 新增 GLM 配置示例 |

---

## 10 未来扩展预留

以下 Provider 均提供 OpenAI 兼容接口，接入成本极低:

| Provider | Base URL | 接入工作量 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | 前后端各加一条注册 |
| 豆包 (ByteDance) | `https://ark.cn-beijing.volces.com/api/v3` | 前后端各加一条注册 |
| OpenAI (代理) | 用户自定义 base_url | 前后端各加一条注册 |
| 自定义 Provider | 用户填写 base_url + model name | 需增加"自定义提供商"输入框 |

---

## 11 实施节奏建议

| 阶段 | 内容 | 预估工时 |
|---|---|---|
| Phase 1 | Electron 加密存储 + IPC 接口 | 0.5 天 |
| Phase 2 | 前端设置页 UI + 交互逻辑 | 1 天 |
| Phase 3 | 后端 GLM Provider + 注册表重构 | 0.5 天 |
| Phase 4 | 后端配置 API + 热更新 | 0.5 天 |
| Phase 5 | 前后端联调 + 测试连接 | 0.5 天 |
| 合计 | | 3 天 |
