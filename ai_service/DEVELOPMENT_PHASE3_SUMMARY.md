# FlowBoard AI Service - 第3期开发完成总结

## 概述

已完成第3期（检索与引用完善）的开发工作，实现了完整的LangChain LCEL检索链、重排序服务、引用格式化和检索评估体系。

## 已完成内容

### 1. LangChain LCEL 检索链 ✅

**文件**: `app/services/rag_chain.py`

实现了完整的LCEL风格检索链：

```
query_normalize -> retrieve -> rerank -> generate
```

组件：
- **QueryNormalizationRunnable**: 查询归一化
- **RetrievalRunnable**: 检索执行
- **RerankRunnable**: 结果重排序
- **AnswerGenerationRunnable**: 回答生成

特性：
- 支持同步和流式输出
- 内置置信度评估
- 风险分级（low/medium/high）
- 引用自动生成

### 2. Rerank 服务 ✅

**文件**: `app/services/rerank_service.py`

实现策略：
- **CrossEncoderReranker**: 使用LLM作为Cross-Encoder
- **LLMReranker**: Pointwise相关性判断
- **None策略**: 直接返回原始排序

评分维度：
- 相关性分数 (0-1)
- 支持批量处理
- 失败回退机制

### 3. 引用格式化 ✅

**文件**: `app/utils/citation.py`

功能：
- 标准引用格式：`[ref-1] 文件名#章节 路径:xxx`
- 支持多种格式风格（standard/minimal/detailed）
- 前端友好的引用映射
- 引用验证（检查无效引用）
- 回溯链接生成

示例输出：
```
[ref-1] python_guide.pdf#第一章 基础 第10页 [路径:/docs/python_guide.pdf]
[ref-2] api_reference.md#快速开始 [路径:/docs/api_reference.md]
```

### 4. 检索评估服务 ✅

**文件**: `app/services/evaluation_service.py`

评估维度：
- **检索质量**: 相关性、多样性、覆盖度
- **问答质量**: 忠实度、完整性、简洁性
- **系统指标**: 命中率、延迟分布、置信度分布

评测数据集：
- 支持JSON格式数据集
- 可按类别分类
- 支持批量评测

### 5. 中文全文检索支持 ✅

**文件**: `app/services/retrieval_service_v2.py`

配置脚本：
- `scripts/setup_zhparser.sql`: zhparser扩展安装
- `scripts/setup_pgvector.sql`: 向量索引配置

特性：
- 自动检测中文配置
- 失败自动回退到simple配置
- 支持中英文混合检索

### 6. 更新的API端点 ✅

**文件**: `app/api/routes/chat.py`, `app/api/routes/evaluation.py`

新增端点：
```
POST   /chat/rag-query            # 完整RAG查询（非流式）
POST   /chat/evaluate-answer       # 评估回答质量
GET    /eval/retrieval/metrics     # 获取检索指标
POST   /eval/retrieval/evaluate    # 评估单次检索
POST   /eval/qa/evaluate          # 评估问答质量
GET    /eval/dataset              # 获取评测数据集
POST   /eval/dataset/add          # 添加评测样例
POST   /eval/run-batch            # 运行批量评测
```

## 数据流

```
用户查询
    ↓
RAGChain.ainvoke()
    ↓
QueryNormalizationRunnable
    ↓
RetrievalRunnable
    ├─> 稀疏检索 (BM25/zhparser)
    ├─> 稠密检索 (pgvector ANN)
    └─> RRF融合
    ↓
RerankRunnable
    └─> CrossEncoder/LLM重排序
    ↓
AnswerGenerationRunnable
    ├─> Prompt构建（带引用标记）
    ├─> LLM生成
    └─> 风险评估
    ↓
返回RAGResponse
    ├─> answer: 带引用标记的回答
    ├─> citations: 引用列表
    ├─> confidence: 置信度
    └─> risk_level: 风险等级
```

## 引用格式规范

### 行内引用
```
Python是一种高级编程语言[ref-1]，由Guido van Rossum创建[ref-2]。
```

### 引用条目
```
[ref-1] python_tutorial.pdf#第一章 基础 第10页 [路径:/docs/python.pdf]
[ref-2] python_history.md#创始人 [路径:/docs/history.md]
```

