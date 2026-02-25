/**
 * FlowBoard - App Center module
 */

const APP_CENTER_STORAGE_KEY = 'flowboard_apps';
const APP_CENTER_STORAGE_VERSION = 2;
const APP_ORDER_STEP = 10;
const ICON_UPLOAD_MAX_FILE_BYTES = 300 * 1024;
const ICON_UPLOAD_MAX_RESULT_BYTES = 50 * 1024;
const ICON_IMAGE_MAX_EDGE = 128;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

const iconOptions = [
    { icon: 'fas fa-desktop', name: '桌面', color: '#3b82f6' },
    { icon: 'fas fa-code', name: '代码', color: '#22c55e' },
    { icon: 'fas fa-folder', name: '文件夹', color: '#f59e0b' },
    { icon: 'fas fa-globe', name: '浏览器', color: '#06b6d4' },
    { icon: 'fas fa-music', name: '音乐', color: '#ec4899' },
    { icon: 'fas fa-video', name: '视频', color: '#ef4444' },
    { icon: 'fas fa-gamepad', name: '游戏', color: '#8b5cf6' },
    { icon: 'fas fa-comments', name: '聊天', color: '#10b981' },
    { icon: 'fas fa-envelope', name: '邮件', color: '#6366f1' },
    { icon: 'fas fa-camera', name: '图像', color: '#f97316' },
    { icon: 'fas fa-terminal', name: '终端', color: '#64748b' },
    { icon: 'fas fa-database', name: '数据库', color: '#0ea5e9' },
    { icon: 'fas fa-paint-brush', name: '设计', color: '#d946ef' },
    { icon: 'fas fa-file-alt', name: '文档', color: '#14b8a6' },
    { icon: 'fas fa-cog', name: '工具', color: '#78716c' },
    { icon: 'fas fa-robot', name: 'AI应用', color: '#10a37f' },
    { icon: 'fas fa-brain', name: 'AI智能', color: '#7c3aed' },
    { icon: 'fas fa-sparkles', name: 'AI助手', color: '#f59e0b' },
    { icon: 'fab fa-chrome', name: 'Chrome', color: '#4285f4' },
    { icon: 'fab fa-firefox', name: 'Firefox', color: '#ff7139' },
    { icon: 'fab fa-edge', name: 'Edge', color: '#0078d7' },
    { icon: 'fab fa-weixin', name: '微信', color: '#07c160' },
    { icon: 'fab fa-qq', name: 'QQ', color: '#12b7f5' },
    { icon: 'fab fa-github', name: 'GitHub', color: '#333333' },
    { icon: 'fab fa-steam', name: 'Steam', color: '#1b2838' }
];

let editingAppId = null;
let isReorderMode = false;
let appCenterBootstrapped = false;
let currentIconMeta = getDefaultIconMeta();
let dragState = {
    draggingId: '',
    dropTargetId: '',
    dropBefore: true
};

function toast(message) {
    if (typeof window.showToast === 'function') {
        window.showToast(message);
    }
}

function createEmptyAppsState() {
    return {
        version: APP_CENTER_STORAGE_VERSION,
        apps: []
    };
}

function getNowIso() {
    return new Date().toISOString();
}

function getDefaultIconMeta() {
    const first = iconOptions[0] || { icon: 'fas fa-desktop', color: '#3b82f6' };
    return {
        mode: 'preset',
        presetClass: first.icon,
        emoji: '',
        imageDataUrl: '',
        bgColor: first.color,
        fgColor: '#ffffff'
    };
}

function toFiniteNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function isHexColor(value) {
    return /^#[0-9a-f]{3,8}$/i.test(String(value || '').trim());
}

function sanitizeColor(value, fallback) {
    return isHexColor(value) ? String(value).trim() : fallback;
}

function sanitizeIconClass(iconClass) {
    const fallback = getDefaultIconMeta().presetClass;
    const raw = String(iconClass || '').trim();
    return /^[a-z0-9\- ]+$/i.test(raw) ? raw : fallback;
}

