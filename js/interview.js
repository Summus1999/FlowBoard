/**
 * FlowBoard - 面试追踪模块
 * 录音功能和面试复盘
 */

// ========================================
// 全局状态
// ========================================

let interviewState = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    startTime: null,
    timerInterval: null,
    recordings: JSON.parse(localStorage.getItem('interview_recordings') || '[]'),
    settings: JSON.parse(localStorage.getItem('interview_settings') || JSON.stringify({
        storagePath: '',
        quality: 'medium',
        autoSave: true,
        pauseMusic: true
    }))
};

// ========================================
// 初始化
// ========================================

function initInterview() {
    loadInterviewSettings();
    renderInterviewList();
    
    // 请求录音权限
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                console.log('录音权限已获取');
            })
            .catch(err => {
                console.error('无法获取录音权限:', err);
                showToast('请允许麦克风权限以使用录音功能');
            });
    }
}

// ========================================
// 录音功能
// ========================================

async function toggleRecording() {
    if (interviewState.isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    try {
        // 暂停音乐（如果设置了）
        if (interviewState.settings.pauseMusic) {
            pauseAllAudio();
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 根据质量设置比特率
        const mimeType = 'audio/webm;codecs=opus';
        const options = {
            mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/webm',
            audioBitsPerSecond: getAudioBitrate()
        };
        
        interviewState.mediaRecorder = new MediaRecorder(stream, options);
        interviewState.audioChunks = [];
        
        interviewState.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                interviewState.audioChunks.push(event.data);
            }
        };
        
        interviewState.mediaRecorder.onstop = () => {
            saveRecording();
        };
        
        interviewState.mediaRecorder.start(1000); // 每秒收集数据
        interviewState.isRecording = true;
        interviewState.startTime = Date.now();
        
        // 更新 UI
        updateRecordingUI(true);
        startTimer();
        
        showToast('开始录音');
        
    } catch (error) {
        console.error('录音失败:', error);
        showToast('录音启动失败，请检查麦克风权限');
    }
}

function stopRecording() {
    if (!interviewState.mediaRecorder) return;
    
    interviewState.mediaRecorder.stop();
    interviewState.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    interviewState.isRecording = false;
    updateRecordingUI(false);
    stopTimer();
    
    showToast('录音已停止');
}

function saveRecording() {
    const audioBlob = new Blob(interviewState.audioChunks, { type: 'audio/webm' });
    const duration = Math.floor((Date.now() - interviewState.startTime) / 1000);
    
    const recording = {
        id: Date.now(),
        date: new Date().toISOString(),
        duration: duration,
        blob: audioBlob,
        url: URL.createObjectURL(audioBlob),
        notes: document.getElementById('interviewNotes').value || ''
    };
    
    interviewState.recordings.unshift(recording);
    localStorage.setItem('interview_recordings', JSON.stringify(
        interviewState.recordings.map(r => ({
            ...r,
            blob: null, // blob 不能存 localStorage
            url: null
        }))
    ));
    
    // 如果设置了自动保存到文件
    if (interviewState.settings.autoSave && interviewState.settings.storagePath) {
        downloadRecording(recording);
    }
    
    renderInterviewList();
}

function downloadRecording(recording) {
    const a = document.createElement('a');
    a.href = recording.url;
    a.download = `面试录音_${formatDateForFile(recording.date)}.webm`;
    a.click();
}

