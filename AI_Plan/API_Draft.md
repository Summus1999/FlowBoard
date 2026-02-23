# FlowBoard AI API Draft

## 0. 文档定位

1. 文档目标：定义 AI 能力相关 API 的全局约定，作为前后端联调与服务端实现的统一依据
2. 适用范围：FlowBoard 个人提升栏目 AI RAG + Agent 能力
3. 对齐目标：与项目技术栈口径一致，保证 trace 可观测、可排障、可评测

## 1. 全局约定

1. API 前缀：`/api/v1`
2. 协议：HTTPS
3. 编码：UTF-8
4. 时间格式：ISO 8601（含时区）
5. 鉴权：`Authorization: Bearer <token>`（如启用）

## 2. 框架依赖与trace_id规范

## 2.1 框架依赖口径

| 层级 | 选型 | 职责 |
|---|---|---|
| 编排层 | LangGraph | 多 Agent 工作流编排、checkpoint、human-in-loop |
| Agent/RAG 组件层 | LangChain | LCEL、Tools、Memory 抽象、Retriever 组装 |
| 观测评测层 | LangSmith | trace、评测集管理、prompt 版本管理 |
| 可选增强层 | LlamaIndex | 文档 ingestion/index 管线增强 |

说明：

1. LlamaIndex 是可选增强，不替代 LangGraph/LangChain/LangSmith 主链路
2. 线上标准链路默认走 LangGraph + LangChain + LangSmith

## 2.2 trace_id 字段定义

| 字段 | 类型 | 规则 |
|---|---|---|
| trace_id | string | 建议 UUIDv7，小写，长度 36 |

校验建议：

1. 接收侧正则：`^[0-9a-f-]{36}$`
2. 非法值按“未提供”处理，由服务端重建

## 2.3 trace_id 与 session_id / request_id 的边界定义

### 2.3.1 语义边界

1. trace_id：一次跨组件可观测链路的统一标识，用于追踪、排障、LangSmith 映射
2. session_id：一次用户会话上下文的业务标识，用于多轮记忆与上下文续写
3. request_id：一次单次 API 请求的技术标识，用于幂等、重试与网关日志去重

### 2.3.2 生命周期与作用域

1. trace_id：跨服务调用全程不变，可覆盖多个内部执行步骤
2. session_id：跨多次请求长期存在，直到会话结束
3. request_id：每次 HTTP 请求唯一；是否在重试时复用由幂等策略决定

### 2.3.3 关系约束（防混用）

1. 一个 session_id 下可有多个 trace_id
2. 一个 trace_id 下通常对应一个外部 request_id，可包含多个内部子调用
3. request_id 不可替代 session_id，不可作为长期上下文键

### 2.3.4 字段边界对照表

| 字段 | 来源 | 客户端可控 | 生命周期 | 典型用途 |
|---|---|---|---|---|
| trace_id | 客户端或服务端生成 | 是（可传） | 请求链路级 | 全链路追踪、跨组件排障 |
| session_id | 业务层创建 | 是（业务传入） | 会话级 | 多轮上下文、记忆绑定 |
| request_id | 客户端或网关生成 | 是（可传） | 单请求级 | 幂等控制、重试去重、日志关联 |

## 2.4 request_id 重试复用强约束策略

### 2.4.1 同一次业务操作判定标准

满足下列键集合一致时，视为同一次业务操作：

```text
same(user_id, route, method, idempotency_key, body_hash)
```

### 2.4.2 重试复用矩阵

| 请求类型 | request_id 规则 | 额外约束 |
|---|---|---|
| 幂等写请求（PUT/DELETE/PATCH） | 必须复用同一个 request_id | 建议携带 Idempotency-Key |
| 非幂等写请求（POST 创建类） | 必须复用同一个 request_id | 必须携带 Idempotency-Key |
| 读请求（GET/HEAD） | 可重建 request_id | 同一自动重试链路建议 trace_id 不变 |
| 用户手动再次触发 | 必须新建 request_id | 视为新操作，trace_id 也应新建 |

### 2.4.3 服务端去重与冲突处理

1. 去重键：`request_id + route + method + user_id`
2. 同 request_id 且 payload 一致：返回首次结果，并回传 `X-Idempotent-Replay: true`
3. 同 request_id 但 payload 不一致：返回 `409`，错误码 `AI-4091`

### 2.4.4 重试窗口与退避策略

1. 去重窗口建议：24 小时
2. 自动重试上限建议：3 次
3. 退避策略建议：指数退避（例如 1s、2s、4s）

### 2.4.5 透传字段约束

1. 客户端重试请求必须透传原 `X-Request-Id`
2. 写请求必须透传 `Idempotency-Key`
3. 网关与服务端不得在重试链路中改写 request_id

### 2.4.6 观测字段约束（LangSmith）

run metadata 必须追加以下字段：

1. `retry_attempt`
2. `is_replay`
3. `idempotency_key`

## 2.5 trace_id 生成规则

1. 客户端可传：`X-Trace-Id`
2. 客户端未传或非法：服务端生成 UUIDv7
3. 一次请求生命周期内 trace_id 不可变
4. 服务间转发必须透传原 trace_id，不可重写

## 2.6 传递规范

### 2.6.1 HTTP 入站

请求头：

```text
X-Trace-Id: <trace_id>
X-Request-Id: <request_id>
Idempotency-Key: <idempotency_key> (required for write requests)
```