function normalizeIsoTime(value, fallback) {
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? new Date(ts).toISOString() : fallback;
}

function extractFirstGrapheme(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
        for (const item of segmenter.segment(text)) {
            if (item.segment && item.segment.trim()) {
                return item.segment;
            }
        }
    }

    const fallback = Array.from(text);
    return fallback.length > 0 ? fallback[0] : '';
}

function isValidImageDataUrl(value) {
    return /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(value || '').trim());
}

function normalizeIconMeta(iconMeta) {
    const defaults = getDefaultIconMeta();
    if (!iconMeta || typeof iconMeta !== 'object') {
        return defaults;
    }

    const mode = ['preset', 'emoji', 'image'].includes(iconMeta.mode)
        ? iconMeta.mode
        : 'preset';
    const presetClass = sanitizeIconClass(iconMeta.presetClass || iconMeta.icon || defaults.presetClass);
    const emoji = extractFirstGrapheme(iconMeta.emoji);
    const imageDataUrl = isValidImageDataUrl(iconMeta.imageDataUrl) ? String(iconMeta.imageDataUrl) : '';
    const bgColor = sanitizeColor(iconMeta.bgColor, defaults.bgColor);
    const fgColor = sanitizeColor(iconMeta.fgColor, defaults.fgColor);

    return {
        mode,
        presetClass,
        emoji,
        imageDataUrl,
        bgColor,
        fgColor
    };
}

function normalizeStoredIconMeta(iconMeta) {
    const normalized = normalizeIconMeta(iconMeta);
    if (normalized.mode === 'emoji' && !normalized.emoji) {
        return { ...normalized, mode: 'preset' };
    }
    if (normalized.mode === 'image' && !normalized.imageDataUrl) {
        return { ...normalized, mode: 'preset' };
    }
    return normalized;
}

function normalizeAppRecord(app, index = 0) {
    if (!app || typeof app !== 'object') return null;

    const id = String(app.id || `app_${Date.now()}_${index}`).trim();
    const name = String(app.name || '').trim();
    const appPath = String(app.path || '').trim();
    if (!id || !name || !appPath) return null;

    const now = getNowIso();
    const createdAt = normalizeIsoTime(app.createdAt, now);
    const updatedAt = normalizeIsoTime(app.updatedAt, createdAt);
    const order = toFiniteNumber(app.order, (index + 1) * APP_ORDER_STEP);
    const iconMeta = app.iconMeta
        ? normalizeStoredIconMeta(app.iconMeta)
        : normalizeStoredIconMeta({
            mode: 'preset',
            presetClass: app.icon,
            bgColor: app.color
        });

    return {
        id,
        name,
        path: appPath,
        order,
        iconMeta,
        createdAt,
        updatedAt
    };
}

function sortAppsByOrder(apps) {
    return [...apps].sort((left, right) => {
        if (left.order !== right.order) {
            return left.order - right.order;
        }
        return left.createdAt.localeCompare(right.createdAt);
    });
}

function resequenceApps(apps, updatedAppId = '') {
    const now = getNowIso();
    return sortAppsByOrder(apps).map((app, index) => ({
        ...app,
        order: (index + 1) * APP_ORDER_STEP,
        updatedAt: app.id === updatedAppId ? now : app.updatedAt
    }));
}

function migrateLegacyApps(legacyApps) {
    const now = getNowIso();
    const apps = legacyApps
        .map((app, index) => normalizeAppRecord({
            ...app,
            order: (index + 1) * APP_ORDER_STEP,
            createdAt: app?.createdAt || now,
            updatedAt: app?.updatedAt || now
        }, index))
        .filter(Boolean);

    return {
        version: APP_CENTER_STORAGE_VERSION,
        apps: resequenceApps(apps)
    };
}