### 前端格式
```json
{
  "ref_id": "ref-1",
  "chunk_id": "uuid",
  "source": "python_tutorial.pdf",
  "section": "第一章 基础",
  "page": 10,
  "preview": "Python是一种...",
  "backlink": "/docs/python.pdf"
}
```

## 评估指标体系

### 检索质量
| 指标 | 说明 | 目标值 |
|------|------|--------|
| Hit Rate | 有结果返回的比例 | > 80% |
| Avg Latency | 平均检索延迟 | < 500ms |
| P95 Latency | 95分位延迟 | < 2000ms |
| Relevance | 检索相关性 | > 0.7 |
| Diversity | 来源多样性 | > 0.5 |

### 问答质量
| 指标 | 说明 | 目标值 |
|------|------|--------|
| Faithfulness | 忠实度 | > 0.7 |
| Completeness | 完整性 | > 0.7 |
| Conciseness | 简洁性 | > 0.7 |
| Overall | 综合分数 | > 0.7 |

## 技术亮点

### 1. LCEL风格链式调用
```python
chain = (
    QueryNormalizationRunnable()
    | RetrievalRunnable(db)
    | RerankRunnable()
    | AnswerGenerationRunnable()
)
response = await chain.ainvoke("查询")
```

### 2. 流式处理支持
```python
async for event in chain.astream(query):
    if event["type"] == "token":
        yield event["data"]["text"]
    elif event["type"] == "citation":
        yield event["data"]
```

### 3. 模块化Rerank策略
```python
# 可切换策略
rerank_service.rerank(
    query, documents,
    strategy="cross_encoder"  # 或 "llm", "none"
)
```

### 4. 自动风险评估
```python
confidence = 0.85
if confidence < 0.7:
    risk_level = "high"
elif confidence < 0.9:
    risk_level = "medium"
else:
    risk_level = "low"
```

## API使用示例

### 流式RAG查询
```bash
curl -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"query": "什么是Python？", "mode": "qa"}'
```

SSE事件：
```
event: meta
data: {"trace_id": "...", "request_id": "..."}

event: token
data: {"text": "Python是一种..."}

event: citation
data: {"ref_id": "ref-1", "source": "python_guide.pdf"}

event: risk
data: {"confidence": 0.92, "level": "low"}

event: done
data: {"answer": "...", "citations": [...]}
```

### 评估检索质量
```bash
curl -X POST http://localhost:8000/api/v1/eval/retrieval/evaluate \
  -d '{"query": "Python基础语法"}'
```

响应：
```json
{
  "metrics": {
    "relevance": 0.85,
    "diversity": 0.6,
    "coverage": 0.75,
    "overall": 0.78
  }
}
```

## 配置文件

### PostgreSQL中文检索
```sql
-- 安装zhparser
CREATE EXTENSION zhparser;

-- 创建中文配置
CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l WITH simple;
```

### 环境变量
```bash
# RAG配置
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=100
RAG_TOP_K=8
RAG_RERANK_TOP_K=5
RAG_CONFIDENCE_THRESHOLD=0.9
```

## 测试覆盖

新增测试文件：
- `tests/test_retrieval.py` - 检索服务测试

测试内容：
- RRF融合算法
- 查询归一化
- 置信度评估
- 中文检索回退

## 已知限制

1. **zhparser依赖**: 需要PostgreSQL安装zhparser扩展
2. **CrossEncoder**: 当前使用LLM模拟，效果依赖模型能力
3. **评估自动化**: 部分指标仍需要人工校验

## 下一步（第4期 - Agent规划与确认）

1. Planner Agent完整实现
2. 计划提案与确认流程
3. 计划版本管理与回滚
4. Calendar/Todo工具联动

## 文件统计

- 新增服务文件: 4个 (rag_chain, rerank_service, evaluation_service, retrieval_service_v2)
- 新增工具文件: 1个 (citation.py)
- 新增API文件: 1个 (evaluation.py)
- 新增脚本: 2个 (setup_zhparser.sql, setup_pgvector.sql)
- 更新API: 1个 (chat.py)
- 新增测试: 1个

总计: 新增 ~5000行代码

---

**开发完成日期**: 2026-02-24  
**版本**: v0.3.0 (第3期 - 检索与引用完善)
