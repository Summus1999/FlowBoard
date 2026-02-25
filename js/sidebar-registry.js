/**
 * FlowBoard - 侧边栏热插拔注册中心
 * 支持运行时注册、删除、启用/禁用、排序，以及本地持久化。
 */
(function initFlowBoardSidebarRegistry(global) {
    const STORAGE_KEY = 'flowboard_sidebar_layout_v1';
    const LAYOUT_VERSION = 1;
    const FALLBACK_ICON = 'fas fa-circle';
    const FALLBACK_SECTION_ID = 'tools';

    const defaultLayout = {
        sections: [
            { id: 'core', title: '', order: 10 },
            { id: 'tools', title: '工具', order: 20 }
        ],
        items: [
            { page: 'dashboard', title: '我的主页', icon: 'fas fa-th-large', sectionId: 'core', order: 10, source: 'builtin' },
            { page: 'news', title: '资讯中心', icon: 'fas fa-newspaper', sectionId: 'core', order: 20, source: 'builtin' },
            { page: 'notes', title: '笔记记录', icon: 'fas fa-sticky-note', sectionId: 'tools', order: 10, source: 'builtin', onEnter: 'initNotes' },
            { page: 'calendar', title: '日程管理', icon: 'fas fa-calendar-alt', sectionId: 'tools', order: 20, source: 'builtin', onEnter: 'initCalendar' },
            { page: 'growth', title: '个人提升', icon: 'fas fa-chart-line', sectionId: 'tools', order: 30, source: 'builtin', onEnter: 'initGrowth' },
            { page: 'interview', title: '面试追踪', icon: 'fas fa-microphone', sectionId: 'tools', order: 40, source: 'builtin', onEnter: 'initInterview' },
            { page: 'leetcode', title: 'LeetCode', icon: 'fas fa-code', sectionId: 'tools', order: 50, source: 'builtin', onEnter: 'initLeetCode' },
            { page: 'github', title: 'GitHub', icon: 'fab fa-github', sectionId: 'tools', order: 60, source: 'builtin', onEnter: 'initGithub' },
            { page: 'apps', title: '应用中心', icon: 'fas fa-th-large', sectionId: 'tools', order: 70, source: 'builtin', onEnter: 'initAppCenter' }
        ]
    };

    const listeners = new Set();
    const runtimeEnterHooks = new Map();

    let state = loadLayout();

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeIcon(icon) {
        const raw = String(icon || '').trim();
        if (!raw) return FALLBACK_ICON;
        // 允许 Font Awesome 常见 class 组合，防止注入非法字符。
        return /^[a-z0-9\- ]+$/i.test(raw) ? raw : FALLBACK_ICON;
    }

    function toFiniteNumber(value, fallback) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function normalizeSection(section) {
        if (!section || typeof section !== 'object') return null;
        const id = String(section.id || '').trim();
        if (!id) return null;
        return {
            id,
            title: typeof section.title === 'string' ? section.title : '',
            order: toFiniteNumber(section.order, 100)
        };
    }

    function normalizeItem(item) {
        if (!item || typeof item !== 'object') return null;
        const page = String(item.page || item.id || '').trim();
        if (!page) return null;

        const source = item.source === 'custom' ? 'custom' : 'builtin';
        const onEnter = typeof item.onEnter === 'string' ? item.onEnter.trim() : '';

        return {
            page,
            title: typeof item.title === 'string' && item.title.trim() ? item.title : page,
            icon: sanitizeIcon(item.icon),
            sectionId: typeof item.sectionId === 'string' && item.sectionId.trim()
                ? item.sectionId.trim()
                : FALLBACK_SECTION_ID,
            order: toFiniteNumber(item.order, 100),
            enabled: item.enabled !== false,
            removed: item.removed === true,
            source,
            onEnter
        };
    }

    function sortSections(sections) {
        return [...sections].sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.id.localeCompare(b.id, 'zh-CN');
        });
    }

    function sortItems(items) {
        return [...items].sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.title.localeCompare(b.title, 'zh-CN');
        });
    }

    function ensureSection(sectionId) {
        const normalizedId = String(sectionId || '').trim() || FALLBACK_SECTION_ID;
        const exists = state.sections.some((section) => section.id === normalizedId);
        if (exists) return normalizedId;

        state.sections.push({
            id: normalizedId,
            title: normalizedId,
            order: 1000
        });
        return normalizedId;
    }

    function serializableState() {
        return {
            version: LAYOUT_VERSION,
            sections: state.sections.map((section) => ({
                id: section.id,
                title: section.title,
                order: section.order
            })),
            items: state.items.map((item) => ({
                page: item.page,
                title: item.title,
                icon: item.icon,
                sectionId: item.sectionId,
                order: item.order,
                enabled: item.enabled,
                removed: item.removed,
                source: item.source,
                onEnter: item.onEnter || ''
            }))
        };
    }

    function persistLayout() {
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
        } catch (error) {
            console.error('保存侧边栏配置失败:', error);
        }
    }

    function mergeLayout(defaultState, persistedState) {
        if (!persistedState || typeof persistedState !== 'object') {
            return defaultState;
        }

        const merged = deepClone(defaultState);
        const sectionMap = new Map(merged.sections.map((section) => [section.id, section]));
        const itemMap = new Map(merged.items.map((item) => [item.page, item]));

        if (Array.isArray(persistedState.sections)) {
            persistedState.sections.forEach((section) => {
                const normalized = normalizeSection(section);
                if (!normalized) return;
                sectionMap.set(normalized.id, normalized);
            });
        }

        if (Array.isArray(persistedState.items)) {
            persistedState.items.forEach((item) => {
                const normalized = normalizeItem(item);
                if (!normalized) return;
                const existing = itemMap.get(normalized.page);
                if (existing) {
                    itemMap.set(normalized.page, {
                        ...existing,
                        ...normalized
                    });
                } else {
                    itemMap.set(normalized.page, {
                        ...normalized,
                        source: 'custom'
                    });
                }
            });
        }

        merged.sections = Array.from(sectionMap.values());
        merged.items = Array.from(itemMap.values()).map((item) => ({
            ...item,
            sectionId: ensureSectionInCollection(item.sectionId, merged.sections)
        }));

        return merged;
    }

    function ensureSectionInCollection(sectionId, sections) {
        const normalizedId = String(sectionId || '').trim() || FALLBACK_SECTION_ID;
        const exists = sections.some((section) => section.id === normalizedId);
        if (exists) return normalizedId;

        sections.push({
            id: normalizedId,
            title: normalizedId,
            order: 1000
        });
        return normalizedId;
    }

    function loadLayout() {
        const defaultState = {
            sections: defaultLayout.sections.map((section) => normalizeSection(section)).filter(Boolean),
            items: defaultLayout.items.map((item) => normalizeItem(item)).filter(Boolean)
        };

        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState;

            const parsed = JSON.parse(raw);
            if (!parsed || (parsed.version && parsed.version > LAYOUT_VERSION)) {
                return defaultState;
            }
            return mergeLayout(defaultState, parsed);
        } catch (_error) {
            return defaultState;
        }
    }

    function emitChange(reason) {
        const payload = {
            reason,
            state: getState()
        };
        listeners.forEach((listener) => {
            try {
                listener(payload);
            } catch (error) {
                console.error('侧边栏事件回调失败:', error);
            }
        });
    }

    function getState() {
        return deepClone(state);
    }

    function getSections() {
        return sortSections(state.sections);
    }

    function getItems(options = {}) {
        const includeDisabled = options.includeDisabled === true;
        const items = includeDisabled
            ? state.items
            : state.items.filter((item) => item.enabled && !item.removed);
        return sortItems(items);
    }

    function getItem(page) {
        const normalizedPage = String(page || '').trim();
        if (!normalizedPage) return null;
        const item = state.items.find((entry) => entry.page === normalizedPage);
        return item ? deepClone(item) : null;
    }

    function upsertSection(section, options = {}) {
        const normalized = normalizeSection(section);
        if (!normalized) return null;

        const index = state.sections.findIndex((entry) => entry.id === normalized.id);
        if (index >= 0) {
            state.sections[index] = {
                ...state.sections[index],
                ...normalized
            };
        } else {
            state.sections.push(normalized);
        }

        if (options.persist !== false) persistLayout();
        if (options.emit !== false) emitChange('section:upsert');
        return deepClone(normalized);
    }

    function registerItem(item, options = {}) {
        if (item && typeof item.onEnter === 'function') {
            runtimeEnterHooks.set(String(item.page || item.id || '').trim(), item.onEnter);
        }

        const normalized = normalizeItem(item);
        if (!normalized) return null;

        normalized.sectionId = ensureSection(normalized.sectionId);
        const index = state.items.findIndex((entry) => entry.page === normalized.page);

        if (index >= 0) {
            state.items[index] = {
                ...state.items[index],
                ...normalized,
                removed: false
            };
        } else {
            state.items.push({
                ...normalized,
                source: 'custom'
            });
        }

        if (options.persist !== false) persistLayout();
        if (options.emit !== false) emitChange('item:register');
        return getItem(normalized.page);
    }

    function updateItem(page, patch, options = {}) {
        const normalizedPage = String(page || '').trim();
        if (!normalizedPage || !patch || typeof patch !== 'object') return null;

        const index = state.items.findIndex((item) => item.page === normalizedPage);
        if (index < 0) return null;

        const merged = {
            ...state.items[index],
            ...patch
        };

        if (typeof patch.onEnter === 'function') {
            runtimeEnterHooks.set(normalizedPage, patch.onEnter);
            merged.onEnter = state.items[index].onEnter;
        } else if (typeof patch.onEnter === 'string') {
            merged.onEnter = patch.onEnter.trim();
        }

        const normalized = normalizeItem(merged);
        if (!normalized) return null;
        normalized.source = state.items[index].source || normalized.source;
        normalized.sectionId = ensureSection(normalized.sectionId);

        state.items[index] = normalized;

        if (options.persist !== false) persistLayout();
        if (options.emit !== false) emitChange('item:update');
        return getItem(normalizedPage);
    }

    function unregisterItem(page, options = {}) {
        const normalizedPage = String(page || '').trim();
        if (!normalizedPage) return false;

        const index = state.items.findIndex((item) => item.page === normalizedPage);
        if (index < 0) return false;

        const target = state.items[index];
        runtimeEnterHooks.delete(normalizedPage);

        if (target.source === 'builtin') {
            state.items[index] = {
                ...target,
                enabled: false,
                removed: true
            };
        } else {
            state.items.splice(index, 1);
        }

        if (options.persist !== false) persistLayout();
        if (options.emit !== false) emitChange('item:unregister');
        return true;
    }

    function setItemEnabled(page, enabled, options = {}) {
        const normalizedPage = String(page || '').trim();
        const desired = enabled === true;
        const index = state.items.findIndex((item) => item.page === normalizedPage);
        if (index < 0) return false;

        state.items[index] = {
            ...state.items[index],
            enabled: desired,
            removed: desired ? false : state.items[index].removed
        };

        if (options.persist !== false) persistLayout();
        if (options.emit !== false) emitChange('item:toggle');
        return true;
    }

    function moveItem(page, target, options = {}) {
        const normalizedPage = String(page || '').trim();
        const item = state.items.find((entry) => entry.page === normalizedPage);
        if (!item || !target || typeof target !== 'object') return null;

        const patch = {};
        if (typeof target.sectionId === 'string' && target.sectionId.trim()) {
            patch.sectionId = ensureSection(target.sectionId.trim());
        }
        if (target.order !== undefined) {
            patch.order = toFiniteNumber(target.order, item.order);
        }

        return updateItem(normalizedPage, patch, options);
    }

    function resetLayout(options = {}) {
        runtimeEnterHooks.clear();
        state = {
            sections: defaultLayout.sections.map((section) => normalizeSection(section)).filter(Boolean),
            items: defaultLayout.items.map((item) => normalizeItem(item)).filter(Boolean)
        };

        if (options.persist !== false) persistLayout();
        if (options.emit !== false) emitChange('layout:reset');
    }

    function onChange(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }

        listeners.add(listener);
        return function unsubscribe() {
            listeners.delete(listener);
        };
    }

    function getPageEnterHook(page) {
        const normalizedPage = String(page || '').trim();
        if (!normalizedPage) return null;

        if (runtimeEnterHooks.has(normalizedPage)) {
            return runtimeEnterHooks.get(normalizedPage);
        }

        const item = state.items.find((entry) => entry.page === normalizedPage);
        if (!item || !item.onEnter) return null;

        const hook = global[item.onEnter];
        return typeof hook === 'function' ? hook : null;
    }

    function render(container, activePage = '') {
        if (!container) return;

        const sections = getSections();
        const visibleItems = getItems({ includeDisabled: false });
        const itemsBySection = new Map();

        visibleItems.forEach((item) => {
            if (!itemsBySection.has(item.sectionId)) {
                itemsBySection.set(item.sectionId, []);
            }
            itemsBySection.get(item.sectionId).push(item);
        });

        const html = sections
            .map((section) => {
                const sectionItems = sortItems(itemsBySection.get(section.id) || []);
                if (sectionItems.length === 0) return '';

                const titleHtml = section.title
                    ? `<p class="section-title">${escapeHtml(section.title)}</p>`
                    : '';

                const itemsHtml = sectionItems
                    .map((item) => {
                        const activeClass = item.page === activePage ? ' active' : '';
                        return `
                    <a href="#" class="nav-item${activeClass}" data-page="${escapeHtml(item.page)}">
                        <i class="${escapeHtml(item.icon)}"></i>
                        <span>${escapeHtml(item.title)}</span>
                    </a>`;
                    })
                    .join('');

                return `<div class="nav-section" data-section-id="${escapeHtml(section.id)}">${titleHtml}${itemsHtml}</div>`;
            })
            .join('');

        container.innerHTML = html;
    }

    const api = {
        render,
        onChange,
        getState,
        getSections,
        getItems,
        getItem,
        getPageEnterHook,
        registerSection: upsertSection,
        registerItem,
        updateItem,
        moveItem,
        removeItem: unregisterItem,
        unregisterItem,
        enableItem: (page, options) => setItemEnabled(page, true, options),
        disableItem: (page, options) => setItemEnabled(page, false, options),
        setItemEnabled,
        resetLayout
    };

    global.FlowBoardSidebar = api;
})(window);