function saveAppsState(state) {
    try {
        const apps = Array.isArray(state?.apps) ? state.apps : [];
        const payload = {
            version: APP_CENTER_STORAGE_VERSION,
            apps
        };
        localStorage.setItem(APP_CENTER_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error('保存应用数据失败:', error);
    }
}

function loadAppsState() {
    try {
        const raw = localStorage.getItem(APP_CENTER_STORAGE_KEY);
        if (!raw) return createEmptyAppsState();

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const migratedState = migrateLegacyApps(parsed);
            saveAppsState(migratedState);
            return migratedState;
        }

        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.apps)) {
            return createEmptyAppsState();
        }

        const normalizedApps = parsed.apps
            .map((app, index) => normalizeAppRecord(app, index))
            .filter(Boolean);
        const state = {
            version: APP_CENTER_STORAGE_VERSION,
            apps: resequenceApps(normalizedApps)
        };

        const shouldPersist = parsed.version !== APP_CENTER_STORAGE_VERSION
            || normalizedApps.length !== parsed.apps.length;
        if (shouldPersist) {
            saveAppsState(state);
        }

        return state;
    } catch (error) {
        console.error('加载应用数据失败:', error);
        return createEmptyAppsState();
    }
}

function getAppsSorted() {
    return sortAppsByOrder(loadAppsState().apps);
}

