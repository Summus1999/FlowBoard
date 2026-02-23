# FlowBoard AI Service 集成指南

## 概述

本文档说明如何将AI Service与FlowBoard Electron前端集成。

## 架构关系

```
┌─────────────────────────────────────────┐
│        FlowBoard Electron App           │
│  - Personal Growth UI                   │
│  - Plan Visualization                   │
│  - Confirmation Dialogs                 │
└─────────────────┬───────────────────────┘
                  │ HTTPS + SSE
                  ▼
┌─────────────────────────────────────────┐
│       FlowBoard AI Service              │
│  - FastAPI                              │
│  - LangGraph Workflows                  │
│  - RAG Engine                           │
└─────────────────────────────────────────┘
```

## 启动顺序

1. 启动PostgreSQL和Redis
2. 启动AI Service (`python -m app.main`)
3. 启动Electron App

## API调用示例

### JavaScript/TypeScript

```typescript
// 创建会话
async function createSession(userId: string, title: string) {
  const response = await fetch('http://localhost:8000/api/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Trace-Id': generateUUID(),
    },
    body: JSON.stringify({
      user_id: userId,
      title: title,
    }),
  });
  return await response.json();
}

// 流式聊天
function streamChat(sessionId: string, query: string, onMessage: (data: any) => void) {
  const eventSource = new EventSource(
    `http://localhost:8000/api/v1/chat/stream?` +
    `session_id=${sessionId}&query=${encodeURIComponent(query)}`
  );
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
    
    if (data.event === 'done') {
      eventSource.close();
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    eventSource.close();
  };
}
```

## 本地开发集成

### 1. 启动后端服务

```bash
cd ai_service

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加API密钥

# 初始化数据库
python scripts/init_db.py

# 启动服务
python -m app.main
```

### 2. 配置Electron连接

在Electron主进程中配置API客户端：

```javascript
// electron/main.js 或单独的api.js
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000/api/v1'
  : 'https://ai.flowboard.local/api/v1';

class AIApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }
  
  async chatStream(sessionId, query, callbacks) {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({
        session_id: sessionId,
        query: query,
        mode: 'auto',
      }),
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      // 处理SSE格式数据
      this.processSSEChunk(chunk, callbacks);
    }
  }
  
  processSSEChunk(chunk, callbacks) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        switch (data.event) {
          case 'token':
            callbacks.onToken?.(data.data.text);
            break;
          case 'citation':
            callbacks.onCitation?.(data.data);
            break;
          case 'risk':
            callbacks.onRisk?.(data.data);
            break;
          case 'done':
            callbacks.onDone?.(data.data);
            break;
        }
      }
    }
  }
}
```

## 功能模块集成

### 学习计划流程

```
1. 用户输入目标
   ↓
2. 调用 POST /plans/propose
   ↓
3. 显示计划提案 + 确认对话框
   ↓
4. 用户确认 → POST /plans/{id}/confirm
   ↓
5. 显示执行结果
```

### 知识问答流程

```
1. 用户提问
   ↓
2. 调用 POST /chat/stream (SSE)
   ↓
3. 流式显示回答
   ↓
4. 显示引用来源（可点击）
   ↓
5. 如置信度<90%，显示风险提示
```

## 确认对话框设计

高风险操作需要二次确认：

```typescript
interface ConfirmationDialog {
  title: string;
  content: string;
  impact: string[];
  canUndo: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// 使用示例
showConfirmation({
  title: "确认创建学习计划？",
  content: planProposal.summary,
  impact: ["将创建12个待办任务", "将添加3个日程事件"],
  canUndo: true,
  onConfirm: () => confirmPlan(planId),
});
```

## 错误处理

```typescript
try {
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {...});
  
  if (!response.ok) {
    const error = await response.json();
    
    switch (error.code) {
      case 'AI-4010':
        // 未确认高风险操作
        showConfirmationDialog();
        break;
      case 'AI-4290':
        // 预算超限
        showBudgetWarning();
        break;
      case 'AI-5002':
        // 检索超时，降级处理
        showRetryOrDirectAnswerDialog();
        break;
      default:
        showErrorToast(error.message);
    }
  }
} catch (e) {
  showErrorToast('网络错误，请检查AI服务是否运行');
}
```

## 配置检查清单

- [ ] PostgreSQL已安装并启用pgvector
- [ ] Redis已安装并运行
- [ ] `.env`文件配置了正确的API密钥
- [ ] 数据库已初始化
- [ ] AI Service可以正常启动
- [ ] Electron可以连接到AI Service

## 故障排查

### AI Service无法启动

1. 检查端口8000是否被占用
2. 检查数据库连接配置
3. 检查Redis连接配置
4. 查看日志：`python -m app.main` 的输出

### Electron无法连接

1. 检查CORS配置（开发环境允许localhost）
2. 检查网络连接
3. 确认AI Service正在运行

### 模型调用失败

1. 检查API密钥是否正确
2. 检查网络是否可以访问Qwen/Kimi
3. 查看AI Service日志中的错误信息

## 生产环境部署

生产环境建议：

1. 使用HTTPS
2. 配置防火墙限制访问
3. 使用反向代理（Nginx）
4. 配置监控和告警
5. 定期备份数据

参见 [DEPLOYMENT.md](./DEPLOYMENT.md) 获取详细部署指南。
