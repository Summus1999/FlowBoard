-- PostgreSQL 中文全文检索配置脚本
-- 安装和配置zhparser扩展

-- 1. 创建扩展（需要超级用户权限）
CREATE EXTENSION IF NOT EXISTS zhparser;

-- 2. 创建中文文本搜索配置
-- 如果已存在，先删除
DROP TEXT SEARCH CONFIGURATION IF EXISTS chinese;

-- 创建新的配置
CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);

-- 3. 添加映射
-- 对于中文字符使用ngram，对于英文等使用对应语言的标准配置
ALTER TEXT SEARCH CONFIGURATION chinese ADD MAPPING FOR n,v,a,i,e,l WITH simple;

-- 4. 创建自定义字典（可选）
-- 可以添加领域特定词汇

-- 5. 测试查询
-- SELECT to_tsvector('chinese', '这是一个中文测试');
-- SELECT to_tsquery('chinese', '中文');

-- 6. 更新rag_chunks表的tsv字段使用中文配置
-- 注意：执行前请确保数据已存在

-- 创建或更新tsv字段（使用中文配置）
-- UPDATE rag_chunks SET tsv = to_tsvector('chinese', content);

-- 7. 创建GIN索引
-- CREATE INDEX idx_rag_chunks_tsv_chinese ON rag_chunks USING GIN(tsv);

-- 8. 验证索引
-- EXPLAIN SELECT * FROM rag_chunks WHERE tsv @@ to_tsquery('chinese', '搜索词');

COMMENT ON TEXT SEARCH CONFIGURATION chinese IS '中文全文检索配置，使用zhparser';