### 2.6.2 HTTP 出站

响应头必须回传：

```text
X-Trace-Id: <trace_id>
X-Request-Id: <request_id>
X-Idempotent-Replay: true|false
```

JSON 响应体建议统一包含：

```json
{
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "session_id": "a39f9b28-0b0d-49f0-9a23-5a7f2d6f1f5e",
  "data": {}
}
```

### 2.6.3 SSE 流式响应

首帧必须输出 `meta` 事件，携带 trace_id：

```text
event: meta
data: {"trace_id":"0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b","request_id":"req-20260223-000001","session_id":"..."}
```

后续 token、citation、risk、done 事件沿用同一 trace_id 上下文。

## 2.7 错误响应规范

所有错误响应必须携带 trace_id 与 request_id，统一结构如下：

```json
{
  "code": "AI-5002",
  "message": "retrieval timeout",
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "timestamp": "2026-02-23T10:15:30+08:00"
}
```

错误码建议（节选）：

| 错误码 | 语义 |
|---|---|
| AI-4001 | 参数非法 |
| AI-4010 | 未确认高风险操作 |
| AI-4040 | 资源不存在 |
| AI-4090 | 版本冲突 |
| AI-4091 | request_id 冲突（payload 不一致） |
| AI-4290 | 预算超限 |
| AI-5001 | 模型调用失败 |
| AI-5002 | 检索超时 |
| AI-5003 | 工具执行失败 |

## 2.8 LangSmith 映射规范

1. 每次 API 请求创建或关联一个 LangSmith run
2. run metadata 至少包含：
   - `trace_id`
   - `request_id`
   - `session_id`
   - `retry_attempt`
   - `is_replay`
   - `idempotency_key`
   - `user_id`（若可用）
   - `route`
   - `model_profile`
3. LangGraph 节点执行映射为子 span
4. LangChain 检索链、工具链映射为步骤级 span
5. 线上排障时通过 trace_id 反查 LangSmith run

建议 metadata 示例：

```json
{
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "session_id": "a39f9b28-0b0d-49f0-9a23-5a7f2d6f1f5e",
  "retry_attempt": 1,
  "is_replay": false,
  "idempotency_key": "idem-4de9d95a2f6e",
  "route": "/api/v1/chat/stream",
  "component": "langgraph.workflow"
}
```

## 2.9 API 示例

### 2.9.1 Chat 流式请求示例

请求：

```http
POST /api/v1/chat/stream HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
X-Trace-Id: 0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b
X-Request-Id: req-20260223-000001
Idempotency-Key: idem-4de9d95a2f6e

{
  "session_id": "a39f9b28-0b0d-49f0-9a23-5a7f2d6f1f5e",
  "query": "帮我生成三个月后端学习计划",
  "mode": "auto"
}
```

响应头：

```text
X-Trace-Id: 0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b
X-Request-Id: req-20260223-000001
Content-Type: text/event-stream
```

SSE 事件：

```text
event: meta
data: {"trace_id":"0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b","request_id":"req-20260223-000001","session_id":"a39f9b28-0b0d-49f0-9a23-5a7f2d6f1f5e"}

event: token
data: {"text":"第一阶段建议先补齐 Python 基础..."}

event: citation
data: {"ref_id":"ref-1","source":"backend_plan.md#section-2"}

event: risk
data: {"confidence":0.86,"message":"当前答案置信度低于 90%，建议核验引用"}

event: done
data: {"trace_id":"0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b","request_id":"req-20260223-000001"}
```

### 2.9.2 错误响应示例

```http
HTTP/1.1 504 Gateway Timeout
Content-Type: application/json
X-Trace-Id: 0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b
X-Request-Id: req-20260223-000001
```

```json
{
  "code": "AI-5002",
  "message": "retrieval timeout",
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "timestamp": "2026-02-23T10:15:30+08:00"
}
```

### 2.9.3 request_id 重放成功示例

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Trace-Id: 0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b
X-Request-Id: req-20260223-000001
X-Idempotent-Replay: true
```

```json
{
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "data": {
    "status": "replayed"
  }
}
```

### 2.9.4 request_id 冲突示例

```http
HTTP/1.1 409 Conflict
Content-Type: application/json
X-Trace-Id: 0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b
X-Request-Id: req-20260223-000001
```

```json
{
  "code": "AI-4091",
  "message": "request_id conflict: payload mismatch",
  "trace_id": "0194f5c6-95ee-7f24-b996-3f5e8c5b0c9b",
  "request_id": "req-20260223-000001",
  "timestamp": "2026-02-23T10:15:30+08:00"
}
```

## 3. 落地检查清单

1. 网关、API、Worker、Tool 调用链是否全量透传 trace_id
2. 网关与 API 是否同时透传/回传 request_id
3. 所有错误响应是否包含 trace_id 与 request_id
4. SSE 首帧 meta 事件是否稳定输出 trace_id 与 request_id
5. LangSmith run metadata 是否可按 trace_id 检索，并可关联 request_id
6. session_id 是否仅用于会话上下文，不被 request_id 替代
7. 写请求重试时是否强制复用 request_id 与 Idempotency-Key
8. request_id 重放成功是否返回 `X-Idempotent-Replay: true`
9. request_id 冲突是否返回 `AI-4091`
10. 与技术栈文档口径是否一致：
   - LangGraph
   - LangChain
   - LangSmith
   - LlamaIndex（可选）