function getFileName(path) {
    if (!path) return '';
    return path.split(/[\\\/]/).pop() || path;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function renderAppIcon(iconMeta) {
    const meta = normalizeIconMeta(iconMeta);
    if (meta.mode === 'image' && meta.imageDataUrl) {
        return `
            <div class="app-icon" style="background: var(--bg-primary);">
                <img class="app-icon-image" src="${meta.imageDataUrl}" alt="应用图标">
            </div>
        `;
    }

    if (meta.mode === 'emoji' && meta.emoji) {
        return `
            <div class="app-icon" style="background: ${meta.bgColor}; color: ${meta.fgColor};">
                <span class="app-icon-emoji">${escapeHtml(meta.emoji)}</span>
            </div>
        `;
    }

    return `
        <div class="app-icon" style="background: ${meta.bgColor}; color: ${meta.fgColor};">
            <i class="${escapeHtml(meta.presetClass)}"></i>
        </div>
    `;
}

function updateReorderToggleButton() {
    const button = document.getElementById('toggleAppsReorderBtn');
    if (!button) return;

    button.classList.toggle('active', isReorderMode);
    button.innerHTML = isReorderMode
        ? '<i class="fas fa-check"></i> 完成排序'
        : '<i class="fas fa-up-down-left-right"></i> 排序模式';
}

function renderApps() {
    const container = document.getElementById('appsGrid');
    if (!container) return;

    updateReorderToggleButton();
    const apps = getAppsSorted();

    if (apps.length === 0) {
        container.innerHTML = `
            <div class="apps-empty">
                <i class="fas fa-cube"></i>
                <h3>还没有添加应用</h3>
                <p>点击右上角的"添加应用"按钮来添加你常用的本地软件</p>
            </div>
        `;
        clearDragState();
        return;
    }

    container.innerHTML = apps.map((app) => `
        <div class="app-card${isReorderMode ? ' reorder-enabled' : ''}" data-id="${escapeHtml(app.id)}" ${isReorderMode ? 'draggable="true"' : ''}>
            ${isReorderMode ? '<span class="app-drag-handle" title="拖动排序"><i class="fas fa-grip-vertical"></i></span>' : ''}
            ${renderAppIcon(app.iconMeta)}
            <span class="app-name">${escapeHtml(app.name)}</span>
            <span class="app-desc" title="${escapeHtml(app.path)}">${escapeHtml(getFileName(app.path))}</span>
            <div class="app-actions">
                <button class="app-action-btn" data-action="launch" title="启动">
                    <i class="fas fa-play"></i>
                </button>
                <button class="app-action-btn" data-action="edit" title="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="app-action-btn delete" data-action="delete" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    bindAppCardEvents();
    if (isReorderMode) {
        bindAppsDragEvents();
    } else {
        clearDragState();
    }
}

function bindAppCardEvents() {
    const cards = document.querySelectorAll('#appsGrid .app-card[data-id]');
    cards.forEach((card) => {
        card.addEventListener('dblclick', handleAppCardDoubleClick);
        const actionButtons = card.querySelectorAll('.app-action-btn[data-action]');
        actionButtons.forEach((button) => {
            button.addEventListener('click', handleAppActionClick);
        });
    });
}

function handleAppCardDoubleClick(event) {
    if (isReorderMode) return;
    const appId = event.currentTarget?.dataset?.id;
    if (!appId) return;
    launchApp(appId);
}

function handleAppActionClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const action = event.currentTarget?.dataset?.action;
    const appCard = event.currentTarget?.closest('.app-card[data-id]');
    const appId = appCard?.dataset?.id;
    if (!action || !appId) return;

    if (action === 'launch') {
        launchApp(appId);
        return;
    }
    if (action === 'edit') {
        editApp(appId);
        return;
    }
    if (action === 'delete') {
        deleteApp(appId);
    }
}

function clearDropIndicators() {
    document.querySelectorAll('#appsGrid .app-card.drop-before, #appsGrid .app-card.drop-after')
        .forEach((card) => {
            card.classList.remove('drop-before', 'drop-after');
        });
}

function clearDragState() {
    document.querySelectorAll('#appsGrid .app-card.dragging')
        .forEach((card) => card.classList.remove('dragging'));
    clearDropIndicators();
    dragState = {
        draggingId: '',
        dropTargetId: '',
        dropBefore: true
    };
}

function shouldDropBefore(event, targetCard) {
    const rect = targetCard.getBoundingClientRect();
    const pointerY = event.clientY - rect.top;
    return pointerY < rect.height / 2;
}

function setDropIndicator(targetCard, dropBefore) {
    clearDropIndicators();
    targetCard.classList.add(dropBefore ? 'drop-before' : 'drop-after');
    dragState.dropTargetId = targetCard.dataset.id || '';
    dragState.dropBefore = dropBefore;
}

function bindAppsDragEvents() {
    const cards = document.querySelectorAll('#appsGrid .app-card[data-id]');
    cards.forEach((card) => {
        card.addEventListener('dragstart', handleCardDragStart);
        card.addEventListener('dragover', handleCardDragOver);
        card.addEventListener('drop', handleCardDrop);
        card.addEventListener('dragend', clearDragState);
    });
}

function handleCardDragStart(event) {
    if (!isReorderMode) {
        event.preventDefault();
        return;
    }

    if (event.target?.closest('.app-action-btn')) {
        event.preventDefault();
        return;
    }

    const appId = event.currentTarget?.dataset?.id;
    if (!appId) {
        event.preventDefault();
        return;
    }

    dragState.draggingId = appId;
    event.currentTarget.classList.add('dragging');

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', appId);
    }
}

function handleCardDragOver(event) {
    if (!isReorderMode) return;

    const targetCard = event.currentTarget;
    const targetId = targetCard?.dataset?.id;
    if (!targetId || targetId === dragState.draggingId) return;

    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }

    const dropBefore = shouldDropBefore(event, targetCard);
    setDropIndicator(targetCard, dropBefore);
}

function handleCardDrop(event) {
    if (!isReorderMode) return;
    event.preventDefault();

    const targetId = event.currentTarget?.dataset?.id || '';
    const sourceId = (event.dataTransfer?.getData('text/plain') || dragState.draggingId || '').trim();
    if (!sourceId || !targetId || sourceId === targetId) {
        clearDragState();
        return;
    }

    const dropBefore = shouldDropBefore(event, event.currentTarget);
    const changed = reorderApps(sourceId, targetId, dropBefore);
    clearDragState();

    if (changed) {
        toast('应用顺序已更新');
    }
}

function reorderApps(sourceId, targetId, dropBefore) {
    const apps = getAppsSorted();
    const originalIds = apps.map((app) => app.id);

    const sourceIndex = apps.findIndex((app) => app.id === sourceId);
    const targetIndex = apps.findIndex((app) => app.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return false;

    const [movedApp] = apps.splice(sourceIndex, 1);
    const nextTargetIndex = apps.findIndex((app) => app.id === targetId);
    if (nextTargetIndex < 0) return false;

    const insertIndex = dropBefore ? nextTargetIndex : nextTargetIndex + 1;
    apps.splice(insertIndex, 0, movedApp);

    const nextIds = apps.map((app) => app.id);
    const changed = originalIds.some((id, index) => id !== nextIds[index]);
    if (!changed) return false;

    const now = getNowIso();
    const updatedApps = apps.map((app, index) => ({
        ...app,
        order: (index + 1) * APP_ORDER_STEP,
        updatedAt: app.id === movedApp.id ? now : app.updatedAt
    }));
    saveAppsState({
        version: APP_CENTER_STORAGE_VERSION,
        apps: updatedApps
    });

    renderApps();
    return true;
}

function renderIconSelector() {
    const container = document.getElementById('iconSelector');
    if (!container) return;

    container.innerHTML = iconOptions.map((option) => `
        <button class="icon-option" type="button" data-icon="${escapeHtml(option.icon)}" data-color="${escapeHtml(option.color)}" title="${escapeHtml(option.name)}">
            <i class="${escapeHtml(option.icon)}" style="color: ${escapeHtml(option.color)};"></i>
        </button>
    `).join('');

    container.querySelectorAll('.icon-option').forEach((button) => {
        button.addEventListener('click', () => {
            selectPresetIcon(button.dataset.icon || '', button.dataset.color || '');
        });
    });

    updatePresetIconSelection();
}

function updatePresetIconSelection() {
    const activeClass = currentIconMeta.presetClass;
    document.querySelectorAll('#iconSelector .icon-option').forEach((item) => {
        item.classList.toggle('selected', item.dataset.icon === activeClass);
    });
}

function updateIconModeUI() {
    const mode = currentIconMeta.mode;
    document.querySelectorAll('#iconModeTabs .icon-mode-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const panelMap = {
        preset: 'iconModePanelPreset',
        emoji: 'iconModePanelEmoji',
        image: 'iconModePanelImage'
    };

    Object.entries(panelMap).forEach(([panelMode, panelId]) => {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        panel.classList.toggle('active', panelMode === mode);
    });
}

function updateSelectedIconPreview() {
    const preview = document.getElementById('selectedIconPreview');
    if (!preview) return;

    const meta = normalizeIconMeta(currentIconMeta);
    currentIconMeta = meta;

    preview.dataset.mode = meta.mode;
    preview.style.background = meta.mode === 'image' ? 'var(--bg-primary)' : meta.bgColor;
    preview.style.color = meta.fgColor;

    if (meta.mode === 'image' && meta.imageDataUrl) {
        preview.innerHTML = `<img src="${meta.imageDataUrl}" alt="图标预览">`;
        return;
    }

    if (meta.mode === 'emoji') {
        preview.innerHTML = `<span class="app-icon-emoji">${escapeHtml(meta.emoji || '🙂')}</span>`;
        return;
    }

    preview.innerHTML = `<i class="${escapeHtml(meta.presetClass)}"></i>`;
}

function applyIconMetaToForm(iconMeta) {
    currentIconMeta = normalizeIconMeta(iconMeta);
    const emojiInput = document.getElementById('iconEmojiInput');
    if (emojiInput) {
        emojiInput.value = currentIconMeta.emoji || '';
    }
    updateIconModeUI();
    updatePresetIconSelection();
    updateSelectedIconPreview();
}

function setIconMode(mode) {
    if (!['preset', 'emoji', 'image'].includes(mode)) return;
    currentIconMeta = normalizeIconMeta({
        ...currentIconMeta,
        mode
    });
    updateIconModeUI();
    updateSelectedIconPreview();
}

function selectPresetIcon(iconClass, color) {
    currentIconMeta = normalizeIconMeta({
        ...currentIconMeta,
        mode: 'preset',
        presetClass: iconClass,
        bgColor: color || currentIconMeta.bgColor
    });
    updatePresetIconSelection();
    updateSelectedIconPreview();
    updateIconModeUI();
}

function handleEmojiInput(event) {
    const rawValue = event?.target?.value || '';
    const emoji = extractFirstGrapheme(rawValue);
    if (event?.target) {
        event.target.value = emoji;
    }

    currentIconMeta = normalizeIconMeta({
        ...currentIconMeta,
        mode: 'emoji',
        emoji
    });
    updateSelectedIconPreview();
    updateIconModeUI();
}

function hasAllowedFileExtension(fileName) {
    const name = String(fileName || '').trim();
    const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    return ALLOWED_IMAGE_EXTENSIONS.has(extension);
}

function getDataUrlBytes(dataUrl) {
    const normalized = String(dataUrl || '');
    const base64Payload = normalized.includes(',') ? normalized.split(',')[1] : normalized;
    return Math.ceil((base64Payload.length * 3) / 4);
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
    });
}

function loadImageFromUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('解析图片失败'));
        image.src = dataUrl;
    });
}

async function compressIconImage(file) {
    const sourceDataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromUrl(sourceDataUrl);

    const maxEdge = Math.max(image.width, image.height);
    const scale = maxEdge > ICON_IMAGE_MAX_EDGE ? (ICON_IMAGE_MAX_EDGE / maxEdge) : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('当前环境不支持图片处理');
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const qualityCandidates = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];
    for (const quality of qualityCandidates) {
        const compressed = canvas.toDataURL('image/webp', quality);
        if (getDataUrlBytes(compressed) <= ICON_UPLOAD_MAX_RESULT_BYTES) {
            return compressed;
        }
    }

    throw new Error('图片压缩后仍超过限制，请更换更小图片');
}

function triggerIconImageSelect() {
    document.getElementById('iconImageInput')?.click();
}

function clearIconImage() {
    currentIconMeta = normalizeIconMeta({
        ...currentIconMeta,
        mode: 'preset',
        imageDataUrl: ''
    });
    updateIconModeUI();
    updateSelectedIconPreview();
}

async function handleIconImageUpload(event) {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file) return;

    const mimeAllowed = ALLOWED_IMAGE_MIME_TYPES.has(file.type);
    const extAllowed = hasAllowedFileExtension(file.name);
    if (!mimeAllowed && !extAllowed) {
        toast('图片格式不支持，仅允许 png/jpg/jpeg/webp');
        input.value = '';
        return;
    }

    if (file.size > ICON_UPLOAD_MAX_FILE_BYTES) {
        toast('图片过大，请选择小于 300KB 的图片');
        input.value = '';
        return;
    }

    try {
        const compressedDataUrl = await compressIconImage(file);
        if (!isValidImageDataUrl(compressedDataUrl)) {
            throw new Error('图片处理结果无效');
        }

        currentIconMeta = normalizeIconMeta({
            ...currentIconMeta,
            mode: 'image',
            imageDataUrl: compressedDataUrl
        });
        updateIconModeUI();
        updateSelectedIconPreview();
    } catch (error) {
        toast(error.message || '图片处理失败');
    } finally {
        input.value = '';
    }
}

function openAddAppModal() {
    editingAppId = null;
    document.getElementById('addAppModalTitle').textContent = '添加应用';
    document.getElementById('appName').value = '';
    document.getElementById('appPath').value = '';
    renderIconSelector();
    applyIconMetaToForm(getDefaultIconMeta());
    setIconMode('preset');
    document.getElementById('addAppModal').classList.add('active');
}

function editApp(appId) {
    const app = getAppsSorted().find((item) => item.id === appId);
    if (!app) {
        toast('应用不存在');
        return;
    }

    editingAppId = appId;
    document.getElementById('addAppModalTitle').textContent = '编辑应用';
    document.getElementById('appName').value = app.name;
    document.getElementById('appPath').value = app.path;
    renderIconSelector();
    applyIconMetaToForm(app.iconMeta);
    document.getElementById('addAppModal').classList.add('active');
}

function closeAddAppModal() {
    document.getElementById('addAppModal').classList.remove('active');
    editingAppId = null;
}

async function selectAppFile() {
    if (window.electronAPI && window.electronAPI.selectFile) {
        try {
            const result = await window.electronAPI.selectFile({
                title: '选择应用程序',
                filters: [
                    { name: '可执行文件', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
                    { name: '所有文件', extensions: ['*'] }
                ],
                properties: ['openFile']
            });

            if (!result.canceled && result.filePaths && result.filePaths[0]) {
                document.getElementById('appPath').value = result.filePaths[0];
                const nameInput = document.getElementById('appName');
                if (!nameInput.value) {
                    const fileName = getFileName(result.filePaths[0]);
                    nameInput.value = fileName.replace(/\.[^.]+$/, '');
                }
            }
        } catch (error) {
            console.error('选择文件失败:', error);
            toast('选择文件失败');
        }
    } else {
        toast('请在桌面应用中使用此功能');
    }
}

function saveApp() {
    const name = document.getElementById('appName').value.trim();
    const appPath = document.getElementById('appPath').value.trim();
    const iconMeta = normalizeIconMeta(currentIconMeta);
    const isEditing = Boolean(editingAppId);

    if (!name) {
        toast('请输入应用名称');
        return;
    }
    if (!appPath) {
        toast('请选择应用程序路径');
        return;
    }
    if (iconMeta.mode === 'emoji' && !iconMeta.emoji) {
        toast('请输入一个 Emoji 图标');
        return;
    }
    if (iconMeta.mode === 'image' && !iconMeta.imageDataUrl) {
        toast('请先上传图片图标');
        return;
    }

    const apps = getAppsSorted();
    const now = getNowIso();

    if (isEditing) {
        const index = apps.findIndex((app) => app.id === editingAppId);
        if (index < 0) {
            toast('应用不存在');
            return;
        }

        apps[index] = {
            ...apps[index],
            name,
            path: appPath,
            iconMeta: normalizeStoredIconMeta(iconMeta),
            updatedAt: now
        };
    } else {
        const maxOrder = apps.reduce((max, app) => Math.max(max, toFiniteNumber(app.order, 0)), 0);
        apps.push({
            id: `app_${Date.now()}`,
            name,
            path: appPath,
            order: maxOrder + APP_ORDER_STEP,
            iconMeta: normalizeStoredIconMeta(iconMeta),
            createdAt: now,
            updatedAt: now
        });
    }

    saveAppsState({
        version: APP_CENTER_STORAGE_VERSION,
        apps: resequenceApps(apps, isEditing ? editingAppId : '')
    });

    renderApps();
    closeAddAppModal();
    toast(isEditing ? '应用已更新' : '应用已添加');
}

function deleteApp(appId) {
    if (!confirm('确定要删除这个应用吗？')) return;

    const apps = getAppsSorted();
    const nextApps = apps.filter((app) => app.id !== appId);
    saveAppsState({
        version: APP_CENTER_STORAGE_VERSION,
        apps: resequenceApps(nextApps)
    });
    renderApps();
    toast('应用已删除');
}

async function launchApp(appId) {
    const app = getAppsSorted().find((item) => item.id === appId);
    if (!app) {
        toast('应用不存在');
        return;
    }

    if (window.electronAPI && window.electronAPI.launchApp) {
        try {
            const result = await window.electronAPI.launchApp(appId, {
                name: app.name,
                paths: [app.path],
                command: null
            });

            if (result.success) {
                toast(`正在启动 ${app.name}...`);
            } else {
                toast(`启动失败: ${result.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('启动应用失败:', error);
            toast(`启动失败: ${error.message}`);
        }
    } else {
        toast('请在桌面应用中使用此功能');
    }
}

function toggleAppsReorderMode() {
    isReorderMode = !isReorderMode;
    clearDragState();
    renderApps();
    if (isReorderMode) {
        toast('已进入排序模式，拖动卡片可调整顺序');
    }
}

function initAppCenter() {
    if (!appCenterBootstrapped) {
        appCenterBootstrapped = true;
        renderIconSelector();
        applyIconMetaToForm(getDefaultIconMeta());
    }

    updateReorderToggleButton();
    renderApps();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAppCenter, 100);
});
