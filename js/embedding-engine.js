/**
 * FlowBoard - Embedding Engine
 * 纯前端向量生成和相似度计算（基于 transformers.js）
 */

class EmbeddingEngine {
    constructor() {
        this.pipeline = null;
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        this.isLoading = false;
        this.loadPromise = null;
        this.dimension = 384; // all-MiniLM-L6-v2 的输出维度
    }

    /**
     * 初始化 embedding 模型
     */
    async init() {
        if (this.pipeline) return;
        if (this.isLoading) return this.loadPromise;

        this.isLoading = true;
        this.loadPromise = this._loadModel();
        
        return this.loadPromise;
    }

    async _loadModel() {
        try {
            console.log('[EmbeddingEngine] 加载模型:', this.modelName);
            
            // 动态导入 transformers.js
            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
            
            this.pipeline = await pipeline('feature-extraction', this.modelName, {
                quantized: true, // 使用量化模型减少体积
                progress_callback: (progress) => {
                    if (progress.status === 'progress') {
                        const percent = Math.round((progress.loaded / progress.total) * 100);
                        console.log(`[EmbeddingEngine] 加载进度: ${percent}%`);
                    }
                }
            });

            console.log('[EmbeddingEngine] 模型加载完成');
            this.isLoading = false;
        } catch (error) {
            console.error('[EmbeddingEngine] 模型加载失败:', error);
            this.isLoading = false;
            throw error;
        }
    }

    /**
     * 生成文本向量
     */
    async embed(text) {
        if (!this.pipeline) {
            await this.init();
        }

        // 处理长文本 - 截断到模型最大长度
        const maxLength = 512;
        const truncated = text.slice(0, maxLength * 4); // 粗略字符限制

        const output = await this.pipeline(truncated, {
            pooling: 'mean',
            normalize: true
        });

        // 转换为 Float32Array
        return new Float32Array(output.data);
    }

    /**
     * 批量生成向量
     */
    async embedBatch(texts, onProgress = null) {
        const vectors = [];
        for (let i = 0; i < texts.length; i++) {
            vectors.push(await this.embed(texts[i]));
            if (onProgress) {
                onProgress(i + 1, texts.length);
            }
        }
        return vectors;
    }

    /**
     * 计算余弦相似度
     */
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 计算欧氏距离
     */
    euclideanDistance(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    /**
     * 向量搜索 - 返回 Top K 相似结果
     */
    async search(queryVector, candidates, k = 5) {
        const scores = candidates.map(candidate => ({
            id: candidate.id,
            score: this.cosineSimilarity(queryVector, candidate.vector),
            data: candidate.data
        }));

        // 按相似度排序并取 Top K
        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }
}

/**
 * RAG 检索引擎 - 基于 IndexedDB 的向量存储和检索
 */
class RAGEngine {
    constructor() {
        this.embedding = new EmbeddingEngine();
        this.isIndexing = false;
    }

    async init() {
        await this.embedding.init();
    }

    /**
     * 添加文档到知识库
     */
    async addDocument(doc) {
        const docId = flowboardDB.generateId('doc_');
        
        // 1. 保存文档元数据
        await flowboardDB.put('knowledgeDocs', {
            id: docId,
            fileName: doc.fileName,
            content: doc.content,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            status: 'processing',
            importedAt: Date.now(),
            chunkCount: 0
        });

        // 2. 分块处理
        const chunks = this._chunkText(doc.content);
        
        // 3. 生成向量并保存
        for (let i = 0; i < chunks.length; i++) {
            const chunkId = `${docId}_chunk_${i}`;
            const vector = await this.embedding.embed(chunks[i]);
            
            // 保存分块
            await flowboardDB.put('knowledgeChunks', {
                id: chunkId,
                docId: docId,
                content: chunks[i],
                index: i,
                charStart: chunks[i].start,
                charEnd: chunks[i].end
            });

            // 保存向量（序列化为 ArrayBuffer）
            await flowboardDB.put('vectors', {
                chunkId: chunkId,
                vector: vector.buffer,
                docId: docId
            });
        }

        // 4. 更新文档状态
        await flowboardDB.put('knowledgeDocs', {
            id: docId,
            fileName: doc.fileName,
            content: doc.content,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            status: 'indexed',
            importedAt: Date.now(),
            chunkCount: chunks.length
        });

        return docId;
    }

    /**
     * 检索相关内容
     */
    async retrieve(query, k = 5) {
        // 1. 生成查询向量
        const queryVector = await this.embedding.embed(query);

        // 2. 获取所有向量（从 IndexedDB）
        const allVectors = await flowboardDB.getAll('vectors');
        
        // 3. 反序列化并计算相似度
        const candidates = allVectors.map(v => ({
            id: v.chunkId,
            vector: new Float32Array(v.vector),
            docId: v.docId
        }));

        // 4. 搜索 Top K
        const results = await this.embedding.search(queryVector, candidates, k);

        // 5. 获取完整内容
        const enrichedResults = await Promise.all(
            results.map(async r => {
                const chunk = await flowboardDB.get('knowledgeChunks', r.id);
                const doc = await flowboardDB.get('knowledgeDocs', r.docId);
                return {
                    ...r,
                    content: chunk?.content || '',
                    docName: doc?.fileName || '未知文档'
                };
            })
        );

        return enrichedResults;
    }

    /**
     * 删除文档及其所有分块和向量
     */
    async deleteDocument(docId) {
        // 删除所有分块
        const chunks = await flowboardDB.getByIndex('knowledgeChunks', 'docId', docId);
        for (const chunk of chunks) {
            await flowboardDB.delete('knowledgeChunks', chunk.id);
            await flowboardDB.delete('vectors', chunk.id);
        }

        // 删除文档
        await flowboardDB.delete('knowledgeDocs', docId);
    }

    /**
     * 文本分块
     */
    _chunkText(text, chunkSize = 500, overlap = 100) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            const chunk = text.slice(start, end);
            
            chunks.push({
                text: chunk,
                start: start,
                end: end
            });

            start += chunkSize - overlap;
        }

        return chunks.map(c => c.text);
    }

    /**
     * 获取知识库统计
     */
    async getStats() {
        const docs = await flowboardDB.getAll('knowledgeDocs');
        const chunks = await flowboardDB.getAll('knowledgeChunks');
        
        return {
            totalDocs: docs.length,
            totalChunks: chunks.length,
            indexedDocs: docs.filter(d => d.status === 'indexed').length,
            processingDocs: docs.filter(d => d.status === 'processing').length
        };
    }
}

/**
 * 文档解析器 - 支持多种格式
 */
const DocumentParser = {
    async parse(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'txt':
            case 'md':
                return this.parseText(file);
            case 'pdf':
                return this.parsePDF(file);
            case 'docx':
                return this.parseDocx(file);
            default:
                throw new Error(`不支持的文件格式: ${extension}`);
        }
    },

    async parseText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    async parsePDF(file) {
        // 使用 PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        
        return text;
    },

    async parseDocx(file) {
        // 简化处理：使用 mammoth.js 或提示用户转换为文本
        // 这里先抛出错误，后续可以添加 mammoth.js 支持
        throw new Error('DOCX 格式暂不支持，请先转换为文本或 PDF');
    }
};

// 导出
window.EmbeddingEngine = EmbeddingEngine;
window.RAGEngine = RAGEngine;
window.DocumentParser = DocumentParser;
window.ragEngine = new RAGEngine();