function formatDateForFile(isoString) {
    const date = new Date(isoString);
    return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}`;
}

// ========================================
// UI 更新
// ========================================

function updateRecordingUI(isRecording) {
    const btn = document.getElementById('recordBtn');
    const status = document.getElementById('recordingStatus');
    
    if (isRecording) {
        btn.classList.add('recording');
        btn.innerHTML = '<i class="fas fa-stop"></i> 停止录音';
        status.classList.add('recording');
        status.querySelector('span').textContent = '正在录音...';
    } else {
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="fas fa-circle"></i> 开始录音';
        status.classList.remove('recording');
        status.querySelector('span').textContent = '准备就绪';
        document.getElementById('recordingTimer').textContent = '00:00';
    }
}

function startTimer() {
    const timerEl = document.getElementById('recordingTimer');
    
    interviewState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - interviewState.startTime) / 1000);
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        timerEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTimer() {
    if (interviewState.timerInterval) {
        clearInterval(interviewState.timerInterval);
        interviewState.timerInterval = null;
    }
}

// ========================================
// 录音列表
// ========================================

function renderInterviewList() {
    const list = document.getElementById('interviewList');
    
    if (interviewState.recordings.length === 0) {
        list.innerHTML = `
            <div class="interview-empty">
                <i class="fas fa-microphone-slash"></i>
                <p>暂无录音记录</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = interviewState.recordings.map(rec => `
        <div class="interview-item">
            <div class="interview-item-header">
                <span class="interview-item-title">面试录音</span>
                <span class="interview-item-duration">${formatDuration(rec.duration)}</span>
            </div>
            <div class="interview-item-date">${formatDate(rec.date)}</div>
            <div class="interview-item-actions">
                <button class="btn-secondary btn-sm" onclick="playRecording(${rec.id})">
                    <i class="fas fa-play"></i> 播放
                </button>
                <button class="btn-secondary btn-sm" onclick="downloadRecordingById(${rec.id})">
                    <i class="fas fa-download"></i> 下载
                </button>
                <button class="btn-icon btn-danger" onclick="deleteRecording(${rec.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function formatDuration(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function playRecording(id) {
    const recording = interviewState.recordings.find(r => r.id === id);
    if (!recording || !recording.url) {
        showToast('录音无法播放');
        return;
    }
    
    const audio = new Audio(recording.url);
    audio.play();
    
    showToast('开始播放');
}

function downloadRecordingById(id) {
    const recording = interviewState.recordings.find(r => r.id === id);
    if (!recording) return;
    
    downloadRecording(recording);
}

function deleteRecording(id) {
    if (!confirm('确定要删除这个录音吗？')) return;
    
    const index = interviewState.recordings.findIndex(r => r.id === id);
    if (index > -1) {
        // 释放 URL 对象
        if (interviewState.recordings[index].url) {
            URL.revokeObjectURL(interviewState.recordings[index].url);
        }
        
        interviewState.recordings.splice(index, 1);
        localStorage.setItem('interview_recordings', JSON.stringify(
            interviewState.recordings.map(r => ({ ...r, blob: null, url: null }))
        ));
        
        renderInterviewList();
        showToast('录音已删除');
    }
}

// ========================================
// 设置功能
// ========================================

function openInterviewSettingsModal() {
    document.getElementById('interviewSettingsModal').classList.add('active');
    loadInterviewSettingsToForm();
}

function closeInterviewSettingsModal() {
    document.getElementById('interviewSettingsModal').classList.remove('active');
}

function loadInterviewSettings() {
    const stored = localStorage.getItem('interview_settings');
    if (stored) {
        interviewState.settings = JSON.parse(stored);
    }
}

function loadInterviewSettingsToForm() {
    document.getElementById('interviewStoragePath').value = interviewState.settings.storagePath;
    document.getElementById('interviewAudioQuality').value = interviewState.settings.quality;
    document.getElementById('interviewAutoSaveToggle').checked = interviewState.settings.autoSave;
    document.getElementById('interviewPauseMusicToggle').checked = interviewState.settings.pauseMusic;
}

function selectInterviewStoragePath() {
    // 创建文件输入来模拟选择目录（实际 Electron 中可以使用 dialog API）
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.directory = true;
    
    input.onchange = (e) => {
        if (e.target.files.length > 0) {
            const path = e.target.files[0].path || e.target.files[0].webkitRelativePath;
            document.getElementById('interviewStoragePath').value = path;
        }
    };
    
    input.click();
}

function saveInterviewSettings() {
    interviewState.settings = {
        storagePath: document.getElementById('interviewStoragePath').value,
        quality: document.getElementById('interviewAudioQuality').value,
        autoSave: document.getElementById('interviewAutoSaveToggle').checked,
        pauseMusic: document.getElementById('interviewPauseMusicToggle').checked
    };
    
    localStorage.setItem('interview_settings', JSON.stringify(interviewState.settings));
    
    showToast('设置已保存');
    closeInterviewSettingsModal();
}

// ========================================
// 工具函数
// ========================================

function getAudioBitrate() {
    const qualityMap = {
        high: 320000,
        medium: 128000,
        low: 64000
    };
    return qualityMap[interviewState.settings.quality] || 128000;
}

function pauseAllAudio() {
    // 暂停页面中所有音频
    document.querySelectorAll('audio, video').forEach(media => {
        media.pause();
    });
}

// ========================================
// 页面切换初始化
// ========================================

const originalShowPage5 = window.showPage;
if (originalShowPage5) {
    window.showPage = function(pageName) {
        originalShowPage5(pageName);
        if (pageName === 'interview') {
            setTimeout(initInterview, 100);
        }
    };
}

console.log('面试追踪模块已加载 🎙️');
