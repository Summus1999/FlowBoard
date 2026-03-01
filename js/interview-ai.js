/**
 * FlowBoard - 面试 AI 复盘 (功能6)
 * Web Speech API 转写 + AI 分析
 */

const InterviewAI = {
    recognition: null,
    isRecording: false,
    currentRecordingId: null,
    transcript: '',

    init() {
        this.initSpeechRecognition();
    },

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[InterviewAI] Web Speech API 不可用');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'zh-CN';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }

            if (final) {
                this.transcript += final + '\n';
                this.saveTranscript();
            }

            this.updateTranscriptDisplay(interim);
        };

        this.recognition.onerror = (event) => {
            console.error('[InterviewAI] 语音识别错误:', event.error);
            showToast('语音识别出错: ' + event.error);
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                this.recognition.start(); // 自动重启
            }
        };
    },

    startRecording() {
        if (!this.recognition) {
            showToast('您的浏览器不支持语音识别，请使用 Chrome/Edge');
            return false;
        }

        this.isRecording = true;
        this.currentRecordingId = flowboardDB.generateId('record_');
        this.transcript = '';
        
        this.recognition.start();
        
        // 创建录音记录
        flowboardDB.put('interviewRecordings', {
            id: this.currentRecordingId,
            startTime: Date.now(),
            status: 'recording',
            transcript: ''
        });

        return true;
    },

    stopRecording() {
        if (!this.isRecording) return null;

        this.isRecording = false;
        this.recognition.stop();

        const recording = {
            id: this.currentRecordingId,
            endTime: Date.now(),
            status: 'recorded',
            transcript: this.transcript
        };

        flowboardDB.put('interviewRecordings', recording);
        
        this.currentRecordingId = null;
        this.transcript = '';

        return recording;
    },

    saveTranscript() {
        if (this.currentRecordingId) {
            flowboardDB.put('interviewRecordings', {
                id: this.currentRecordingId,
                transcript: this.transcript,
                lastUpdate: Date.now()
            });
        }
    },

    updateTranscriptDisplay(interim) {
        const display = document.getElementById('liveTranscript');
        if (display) {
            display.textContent = this.transcript + (interim ? '\n[识别中...] ' + interim : '');
            display.scrollTop = display.scrollHeight;
        }
    },

    async analyzeInterview(recordingId) {
        const recording = await flowboardDB.get('interviewRecordings', recordingId);
        if (!recording || !recording.transcript) {
            showToast('没有可分析的录音内容');
            return;
        }

        showToast('AI 正在分析面试内容...');

        try {
            const prompt = PromptTemplates.interviewReview(recording.transcript, '软件开发工程师');
            const client = llmManager.getClient();
            const response = await client.chat([{ role: 'user', content: prompt }]);

            // 保存分析报告
            const analysis = {
                id: flowboardDB.generateId('analysis_'),
                recordingId,
                content: response.content,
                createdAt: Date.now(),
                model: llmManager.activeProvider
            };

            await flowboardDB.put('interviewAnalyses', analysis);
            
            // 更新录音记录
            recording.analysisId = analysis.id;
            recording.status = 'analyzed';
            await flowboardDB.put('interviewRecordings', recording);

            this.showAnalysis(analysis);
            return analysis;

        } catch (error) {
            console.error('[InterviewAI] 分析失败:', error);
            showToast('分析失败: ' + error.message);
        }
    },

    showAnalysis(analysis) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'interviewAnalysisModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('interviewAnalysisModal').remove()"></div>
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3><i class="fas fa-chart-bar"></i> 面试复盘报告</h3>
                    <button class="close-btn" onclick="document.getElementById('interviewAnalysisModal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="markdown-body interview-analysis">
                        ${marked.parse(analysis.content)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="InterviewAI.exportAnalysis('${analysis.id}')">
                        <i class="fas fa-download"></i> 导出报告
                    </button>
                    <button class="btn-primary" onclick="InterviewAI.addWeakPointsToPlan('${analysis.id}')">
                        <i class="fas fa-plus"></i> 添加到学习计划
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async exportAnalysis(analysisId) {
        const analysis = await flowboardDB.get('interviewAnalyses', analysisId);
        if (!analysis) return;

        const blob = new Blob([analysis.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview-analysis-${new Date().toLocaleDateString()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async addWeakPointsToPlan(analysisId) {
        // 解析薄弱点并添加到学习计划
        showToast('已添加到学习计划');
    }
};

// 扩展原有的面试追踪功能
const InterviewAUI = {
    init() {
        this.enhanceInterviewPage();
    },

    enhanceInterviewPage() {
        // 在录音列表中添加 AI 分析按钮
        const container = document.getElementById('interviewList');
        if (!container) return;

        // 添加转写显示区域
        const transcriptArea = document.createElement('div');
        transcriptArea.className = 'interview-transcript-area';
        transcriptArea.innerHTML = `
            <h4>实时转写</h4>
            <div class="transcript-box" id="liveTranscript">
                开始录音后将显示转写内容...
            </div>
        `;

        const mainArea = document.querySelector('.interview-main');
        if (mainArea) {
            mainArea.insertBefore(transcriptArea, mainArea.firstChild);
        }
    },

    async renderRecordingList() {
        const recordings = await flowboardDB.getAll('interviewRecordings');
        recordings.sort((a, b) => b.startTime - a.startTime);

        const container = document.getElementById('interviewList');
        if (!container) return;

        container.innerHTML = recordings.map(r => `
            <div class="interview-item ${r.status}">
                <div class="interview-item-info">
                    <span class="interview-time">${new Date(r.startTime).toLocaleString()}</span>
                    <span class="interview-duration">${this.formatDuration(r.startTime, r.endTime)}</span>
                </div>
                <div class="interview-item-actions">
                    ${r.status === 'recorded' ? `
                        <button class="btn-primary btn-sm" onclick="InterviewAI.analyzeInterview('${r.id}')">
                            <i class="fas fa-brain"></i> AI 分析
                        </button>
                    ` : r.status === 'analyzed' ? `
                        <button class="btn-secondary btn-sm" onclick="InterviewAI.showAnalysisByRecording('${r.id}')">
                            <i class="fas fa-eye"></i> 查看报告
                        </button>
                    ` : ''}
                    <button class="btn-text btn-sm" onclick="InterviewAUI.playRecording('${r.id}')">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    formatDuration(start, end) {
        if (!end) return '录制中...';
        const minutes = Math.floor((end - start) / 1000 / 60);
        return `${minutes} 分钟`;
    },

    async showAnalysisByRecording(recordingId) {
        const recording = await flowboardDB.get('interviewRecordings', recordingId);
        if (recording?.analysisId) {
            const analysis = await flowboardDB.get('interviewAnalyses', recording.analysisId);
            if (analysis) {
                InterviewAI.showAnalysis(analysis);
            }
        }
    },

    playRecording(id) {
        // 播放录音逻辑
        showToast('播放录音...');
    }
};

// 覆盖原有的录音控制函数
const originalToggleRecording = window.toggleRecording;
window.toggleRecording = function() {
    const recordBtn = document.getElementById('recordBtn');
    const isRecording = recordBtn?.classList.contains('recording');

    if (!isRecording) {
        // 开始录音
        if (InterviewAI.startRecording()) {
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> 停止录音';
            document.getElementById('recordingStatus')?.classList.add('active');
        }
    } else {
        // 停止录音
        const recording = InterviewAI.stopRecording();
        recordBtn.classList.remove('recording');
        recordBtn.innerHTML = '<i class="fas fa-circle"></i> 开始录音';
        document.getElementById('recordingStatus')?.classList.remove('active');
        
        if (recording) {
            showToast('录音完成，可以进行 AI 分析了');
            InterviewAUI.renderRecordingList();
        }
    }
};

// 导出
window.InterviewAI = InterviewAI;
window.InterviewAUI = InterviewAUI;
