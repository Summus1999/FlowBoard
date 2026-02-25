/**
 * FlowBoard - 面试追踪模块
 * 录音功能和面试复盘
 */

// ========================================
// IndexedDB 配置
// ========================================

const INTERVIEW_DB_NAME = 'FlowBoardInterviewDB';
const INTERVIEW_DB_VERSION = 1;
const INTERVIEW_STORE_NAME = 'recordings';

let interviewDB = null;

// 初始化 IndexedDB
function initInterviewDB() {
    return new Promise((resolve, reject) => {
        if (interviewDB) {
            resolve(interviewDB);
            return;
        }
        
        const request = indexedDB.open(INTERVIEW_DB_NAME, INTERVIEW_DB_VERSION);
        
        request.onerror = () => {
            console.error('IndexedDB 打开失败:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            interviewDB = request.result;
            console.log('IndexedDB 初始化成功');
            resolve(interviewDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(INTERVIEW_STORE_NAME)) {
                const store = db.createObjectStore(INTERVIEW_STORE_NAME, { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
            }
        };
    });
}

// 保存录音到 IndexedDB
async function saveRecordingToDB(recording) {
    try {
        const db = await initInterviewDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([INTERVIEW_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(INTERVIEW_STORE_NAME);
            
            const request = store.put(recording);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('保存录音到 IndexedDB 失败:', error);
    }
}

// 从 IndexedDB 加载所有录音
async function loadRecordingsFromDB() {
    try {
        const db = await initInterviewDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([INTERVIEW_STORE_NAME], 'readonly');
            const store = transaction.objectStore(INTERVIEW_STORE_NAME);
            
            const request = store.getAll();
            
            request.onsuccess = () => {
                const recordings = request.result || [];
                // 按日期倒序排列
                recordings.sort((a, b) => new Date(b.date) - new Date(a.date));
                // 重建 URL 对象
                recordings.forEach(rec => {
                    if (rec.blob) {
                        rec.url = URL.createObjectURL(rec.blob);
                    }
                });
                resolve(recordings);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('从 IndexedDB 加载录音失败:', error);
        return [];
    }
}

// 从 IndexedDB 删除录音
async function deleteRecordingFromDB(id) {
    try {
        const db = await initInterviewDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([INTERVIEW_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(INTERVIEW_STORE_NAME);
            
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('从 IndexedDB 删除录音失败:', error);
    }
}

// ========================================
// 全局状态
// ========================================

let interviewState = {
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    startTime: null,
    timerInterval: null,
    recordings: [],
    settings: JSON.parse(localStorage.getItem('interview_settings') || JSON.stringify({
        storagePath: '',
        quality: 'high',
        autoSave: true,
        pauseMusic: true
    }))
};

// ========================================
// 初始化
// ========================================

async function initInterview() {
    loadInterviewSettings();
    
    // 从 IndexedDB 加载录音数据
    interviewState.recordings = await loadRecordingsFromDB();
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

async function saveRecording() {
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
    
    // 保存到 IndexedDB
    await saveRecordingToDB(recording);
    
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

async function deleteRecording(id) {
    if (!confirm('确定要删除这个录音吗？')) return;
    
    const index = interviewState.recordings.findIndex(r => r.id === id);
    if (index > -1) {
        // 释放 URL 对象
        if (interviewState.recordings[index].url) {
            URL.revokeObjectURL(interviewState.recordings[index].url);
        }
        
        interviewState.recordings.splice(index, 1);
        
        // 从 IndexedDB 删除
        await deleteRecordingFromDB(id);
        
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

console.log('面试追踪模块已加载 🎙️');
