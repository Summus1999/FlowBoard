# FlowBoard AI 服务 API 文档

> 版本：v2.1.0  
> 基础 URL：`http://localhost:8000`  
> OpenAPI 文档：`http://localhost:8000/api/v1/docs`

---

## 目录

1. [通用说明](#通用说明)
2. [会话管理 API](#会话管理-api)
3. [聊天 API](#聊天-api)
4. [规划 API](#规划-api)
5. [任务拆解 API](#任务拆解-api)
6. [复盘 API](#复盘-api)
7. [知识库 API](#知识库-api)
8. [配置 API](#配置-api)
9. [系统 API](#系统-api)

---

## 通用说明

### 请求格式

- 所有请求和响应使用 JSON 格式
- 字符编码：UTF-8
- 时间格式：ISO 8601（例如：`2024-03-05T10:30:00Z`）

### 认证

当前版本主要用于本地服务，认证为可选。如需认证，在请求头中添加：

```
Authorization: Bearer {api_token}
```

### 错误响应

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述",
  "trace_id": "uuid-trace",
  "request_id": "uuid-request",
  "timestamp": "2024-03-05T10:30:00Z",
  "path": "/api/v1/endpoint"
}
```

### 错误码

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `INVALID_PARAMS` | 参数错误 | 400 |
| `UNAUTHORIZED` | 未授权 | 401 |
| `FORBIDDEN` | 禁止访问 | 403 |
| `RESOURCE_NOT_FOUND` | 资源不存在 | 404 |
| `VERSION_CONFLICT` | 版本冲突 | 409 |
| `BUDGET_EXCEEDED` | 预算超限 | 429 |
| `INTERNAL_ERROR` | 内部错误 | 500 |
| `MODEL_ERROR` | 模型调用错误 | 502 |
| `RETRIEVAL_TIMEOUT` | 检索超时 | 504 |

---

## 会话管理 API

### 创建会话

```http
POST /api/v1/sessions
```

**请求体：**

```json
{
  "title": "新会话",
  "metadata": {}
}
```

**响应：**

```json
{
  "id": "session-uuid",
  "title": "新会话",
  "created_at": "2024-03-05T10:30:00Z",
  "updated_at": "2024-03-05T10:30:00Z"
}
```

### 获取会话列表

```http
GET /api/v1/sessions?page=1&page_size=20
```

**响应：**

```json
{
  "items": [
    {
      "id": "session-uuid",
      "title": "会话标题",
      "created_at": "2024-03-05T10:30:00Z",
      "updated_at": "2024-03-05T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

### 获取会话详情

```http
GET /api/v1/sessions/{session_id}
```

**响应：**

```json
{
  "id": "session-uuid",
  "title": "会话标题",
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "用户消息",
      "timestamp": "2024-03-05T10:30:00Z"
    },
    {
      "id": "msg-uuid",
      "role": "assistant",
      "content": "助手回复",
      "timestamp": "2024-03-05T10:30:05Z"
    }
  ],
  "created_at": "2024-03-05T10:30:00Z",
  "updated_at": "2024-03-05T10:30:05Z"
}
```

### 删除会话

```http
DELETE /api/v1/sessions/{session_id}
```

**响应：** `204 No Content`

---

## 聊天 API

### 发送消息（非流式）

```http
POST /api/v1/chat/message
```

**请求体：**

```json
{
  "session_id": "session-uuid",
  "message": "你好，请帮我制定一个Python学习计划",
  "model_profile": "balanced",
  "provider": "qwen"
}
```

**响应：**

```json
{
  "message_id": "msg-uuid",
  "content": "好的，我来帮你制定一个Python学习计划...",
  "model": "qwen-plus",
  "provider": "qwen",
  "latency_ms": 1250,
  "token_usage": {
    "prompt_tokens": 45,
    "completion_tokens": 320,
    "total_tokens": 365
  }
}
```

### 发送消息（流式）

```http
POST /api/v1/chat/stream
```

**请求体：**

```json
{
  "session_id": "session-uuid",
  "message": "你好",
  "model_profile": "balanced"
}
```

**响应：** SSE (Server-Sent Events)

```
data: {"type": "chunk", "content": "你好"}
data: {"type": "chunk", "content": "！"}
data: {"type": "chunk", "content": "有什么"}
data: {"type": "chunk", "content": "可以"}
data: {"type": "chunk", "content": "帮你的吗？"}
data: {"type": "done", "message_id": "msg-uuid"}
```

### RAG 问答

```http
POST /api/v1/chat/rag-query
```

**请求体：**

```json
{
  "query": "知识库中关于Docker的内容",
  "top_k": 5,
  "model_profile": "balanced"
}
```

**响应：**

```json
{
  "answer": "根据知识库内容，Docker 是一个开源的容器化平台...",
  "sources": [
    {
      "document_id": "doc-uuid",
      "title": "Docker 入门指南",
      "content": "相关段落内容...",
      "score": 0.92
    }
  ],
  "latency_ms": 2500
}
```

---

## 规划 API

### 生成学习计划

调用 CrewAI 规划师智能体生成学习计划。

```http
POST /api/v1/planning/generate
```

**请求体：**

```json
{
  "goal_description": "学习Python后端开发，掌握FastAPI和SQLAlchemy",
  "target_date": "2024-06-01",
  "weekly_hours": 10,
  "constraints": [
    "工作日每晚2小时",
    "周末可全天学习",
    "需要兼顾工作"
  ],
  "user_context": {
    "current_level": "初级",
    "prior_experience": ["基础Python语法"]
  }
}
```

**响应：**

```json
{
  "plan_id": "plan-uuid",
  "status": "generated",
  "result": {
    "overview": "本计划旨在帮助你从Python基础进阶到后端开发...",
    "milestones": [
      {
        "id": "ms-1",
        "title": "Python基础强化",
        "duration_days": 14,
        "deliverables": ["完成Python高级特性学习", "掌握装饰器和生成器"],
        "success_criteria": "能够熟练使用Python高级特性编写代码"
      },
      {
        "id": "ms-2",
        "title": "FastAPI框架入门",
        "duration_days": 21,
        "deliverables": ["搭建第一个FastAPI应用", "理解依赖注入系统"],
        "success_criteria": "独立完成RESTful API开发"
      }
    ],
    "tasks": [
      {
        "id": "task-1",
        "title": "学习Python装饰器",
        "description": "深入理解装饰器原理和应用场景",
        "estimated_hours": 4,
        "priority": 5,
        "milestone_id": "ms-1",
        "resources": ["Python官方文档", "Real Python教程"]
      }
    ],
    "risk_assessment": [
      {
        "risk": "工作繁忙导致学习时间不足",
        "mitigation": "利用碎片时间学习，周末集中攻克难点"
      }
    ],
    "schedule_suggestion": {
      "weekly_pattern": "工作日每晚2小时理论学习，周末6小时实践",
      "review_points": ["每周末复习本周内容", "每月评估进度"]
    }
  },
  "raw_output": "智能体原始输出文本...",
  "created_at": "2024-03-05T10:30:00Z"
}
```

### 确认计划

```http
POST /api/v1/planning/{plan_id}/confirm
```

**请求体：**

```json
{
  "action": "confirm",
  "modifications": {
    "milestones": [...],
    "tasks": [...]
  }
}
```

**响应：**

```json
{
  "plan_id": "plan-uuid",
  "status": "confirmed",
  "version": 1,
  "confirmed_at": "2024-03-05T10:35:00Z"
}
```

### 获取计划列表

```http
GET /api/v1/planning/plans?page=1&page_size=10&status=active
```

**查询参数：**

- `status`: 计划状态过滤（`draft`, `active`, `completed`, `archived`）
- `page`: 页码
- `page_size`: 每页数量

**响应：**

```json
{
  "items": [
    {
      "plan_id": "plan-uuid",
      "title": "Python后端开发学习计划",
      "goal": "掌握FastAPI和SQLAlchemy",
      "status": "active",
      "progress_percent": 35,
      "created_at": "2024-03-05T10:30:00Z",
      "target_date": "2024-06-01"
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 10
}
```

### 获取计划详情

```http
GET /api/v1/planning/plans/{plan_id}
```

**响应：**

```json
{
  "plan_id": "plan-uuid",
  "title": "Python后端开发学习计划",
  "goal": "掌握FastAPI和SQLAlchemy",
  "status": "active",
  "milestones": [...],
  "tasks": [...],
  "progress": {
    "total_tasks": 20,
    "completed_tasks": 7,
    "completion_rate": 0.35,
    "current_milestone": "FastAPI框架入门"
  },
  "version": 1,
  "created_at": "2024-03-05T10:30:00Z",
  "updated_at": "2024-03-05T14:20:00Z"
}
```

---

## 任务拆解 API

### 拆解任务

调用 CrewAI 任务拆解专家智能体。

```http
POST /api/v1/decomposer/decompose
```

**请求体：**

```json
{
  "task_title": "实现用户认证系统",
  "task_description": "设计并实现一个完整的用户认证系统，包括注册、登录、密码重置、JWT令牌管理等功能",
  "estimated_hours": 16,
  "context": "使用FastAPI框架，JWT令牌认证，支持OAuth2",
  "complexity_hint": "medium"
}
```

**响应：**

```json
{
  "decomposition_id": "dec-uuid",
  "status": "completed",
  "result": {
    "complexity_assessment": {
      "level": "medium",
      "needs_decomposition": true,
      "estimated_subtask_count": 6,
      "risk_factors": ["安全性要求高", "涉及多个技术点"],
      "recommendation": "建议按功能模块逐步实施"
    },
    "subtasks": [
      {
        "id": "subtask-1",
        "title": "设计用户数据模型",
        "description": "设计用户表结构，包含用户名、邮箱、密码哈希、创建时间等字段",
        "estimated_minutes": 60,
        "dependencies": [],
        "checklist": [
          "定义SQLAlchemy模型",
          "添加必要的字段验证",
          "创建数据库迁移脚本"
        ],
        "resources": ["SQLAlchemy文档", "FastAPI数据库指南"]
      },
      {
        "id": "subtask-2",
        "title": "实现密码哈希工具",
        "description": "使用passlib实现安全的密码哈希和验证",
        "estimated_minutes": 45,
        "dependencies": [],
        "checklist": [
          "集成passlib库",
          "实现hash_password函数",
          "实现verify_password函数"
        ],
        "resources": ["passlib文档"]
      },
      {
        "id": "subtask-3",
        "title": "实现JWT令牌生成和验证",
        "description": "使用python-jose实现JWT令牌的生成、验证和刷新",
        "estimated_minutes": 90,
        "dependencies": ["subtask-2"],
        "checklist": [
          "配置JWT密钥",
          "实现create_access_token函数",
          "实现token验证依赖"
        ],
        "resources": ["python-jose文档", "FastAPI安全指南"]
      }
    ],
    "dependency_analysis": {
      "critical_path": ["subtask-1", "subtask-3", "subtask-5"],
      "parallel_groups": [
        ["subtask-1", "subtask-2"],
        ["subtask-4", "subtask-5"]
      ],
      "blocking_points": ["subtask-3"],
      "total_duration_minutes": 960,
      "optimized_duration_minutes": 720
    }
  },
  "raw_output": "智能体原始输出文本...",
  "created_at": "2024-03-05T10:30:00Z"
}
```

### 批量拆解多个任务

```http
POST /api/v1/decomposer/decompose-batch
```

**请求体：**

```json
{
  "tasks": [
    {
      "task_title": "任务1",
      "task_description": "描述1",
      "estimated_hours": 8
    },
    {
      "task_title": "任务2",
      "task_description": "描述2",
      "estimated_hours": 12
    }
  ]
}
```

**响应：**

```json
{
  "batch_id": "batch-uuid",
  "results": [
    {
      "task_title": "任务1",
      "status": "completed",
      "subtasks": [...]
    }
  ],
  "completed_at": "2024-03-05T10:35:00Z"
}
```

---

## 复盘 API

### 生成复盘报告

调用 CrewAI 学习复盘师智能体。

```http
POST /api/v1/review/generate
```

**请求体：**

```json
{
  "period": "weekly",
  "start_date": "2024-02-26",
  "end_date": "2024-03-03",
  "tasks_data": {
    "total_tasks": 15,
    "completed_tasks": 12,
    "tasks": [
      {
        "id": "task-1",
        "title": "学习Python装饰器",
        "status": "completed",
        "completed_at": "2024-02-27T15:30:00Z",
        "estimated_hours": 4,
        "actual_hours": 3.5
      },
      {
        "id": "task-2",
        "title": "学习FastAPI基础",
        "status": "completed",
        "completed_at": "2024-02-28T16:00:00Z",
        "estimated_hours": 6,
        "actual_hours": 7
      }
    ]
  },
  "metrics": {
    "total_learning_hours": 18.5,
    "avg_daily_hours": 2.64,
    "streak_days": 5,
    "consistency_score": 85
  }
}
```

**period 枚举值：**

- `daily`: 日复盘
- `weekly`: 周复盘
- `monthly`: 月复盘
- `milestone`: 里程碑复盘

**响应：**

```json
{
  "review_id": "review-uuid",
  "period": "weekly",
  "status": "completed",
  "result": {
    "summary": {
      "overview": "本周学习进展顺利，完成12个任务中的15个，学习时长18.5小时...",
      "key_highlights": ["连续5天保持学习", "FastAPI基础已掌握"]
    },
    "achievements": [
      {
        "type": "连续坚持",
        "title": "连续5天学习",
        "description": "本周连续5天保持学习习惯",
        "impact": "建立了稳定的学习节奏"
      },
      {
        "type": "技能突破",
        "title": "掌握FastAPI基础",
        "description": "完成了FastAPI入门到实践的学习",
        "impact": "可以开始实际项目开发"
      }
    ],
    "challenges": [
      {
        "challenge": "FastAPI学习超时",
        "possible_causes": ["概念较多需要消化", "实践练习耗时"],
        "impact_level": "medium",
        "suggestions": ["预留更多缓冲时间", "拆分更细的学习单元"]
      }
    ],
    "insights": {
      "learning_pattern": "晚间学习效率高，周末可以集中攻克难点",
      "efficiency_trend": "相比上周效率提升15%",
      "bottlenecks": ["理论到实践的转化"]
    },
    "progress_assessment": {
      "status": "on_track",
      "vs_plan": "基本符合计划进度",
      "completion_forecast": "按当前速度，预计按期完成目标"
    },
    "suggestions": [
      {
        "suggestion": "增加实践项目比例",
        "priority": 1,
        "expected_impact": "提升知识应用能力",
        "effort": "medium"
      },
      {
        "suggestion": "建立学习笔记习惯",
        "priority": 2,
        "expected_impact": "加深记忆，方便复习",
        "effort": "low"
      }
    ],
    "next_goals": [
      {
        "title": "完成第一个FastAPI项目",
        "priority": "high",
        "target_date": "2024-03-10"
      },
      {
        "title": "学习SQLAlchemy ORM",
        "priority": "medium",
        "target_date": "2024-03-15"
      }
    ]
  },
  "raw_output": "智能体原始输出文本...",
  "created_at": "2024-03-05T10:30:00Z"
}
```

### 获取复盘历史

```http
GET /api/v1/review/reviews?period=weekly&page=1&page_size=10
```

**响应：**

```json
{
  "items": [
    {
      "review_id": "review-uuid",
      "period": "weekly",
      "start_date": "2024-02-26",
      "end_date": "2024-03-03",
      "progress_status": "on_track",
      "created_at": "2024-03-03T20:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 10
}
```

---

## 知识库 API

### 上传文档

```http
POST /api/v1/rag/documents
Content-Type: multipart/form-data
```

**请求体：**

```
file: [二进制文件]
metadata: {"title": "文档标题", "category": "技术文档"}
```

**支持的文件类型：**

- `.pdf` - PDF 文档
- `.docx` - Word 文档
- `.md` - Markdown 文档
- `.txt` - 纯文本文档

**响应：**

```json
{
  "document_id": "doc-uuid",
  "filename": "python-tutorial.pdf",
  "title": "Python教程",
  "status": "processing",
  "chunk_count": 25,
  "created_at": "2024-03-05T10:30:00Z"
}
```

### 获取文档列表

```http
GET /api/v1/rag/documents?page=1&page_size=20
```

**响应：**

```json
{
  "items": [
    {
      "document_id": "doc-uuid",
      "filename": "python-tutorial.pdf",
      "title": "Python教程",
      "status": "indexed",
      "chunk_count": 25,
      "created_at": "2024-03-05T10:30:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 20
}
```

### 删除文档

```http
DELETE /api/v1/rag/documents/{document_id}
```

**响应：** `204 No Content`

### 搜索知识库

```http
POST /api/v1/rag/search
```

**请求体：**

```json
{
  "query": "Python装饰器的使用场景",
  "top_k": 5,
  "filters": {
    "category": "技术文档"
  }
}
```

**响应：**

```json
{
  "query": "Python装饰器的使用场景",
  "results": [
    {
      "document_id": "doc-uuid",
      "title": "Python教程",
      "content": "装饰器是Python的一种高级特性，常用于...",
      "score": 0.95,
      "metadata": {
        "page": 25,
        "chapter": "高级特性"
      }
    }
  ],
  "total_found": 15,
  "latency_ms": 250
}
```

---

## 配置 API

### 获取提供商状态

```http
GET /api/v1/config/providers
```

**响应：**

```json
{
  "providers": [
    {
      "id": "qwen",
      "name": "通义千问",
      "enabled": true,
      "available": true,
      "models": ["qwen-max", "qwen-plus", "qwen-turbo"]
    },
    {
      "id": "kimi",
      "name": "Kimi",
      "enabled": true,
      "available": true,
      "models": ["moonshot-v1-8k", "moonshot-v1-32k"]
    }
  ],
  "default_provider": "qwen",
  "fallback_provider": "kimi",
  "monthly_budget": 150.0,
  "monthly_usage": 45.5
}
```

### 更新提供商配置

```http
POST /api/v1/config/providers
```

**请求体：**

```json
{
  "providers": {
    "qwen": {
      "api_key": "sk-xxx",
      "enabled": true
    },
    "kimi": {
      "api_key": "sk-yyy",
      "enabled": true
    }
  },
  "default_provider": "qwen",
  "fallback_provider": "kimi",
  "monthly_budget": 200.0
}
```

**响应：**

```json
{
  "success": true,
  "active_providers": ["qwen", "kimi"],
  "message": "配置已更新"
}
```

### 测试提供商连接

```http
POST /api/v1/config/providers/test
```

**请求体：**

```json
{
  "provider": "qwen",
  "api_key": "sk-xxx"
}
```

**响应：**

```json
{
  "success": true,
  "latency_ms": 850,
  "message": "连接成功"
}
```

---

## 系统 API

### 健康检查

```http
GET /api/v1/health
```

**响应：**

```json
{
  "status": "healthy",
  "version": "2.1.0",
  "timestamp": "2024-03-05T10:30:00Z",
  "services": {
    "database": "connected",
    "vector_store": "connected",
    "model_gateway": "ready"
  }
}
```

### 获取服务指标

```http
GET /api/v1/metrics
```

**响应：**

```json
{
  "uptime_seconds": 86400,
  "requests_total": 1523,
  "requests_per_minute": 12.5,
  "average_latency_ms": 850,
  "error_rate": 0.02,
  "model_usage": {
    "qwen": 800,
    "kimi": 523
  },
  "cost_stats": {
    "monthly_total": 45.5,
    "monthly_budget": 150.0,
    "budget_remaining": 104.5
  }
}
```

---

## WebSocket API（实时通信）

### 连接

```
ws://localhost:8000/api/v1/ws/chat/{session_id}
```

### 消息格式

**客户端发送：**

```json
{
  "type": "message",
  "content": "你好",
  "model_profile": "balanced"
}
```

**服务端推送：**

```json
{
  "type": "chunk",
  "content": "你好",
  "message_id": "msg-uuid"
}
```

```json
{
  "type": "done",
  "message_id": "msg-uuid",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 50
  }
}
```

---

## SDK 示例

### Python

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# 创建会话
response = requests.post(f"{BASE_URL}/sessions", json={
    "title": "Python学习计划"
})
session = response.json()

# 生成学习计划
response = requests.post(f"{BASE_URL}/planning/generate", json={
    "goal_description": "学习Python后端开发",
    "target_date": "2024-06-01",
    "weekly_hours": 10
})
plan = response.json()
print(plan["result"]["overview"])
```

### JavaScript

```javascript
// 生成学习计划
const response = await fetch('http://localhost:8000/api/v1/planning/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal_description: '学习Python后端开发',
    target_date: '2024-06-01',
    weekly_hours: 10
  })
});

const plan = await response.json();
console.log(plan.result.overview);
```

---

## 更新日志

### v2.1.0 (2026-03-05)

- 新增 CrewAI 规划 API (`/api/v1/planning/*`)
- 新增任务拆解 API (`/api/v1/decomposer/*`)
- 新增复盘 API (`/api/v1/review/*`)
- 新增知识库 API (`/api/v1/rag/*`)

### v2.0.0 (2026-02-20)

- 初始 API 版本
- 会话管理、聊天、配置 API

---

*文档版本: v2.1.0 | 最后更新: 2026-03-05*
