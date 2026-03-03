# FlowBoard AI Service API 文档

## 基础信息

- **基础URL**: `http://localhost:8000/api/v1`
- **协议**: HTTPS (生产环境)
- **编码**: UTF-8
- **请求头**:
  - `Content-Type: application/json`
  - `X-Trace-Id: <uuid>` (可选)
  - `X-Request-Id: <string>` (可选)

## 通用响应格式

### 成功响应

```json
{
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "data": { ... }
}
```

### 错误响应

```json
{
  "code": "AI-5001",
  "message": "模型调用失败",
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "timestamp": "2026-02-23T10:15:30+08:00"
}
```

## 错误码列表

| 错误码 | 说明 | HTTP状态码 |
|--------|------|------------|
| AI-4001 | 参数非法 | 400 |
| AI-4010 | 未确认高风险操作 | 403 |
| AI-4040 | 资源不存在 | 404 |
| AI-4090 | 版本冲突 | 409 |
| AI-4091 | request_id冲突（payload不一致） | 409 |
| AI-4290 | 预算超限 | 429 |
| AI-5001 | 模型调用失败 | 502 |
| AI-5002 | 检索超时 | 504 |
| AI-5003 | 工具执行失败 | 502 |

## API端点

### Chat

#### POST /chat/stream
流式聊天接口

**请求体**:
```json
{
  "session_id": "uuid",
  "query": "帮我拆解三个月的后端学习计划",
  "mode": "auto",
  "context": {}
}
```

**SSE事件**:
```
event: meta
data: {"trace_id":"...","request_id":"...","session_id":"..."}

event: token
data: {"text":"第一阶段..."}

event: citation
data: {"ref_id":"ref-1","source":"file.md#section"}

event: risk
data: {"confidence":0.86,"message":"当前答案置信度低于90%"}

event: done
data: {"trace_id":"...","request_id":"..."}
```

---

### Sessions

#### POST /sessions
创建会话

**请求体**:
```json
{
  "user_id": "user-001",
  "title": "后端学习计划",
  "context": {}
}
```

#### GET /sessions/{session_id}
获取会话详情

#### GET /sessions/{session_id}/messages
获取会话消息列表

---

### Plans

#### POST /plans/propose
生成计划提案

**请求体**:
```json
{
  "session_id": "uuid",
  "goal": "三个月掌握后端开发",
  "target_date": "2026-05-01T00:00:00+08:00",
  "constraints": ["每周10小时"]
}
```

#### POST /plans/{plan_id}/confirm
确认或拒绝计划

**请求体**:
```json
{
  "confirm": true,
  "feedback": "目标时间可以接受"
}
```

#### POST /plans/{plan_id}/rollback
回滚计划版本

**请求体**:
```json
{
  "target_version": 2,
  "reason": "当前版本过于激进"
}
```

---

### RAG

#### POST /rag/sources
添加文档源

**请求体**:
```json
{
  "source_type": "local_dir",
  "path": "/Users/xxx/Documents/docs",
  "auto_sync": true
}
```

#### POST /rag/index-jobs
触发索引任务

**请求体**:
```json
{
  "source_id": "uuid",
  "mode": "incremental"
}
```

#### GET /rag/index-versions
获取索引版本列表

#### POST /rag/index-versions/{version_id}/activate
激活指定索引版本

---

### Config（模型提供商配置）

支持 Qwen、Kimi、GLM、硅基流动，任一可用即可成功。需 localhost 或 Bearer Token 认证。

#### GET /config/providers
获取所有提供商状态

**响应**:
```json
{
  "providers": {
    "qwen": {"enabled": true, "connected": true, "model": "qwen-plus"},
    "kimi": {"enabled": true, "connected": true, "model": "moonshot-v1-8k"},
    "glm": {"enabled": false, "connected": false, "model": "glm-4-flash"},
    "silflow": {"enabled": true, "connected": true, "model": "Qwen/Qwen2.5-72B-Instruct"}
  },
  "default_provider": "qwen",
  "fallback_provider": "kimi",
  "monthly_budget": 150.0,
  "cost_used": 23.4
}
```

#### POST /config/providers
更新提供商配置（热更新）


#### POST /config/providers/test
测试指定 Provider 连接

**请求体**:
```json
{
  "provider": "silflow",
  "api_key": "sk-xxx"
}
```

#### GET /config/providers/registry
获取提供商注册表（不含敏感信息）

---

### Health

#### GET /health
健康检查

**响应**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-02-23T10:15:30+08:00"
}
```

#### GET /ready
就绪检查

#### GET /metrics
服务指标

## 流式输出说明

SSE (Server-Sent Events) 格式：

1. **meta**: 元信息，包含trace_id等
2. **token**: 文本片段
3. **citation**: 引用信息
4. **risk**: 风险提示
5. **done**: 结束标记
6. **error**: 错误信息

## 认证

当前版本暂不需要认证（单用户桌面应用）。

后续如需多用户支持，将使用Bearer Token：
```
Authorization: Bearer <token>
```
