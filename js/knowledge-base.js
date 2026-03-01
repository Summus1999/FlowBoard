/**
 * FlowBoard - 知识库管理 (功能4)
 * 文档导入、索引管理、RAG 检索前端界面
 */

const KnowledgeBaseUI = {
    isInitialized: false,
    
    init() {
        if (this.isInitialized) return;
        this.bindEvents();
        this.isInitialized = true;
    },

    bindEvents() {
        // 等待页面渲染后绑定
        setTimeout(() => {
            const dropZone = document.getElementById('kbDropZone');
            const fileInput = document.getElementById('kbFileInput');
            
            if (dropZone) {
                dropZone.ondragover = (e) => {
                    e.preventDefault();
                    dropZone.classList.add('dragover');
                };
                dropZone.ondragleave = () => dropZone.classList.remove('dragover');
                dropZone.ondrop = (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('dragover');
                    this.handleFiles(e.dataTransfer.files);
                };
                dropZone.onclick = () => fileInput?.click();
            }
            
            if (fileInput) {
                fileInput.onchange = (e) => this.handleFiles(e.target.files);
            }
        }, 100);
    },

    async handleFiles(files) {
        for (const file of files) {
            try {
                showToast(`正在处理: ${file.name}...`);
                
                // 解析文档
                const content = await DocumentParser.parse(file);
                
                // 添加到知识库
                const docId = await ragEngine.addDocument({
                    fileName: file.name,
                    content,
                    fileType: file.type,
                    fileSize: file.size
                });
                
                showToast(`${file.name} 已添加到知识库`);
                this.renderDocList();
                this.updateStats();
            } catch (error) {
                console.error('[KnowledgeBase] 处理文件失败:', error);
                showToast(`处理失败: ${error.message}`);
            }
        }
    },

    async renderDocList() {
        const container = document.getElementById('kbDocList');
        if (!container) return;

        const docs = await flowboardDB.getAll('knowledgeDocs');
        docs.sort((a, b) => b.importedAt - a.importedAt);

        if (docs.length === 0) {
            container.innerHTML = `
                <div class="kb-empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>暂无文档，点击上方区域或拖拽文件导入</p>
                </div>
            `;
            return;
        }

        container.innerHTML = docs.map(doc => `
            <div class="kb-doc-item" data-id="${doc.id}">
                <div class="kb-doc-icon">
                    <i class="fas ${this.getFileIcon(doc.fileType)}"></i>
                </div>
                <div class="kb-doc-info">
                    <div class="kb-doc-name">${this.escapeHtml(doc.fileName)}</div>
                    <div class="kb-doc-meta">
                        <span>${this.formatSize(doc.fileSize)}</span>
                        <span class="kb-doc-status ${doc.status}">${this.getStatusText(doc.status)}</span>
                        <span>${doc.chunkCount || 0} 分块</span>
                    </div>
                </div>
                <div class="kb-doc-actions">
                    <button class="kb-doc-btn" onclick="KnowledgeBaseUI.previewDoc('${doc.id}')" title="预览">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="kb-doc-btn" onclick="KnowledgeBaseUI.deleteDoc('${doc.id}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    async updateStats() {
        const stats = await ragEngine.getStats();
        
        const totalEl = document.getElementById('kbStatTotal');
        const chunksEl = document.getElementById('kbStatChunks');
        
        if (totalEl) totalEl.textContent = stats.totalDocs;
        if (chunksEl) chunksEl.textContent = stats.totalChunks;
    },

    async previewDoc(docId) {
        const doc = await flowboardDB.get('knowledgeDocs', docId);
        if (!doc) return;

        // 创建预览弹窗
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'kbPreviewModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content kb-preview-modal">
                <div class="modal-header">
                    <h3>${this.escapeHtml(doc.fileName)}</h3>
                    <button class="close-btn" onclick="document.getElementById('kbPreviewModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body kb-preview-body">
                    <pre>${this.escapeHtml(doc.content.slice(0, 5000))}${doc.content.length > 5000 ? '...' : ''}</pre>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async deleteDoc(docId) {
        if (!confirm('确定删除这个文档吗？相关的向量数据也会被删除。')) return;
        
        await ragEngine.deleteDocument(docId);
        showToast('文档已删除');
        this.renderDocList();
        this.updateStats();
    },

    getFileIcon(fileType) {
        if (fileType.includes('pdf')) return 'fa-file-pdf';
        if (fileType.includes('text')) return 'fa-file-alt';
        return 'fa-file';
    },

    getStatusText(status) {
        const map = { processing: '处理中', indexed: '已索引', error: '错误' };
        return map[status] || status;
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

function initKnowledgeBase() {
    KnowledgeBaseUI.init();
    KnowledgeBaseUI.renderDocList();
    KnowledgeBaseUI.updateStats();
    
    // 初始化 RAG 引擎
    ragEngine.init().then(() => {
        console.log('[KnowledgeBase] RAG 引擎初始化完成');
    }).catch(err => {
        console.error('[KnowledgeBase] RAG 引擎初始化失败:', err);
        showToast('向量模型加载失败，知识库功能受限');
    });
}

window.KnowledgeBaseUI = KnowledgeBaseUI;
window.initKnowledgeBase = initKnowledgeBase;
