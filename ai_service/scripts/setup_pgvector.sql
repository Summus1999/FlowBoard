-- PostgreSQL pgvector 配置脚本

-- 1. 创建pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 验证安装
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 3. 创建向量索引（在数据导入后执行）
-- 注意：需要在rag_chunks表有数据后执行

-- HNSW索引（推荐，查询更快，但构建较慢）
-- CREATE INDEX ON rag_chunks USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- 或 IVFFlat索引（构建快，查询稍慢）
-- CREATE INDEX ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- 4. 验证向量维度
-- SELECT DISTINCT vector_dims(embedding) FROM rag_chunks LIMIT 5;

-- 5. 查看索引大小
-- SELECT pg_size_pretty(pg_relation_size('idx_rag_chunks_embedding'));

-- 6. 向量相似度查询示例
-- SELECT 
--     id,
--     content,
--     1 - (embedding <=> '[...查询向量...]'::vector) as similarity
-- FROM rag_chunks
-- ORDER BY embedding <=> '[...查询向量...]'::vector
-- LIMIT 5;
