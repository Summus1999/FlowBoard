/**
 * AI 设置模块
 * 管理 AI 服务配置、提供商设置和连接测试
 */

// 提供商注册表
const AI_PROVIDERS = {
    qwen: {
        name: '通义千问',
        icon: 'fa-solid fa-brain',
        baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
        keyPrefix: 'sk-',
        docsUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/api-details'
    },
    kimi: {
        name: 'Kimi (Moonshot)',
        icon: 'fa-solid fa-moon',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        keyPrefix: 'sk-',
        docsUrl: 'https://platform.moonshot.cn/docs'
    },
    glm: {
        name: '智谱 GLM',
        icon: 'fa-solid fa-robot',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4', 'glm-4-flash'],
        keyPrefix: '',
        docsUrl: 'https://open.bigmodel.cn/dev/api'
    },
    silflow: {
        name: '硅基流动',
        icon: 'fa-solid fa-bolt',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'],
        keyPrefix: 'sk-',
        docsUrl: 'https://docs.siliconflow.cn'
    }
};

// 全局状态
let aiSettingsState = {
    serviceUrl: 'http://localhost:8000',
    apiToken: '',
    providers: {},
    defaultProvider: 'qwen',
    fallbackProvider: 'kimi',
    monthlyBudget: 150.0,
    costUsed: 0.0,
    isLoading: false,
    serviceConnected: false
};

/**
 * 初始化 AI 设置模块
 */
async function initAiSettings() {
    console.log('初始化 AI 设置模块...');
    
    // 加载保存的配置
    await loadAiSettings();
    
    // 渲染 UI
    renderAiSettingsUI();
    
    // 绑定事件
    bindAiSettingsEvents();
    
    // 检查服务状态
    await checkAiServiceStatus();
}

/**
 * 加载 AI 设置
 */
async function loadAiSettings() {
    try {
        if (!window.electronAPI?.loadAiConfig) {
            console.warn('electronAPI.loadAiConfig 不可用');
            return;
        }
        
        const result = await window.electronAPI.loadAiConfig();
        if (result.success) {
            aiSettingsState = {
                ...aiSettingsState,
                ...result.config
            };
            console.log('AI 配置已加载');
        } else {
            console.error('加载 AI 配置失败:', result.error);
        }
    } catch (error) {
        console.error('加载 AI 配置失败:', error);
    }
}

/**
 * 渲染 AI 设置 UI
 */
function renderAiSettingsUI() {
    const container = document.getElementById('aiSettingsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <!-- AI 服务配置卡片 -->
        <div class="settings-card ai-settings-card">
            <h3><i class="fa-solid fa-robot"></i> AI 服务配置</h3>
            
            <!-- 服务地址 -->
            <div class="setting-item">
                <div class="setting-info">
                    <span class="setting-name">AI 服务地址</span>
                    <span class="setting-desc">后端 AI 服务地址</span>
                </div>
                <div class="setting-control">
                    <input type="text" 
                           id="aiServiceUrl" 
                           class="ai-input" 
                           value="${aiSettingsState.serviceUrl}"
                           placeholder="http://localhost:8000">
                </div>
            </div>
            
            <!-- API Token -->
            <div class="setting-item">
                <div class="setting-info">
                    <span class="setting-name">API Token</span>
                    <span class="setting-desc">远程服务认证令牌 (本地可留空)</span>
                </div>
                <div class="setting-control">
                    <div class="ai-input-wrapper">
                        <input type="password" 
                               id="aiApiToken" 
                               class="ai-input" 
                               value="${aiSettingsState.apiToken}"
                               placeholder="留空则仅允许本地连接">
                        <button class="ai-icon-btn" id="toggleApiTokenVisibility" title="显示/隐藏">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="setting-item">
                <div class="setting-info">
                    <span class="setting-name">服务状态</span>
                    <span class="setting-desc">AI 服务连接状态</span>
                </div>
                <div class="setting-control">
                    <button id="aiTestServiceBtn" class="btn-secondary">
                        <i class="fa-solid fa-rotate"></i> 测试连接
                    </button>
                    <span id="aiServiceStatus" class="ai-status ${aiSettingsState.serviceConnected ? 'connected' : 'disconnected'}">
                        <i class="fa-solid fa-circle"></i>
                        ${aiSettingsState.serviceConnected ? '已连接' : '未连接'}
                    </span>
                </div>
            </div>
            
            <div class="ai-providers-divider">
                <span>模型提供商</span>
            </div>
            
            <!-- 提供商配置 -->
            <div class="ai-providers-list">
                ${Object.entries(AI_PROVIDERS).map(([key, provider]) => {
                    const providerConfig = aiSettingsState.providers[key] || {};
                    const isEnabled = providerConfig.enabled || false;
                    const hasKey = !!providerConfig.apiKey;
                    
                    return `
                        <div class="ai-provider-item" data-provider="${key}">
                            <div class="ai-provider-header">
                                <div class="ai-provider-info">
                                    <i class="${provider.icon}"></i>
                                    <span class="ai-provider-name">${provider.name}</span>
                                    ${isEnabled ? '<span class="ai-badge enabled">已启用</span>' : ''}
                                </div>
                                <div class="ai-provider-actions">
                                    <button class="ai-toggle-btn ${isEnabled ? 'active' : ''}" data-provider="${key}" title="${isEnabled ? '禁用' : '启用'}">
                                        <i class="fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="ai-provider-config">
                                <div class="ai-input-group">
                                    <label>API Key</label>
                                    <div class="ai-input-wrapper">
                                        <input type="password" 
                                               class="ai-input api-key-input" 
                                               data-provider="${key}"
                                               value="${providerConfig.apiKey || ''}"
                                               placeholder="输入 ${provider.name} API Key">
                                        <button class="ai-icon-btn toggle-visibility" data-provider="${key}" title="显示/隐藏">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                        <button class="ai-icon-btn test-provider" data-provider="${key}" title="测试连接">
                                            <i class="fa-solid fa-vial"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="ai-provider-status" id="providerStatus_${key}">
                                    ${hasKey ? '<span class="status-text configured"><i class="fa-solid fa-check-circle"></i> 已配置</span>' : '<span class="status-text unconfigured"><i class="fa-solid fa-circle-o"></i> 未配置</span>'}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="ai-providers-divider">
                <span>调用优先级（拖拽排序，从上到下优先级递减）</span>
            </div>
            
            <!-- Priority ordering UI -->
            <div class="ai-priority-list" id="aiPriorityList">
                ${_buildPriorityListHTML()}
            </div>
            <div class="ai-priority-hint" style="font-size: 12px; color: #888; padding: 4px 16px;">
                拖拽调整顺序。第一个为主力模型，后续为降级候选。仅已启用且配置了 API Key 的提供商参与调度。
            </div>
            
            <div class="ai-providers-divider">
                <span>预算控制</span>
            </div>
            
            <!-- 预算配置 -->
            <div class="setting-item">
                <div class="setting-info">
                    <span class="setting-name">月度预算</span>
                    <span class="setting-desc">每月 AI 调用预算 (元)</span>
                </div>
                <div class="setting-control">
                    <input type="number" 
                           id="aiMonthlyBudget" 
                           class="ai-input budget-input" 
                           value="${aiSettingsState.monthlyBudget}"
                           min="0"
                           step="10">
                </div>
            </div>
            
            <div class="ai-budget-info">
                <div class="ai-budget-bar">
                    <div class="ai-budget-used" style="width: ${Math.min((aiSettingsState.costUsed / aiSettingsState.monthlyBudget) * 100, 100)}%"></div>
                </div>
                <div class="ai-budget-text">
                    <span>已用: ¥${aiSettingsState.costUsed.toFixed(2)}</span>
                    <span>剩余: ¥${Math.max(0, aiSettingsState.monthlyBudget - aiSettingsState.costUsed).toFixed(2)}</span>
                </div>
            </div>
            
            <!-- 保存按钮 -->
            <div class="ai-settings-actions">
                <button id="aiSaveConfigBtn" class="btn-primary">
                    <i class="fa-solid fa-save"></i> 保存配置
                </button>
                <button id="aiResetConfigBtn" class="btn-secondary">
                    <i class="fa-solid fa-rotate-left"></i> 重置
                </button>
            </div>
        </div>
    `;
}

/**
 * Build the drag-sortable priority list HTML.
 */
function _buildPriorityListHTML() {
    // Determine initial order from PriorityLLMManager or fallback to all providers
    let order = [];
    if (typeof priorityLLMManager !== 'undefined' && priorityLLMManager.priorityList?.length > 0) {
        order = [...priorityLLMManager.priorityList];
    }
    // Ensure all known providers are represented
    const allKeys = Object.keys(AI_PROVIDERS);
    for (const k of allKeys) {
        if (!order.includes(k)) order.push(k);
    }

    return order.map((key, idx) => {
        const provider = AI_PROVIDERS[key] || { name: key, icon: 'fa-solid fa-circle' };
        const providerCfg = aiSettingsState.providers[key] || {};
        const isUsable = providerCfg.enabled && providerCfg.apiKey;
        return `
            <div class="ai-priority-item ${isUsable ? 'usable' : 'disabled'}"
                 data-provider="${key}" draggable="true"
                 style="display:flex; align-items:center; gap:10px; padding:10px 16px;
                        border:1px solid ${isUsable ? '#4ade8030' : '#66666630'};
                        border-radius:8px; margin:4px 0; cursor:grab;
                        background: ${isUsable ? '#4ade8008' : 'transparent'};
                        opacity: ${isUsable ? '1' : '0.5'};">
                <span style="font-weight:600; color:#888; min-width:20px;">${idx + 1}</span>
                <i class="${provider.icon}" style="font-size:16px;"></i>
                <span style="flex:1;">${provider.name}</span>
                ${isUsable
                    ? '<span style="font-size:11px; color:#4ade80;">可用</span>'
                    : '<span style="font-size:11px; color:#888;">未启用</span>'}
                <i class="fas fa-grip-vertical" style="color:#666; cursor:grab;"></i>
            </div>
        `;
    }).join('');
}

/**
 * Initialize drag-and-drop for the priority list.
 */
function _initPriorityDragDrop() {
    const container = document.getElementById('aiPriorityList');
    if (!container) return;

    let draggedEl = null;

    container.querySelectorAll('.ai-priority-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedEl = item;
            item.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            if (draggedEl) draggedEl.style.opacity = '';
            draggedEl = null;
            // Remove all drag-over highlights
            container.querySelectorAll('.ai-priority-item').forEach(el => {
                el.style.borderTop = '';
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedEl && draggedEl !== item) {
                item.style.borderTop = '2px solid #3b82f6';
            }
        });

        item.addEventListener('dragleave', () => {
            item.style.borderTop = '';
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.style.borderTop = '';
            if (draggedEl && draggedEl !== item) {
                container.insertBefore(draggedEl, item);
                _syncPriorityFromDOM();
            }
        });
    });

    // Allow drop at end of list
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedEl && !e.target.closest('.ai-priority-item')) {
            container.appendChild(draggedEl);
            _syncPriorityFromDOM();
        }
    });
}

/**
 * Read current DOM order and update the PriorityLLMManager + re-render indices.
 */
function _syncPriorityFromDOM() {
    const container = document.getElementById('aiPriorityList');
    if (!container) return;

    const items = container.querySelectorAll('.ai-priority-item');
    const newOrder = [];
    items.forEach((el, idx) => {
        newOrder.push(el.dataset.provider);
        // Update the index number
        const numEl = el.querySelector('span');
        if (numEl) numEl.textContent = idx + 1;
    });

    // Persist to PriorityLLMManager
    if (typeof priorityLLMManager !== 'undefined') {
        priorityLLMManager.setPriorityList(newOrder);
    }
}

/**
 * 刷新优先级列表 UI，保持当前排序顺序但更新启用状态
 */
function _refreshPriorityList() {
    const container = document.getElementById('aiPriorityList');
    if (!container) return;

    // 获取当前排序顺序
    const currentOrder = [];
    container.querySelectorAll('.ai-priority-item').forEach(el => {
        currentOrder.push(el.dataset.provider);
    });

    // 重新构建 HTML，保持当前排序
    const html = currentOrder.map((key, idx) => {
        const provider = AI_PROVIDERS[key] || { name: key, icon: 'fa-solid fa-circle' };
        const providerCfg = aiSettingsState.providers[key] || {};
        const isUsable = providerCfg.enabled && providerCfg.apiKey;
        return `
            <div class="ai-priority-item ${isUsable ? 'usable' : 'disabled'}"
                 data-provider="${key}" draggable="true"
                 style="display:flex; align-items:center; gap:10px; padding:10px 16px;
                        border:1px solid ${isUsable ? '#4ade8030' : '#66666630'};
                        border-radius:8px; margin:4px 0; cursor:grab;
                        background: ${isUsable ? '#4ade8008' : 'transparent'};
                        opacity: ${isUsable ? '1' : '0.5'};">
                <span style="font-weight:600; color:#888; min-width:20px;">${idx + 1}</span>
                <i class="${provider.icon}" style="font-size:16px;"></i>
                <span style="flex:1;">${provider.name}</span>
                ${isUsable
                    ? '<span style="font-size:11px; color:#4ade80;">可用</span>'
                    : '<span style="font-size:11px; color:#888;">未启用</span>'}
                <i class="fas fa-grip-vertical" style="color:#666; cursor:grab;"></i>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // 重新绑定拖拽事件
    _initPriorityDragDrop();
}

/**
 * 绑定 AI 设置事件
 */
function bindAiSettingsEvents() {
    // 服务地址输入
    const serviceUrlInput = document.getElementById('aiServiceUrl');
    if (serviceUrlInput) {
        serviceUrlInput.addEventListener('change', (e) => {
            aiSettingsState.serviceUrl = e.target.value.replace(/\/+$/, '');
        });
    }
    
    // API Token 输入
    const apiTokenInput = document.getElementById('aiApiToken');
    if (apiTokenInput) {
        apiTokenInput.addEventListener('change', (e) => {
            aiSettingsState.apiToken = e.target.value;
        });
    }
    const toggleTokenBtn = document.getElementById('toggleApiTokenVisibility');
    if (toggleTokenBtn) {
        toggleTokenBtn.addEventListener('click', () => {
            if (apiTokenInput) {
                const isPassword = apiTokenInput.type === 'password';
                apiTokenInput.type = isPassword ? 'text' : 'password';
                toggleTokenBtn.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            }
        });
    }
    
    // 测试服务连接
    const testServiceBtn = document.getElementById('aiTestServiceBtn');
    if (testServiceBtn) {
        testServiceBtn.addEventListener('click', checkAiServiceStatus);
    }
    
    // 提供商启用/禁用切换
    document.querySelectorAll('.ai-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const provider = btn.dataset.provider;
            const currentEnabled = btn.classList.contains('active');
            const newEnabled = !currentEnabled;
            
            // 更新 UI
            btn.classList.toggle('active', newEnabled);
            const icon = btn.querySelector('i');
            icon.className = newEnabled ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off';
            
            // 更新状态
            if (!aiSettingsState.providers[provider]) {
                aiSettingsState.providers[provider] = {};
            }
            aiSettingsState.providers[provider].enabled = newEnabled;
            
            // 更新徽章
            const providerItem = btn.closest('.ai-provider-item');
            const infoDiv = providerItem.querySelector('.ai-provider-info');
            let badge = infoDiv.querySelector('.ai-badge');
            if (newEnabled) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'ai-badge enabled';
                    badge.textContent = '已启用';
                    infoDiv.appendChild(badge);
                }
            } else {
                if (badge) badge.remove();
            }
            
            // 刷新优先级列表，同步显示状态
            _refreshPriorityList();
        });
    });
    
    // API Key 输入
    document.querySelectorAll('.api-key-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const provider = input.dataset.provider;
            if (!aiSettingsState.providers[provider]) {
                aiSettingsState.providers[provider] = {};
            }
            aiSettingsState.providers[provider].apiKey = e.target.value;
            
            // 更新状态显示
            updateProviderStatus(provider, !!e.target.value);
            
            // 刷新优先级列表，同步显示状态
            _refreshPriorityList();
        });
    });
    
    // 显示/隐藏 API Key
    document.querySelectorAll('.toggle-visibility').forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.dataset.provider;
            const input = document.querySelector(`.api-key-input[data-provider="${provider}"]`);
            if (input) {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
            }
        });
    });
    
    // 测试提供商连接
    document.querySelectorAll('.test-provider').forEach(btn => {
        btn.addEventListener('click', async () => {
            const provider = btn.dataset.provider;
            await testProviderConnection(provider);
        });
    });
    
    // 月度预算
    const monthlyBudgetInput = document.getElementById('aiMonthlyBudget');
    if (monthlyBudgetInput) {
        monthlyBudgetInput.addEventListener('change', (e) => {
            aiSettingsState.monthlyBudget = parseFloat(e.target.value) || 150.0;
            updateBudgetDisplay();
        });
    }
    
    // 保存配置
    const saveBtn = document.getElementById('aiSaveConfigBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAiConfig);
    }
    
    // 重置配置
    const resetBtn = document.getElementById('aiResetConfigBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (confirm('确定要重置 AI 配置吗？这将恢复默认设置。')) {
                await loadAiSettings();
                renderAiSettingsUI();
                bindAiSettingsEvents();
            }
        });
    }

    // Initialize priority drag-and-drop
    _initPriorityDragDrop();
}

/**
 * 更新提供商状态显示
 */
function updateProviderStatus(provider, hasKey) {
    const statusEl = document.getElementById(`providerStatus_${provider}`);
    if (statusEl) {
        if (hasKey) {
            statusEl.innerHTML = '<span class="status-text configured"><i class="fa-solid fa-check-circle"></i> 已配置</span>';
        } else {
            statusEl.innerHTML = '<span class="status-text unconfigured"><i class="fa-solid fa-circle-o"></i> 未配置</span>';
        }
    }
}

/**
 * 更新预算显示
 */
function updateBudgetDisplay() {
    const usedPercent = Math.min((aiSettingsState.costUsed / aiSettingsState.monthlyBudget) * 100, 100);
    const usedEl = document.querySelector('.ai-budget-used');
    if (usedEl) {
        usedEl.style.width = `${usedPercent}%`;
    }
    
    const budgetText = document.querySelector('.ai-budget-text');
    if (budgetText) {
        budgetText.innerHTML = `
            <span>已用: ¥${aiSettingsState.costUsed.toFixed(2)}</span>
            <span>剩余: ¥${Math.max(0, aiSettingsState.monthlyBudget - aiSettingsState.costUsed).toFixed(2)}</span>
        `;
    }
}

/**
 * 检查 AI 服务状态
 */
async function checkAiServiceStatus() {
    const statusEl = document.getElementById('aiServiceStatus');
    const testBtn = document.getElementById('aiTestServiceBtn');
    
    if (testBtn) {
        testBtn.disabled = true;
        testBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 测试中...';
    }
    
    try {
        if (!window.electronAPI?.getAiServiceStatus) {
            console.warn('electronAPI.getAiServiceStatus 不可用');
            aiSettingsState.serviceConnected = false;
            return;
        }
        
        const result = await window.electronAPI.getAiServiceStatus();
        aiSettingsState.serviceConnected = result.success;
        
        if (statusEl) {
            statusEl.className = `ai-status ${result.success ? 'connected' : 'disconnected'}`;
            statusEl.innerHTML = `
                <i class="fa-solid fa-circle"></i>
                ${result.success ? '已连接' : '未连接'}
            `;
        }
        
        if (result.success) {
            // 如果服务已连接，同步配置到后端
            await syncConfigToBackend();
        }
    } catch (error) {
        console.error('检查 AI 服务状态失败:', error);
        aiSettingsState.serviceConnected = false;
        
        if (statusEl) {
            statusEl.className = 'ai-status disconnected';
            statusEl.innerHTML = '<i class="fa-solid fa-circle"></i> 未连接';
        }
    } finally {
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 测试连接';
        }
    }
}

/**
 * 测试提供商连接
 */
async function testProviderConnection(provider) {
    const input = document.querySelector(`.api-key-input[data-provider="${provider}"]`);
    const btn = document.querySelector(`.test-provider[data-provider="${provider}"]`);
    const statusEl = document.getElementById(`providerStatus_${provider}`);
    
    if (!input || !input.value.trim()) {
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-text error"><i class="fa-solid fa-times-circle"></i> 请输入 API Key</span>';
        }
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }
    
    if (statusEl) {
        statusEl.innerHTML = '<span class="status-text testing"><i class="fa-solid fa-spinner fa-spin"></i> 测试中...</span>';
    }
    
    try {
        const result = await window.electronAPI.testAiProvider(provider, input.value.trim());
        
        if (result.success) {
            if (statusEl) {
                statusEl.innerHTML = `<span class="status-text success"><i class="fa-solid fa-check-circle"></i> 连接成功 (${result.latencyMs}ms)</span>`;
            }
        } else {
            if (statusEl) {
                statusEl.innerHTML = `<span class="status-text error"><i class="fa-solid fa-times-circle"></i> 连接失败: ${result.error || '未知错误'}</span>`;
            }
        }
    } catch (error) {
        console.error('测试提供商失败:', error);
        if (statusEl) {
            statusEl.innerHTML = `<span class="status-text error"><i class="fa-solid fa-times-circle"></i> 测试失败: ${error.message}</span>`;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-vial"></i>';
        }
    }
}

/**
 * 同步所有 API Key 输入框的值到 aiSettingsState
 */
function _syncApiKeysFromDOM() {
    document.querySelectorAll('.api-key-input').forEach(input => {
        const provider = input.dataset.provider;
        if (!provider) return;

        if (!aiSettingsState.providers[provider]) {
            aiSettingsState.providers[provider] = {};
        }

        // 只有当输入框有值时才更新，避免空值覆盖
        const inputValue = input.value.trim();
        if (inputValue) {
            aiSettingsState.providers[provider].apiKey = inputValue;
        }
    });

    // 同步启用状态
    document.querySelectorAll('.provider-toggle').forEach(toggle => {
        const provider = toggle.dataset.provider;
        if (!provider) return;

        if (!aiSettingsState.providers[provider]) {
            aiSettingsState.providers[provider] = {};
        }
        aiSettingsState.providers[provider].enabled = toggle.checked;
    });
}

/**
 * 保存 AI 配置
 */
async function saveAiConfig() {
    const saveBtn = document.getElementById('aiSaveConfigBtn');

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
    }

    try {
        // 同步 DOM 中的 API Keys 和启用状态
        _syncApiKeysFromDOM();

        // Sync priority order from DOM before saving
        _syncPriorityFromDOM();

        // Derive defaultProvider / fallbackProvider from priority list
        if (typeof priorityLLMManager !== 'undefined') {
            const ordered = priorityLLMManager.getOrderedProviders();
            if (ordered.length > 0) aiSettingsState.defaultProvider = ordered[0];
            if (ordered.length > 1) aiSettingsState.fallbackProvider = ordered[1];
        }

        // 1. Save to Electron encrypted storage
        const configPayload = {
            serviceUrl: aiSettingsState.serviceUrl,
            apiToken: aiSettingsState.apiToken,
            providers: aiSettingsState.providers,
            defaultProvider: aiSettingsState.defaultProvider,
            fallbackProvider: aiSettingsState.fallbackProvider,
            monthlyBudget: aiSettingsState.monthlyBudget
        };

        if (window.electronAPI?.saveAiConfig) {
            const saveResult = await window.electronAPI.saveAiConfig(configPayload);
            if (!saveResult.success) {
                throw new Error(saveResult.error || '保存失败');
            }
        } else {
            // Fallback: save to IndexedDB
            await flowboardDB.setKV('llm_config', configPayload);
        }

        // 2. Save priority config
        if (typeof priorityLLMManager !== 'undefined') {
            await priorityLLMManager.savePriorityConfig();
            // Reload config into llmManager
            await priorityLLMManager.loadConfig();
        }

        console.log('AI config saved');

        // 3. Sync to backend
        await syncConfigToBackend();
        
        // 4. 刷新优先级列表 UI
        _refreshPriorityList();
        
        showNotification('AI 配置已保存', 'success');
    } catch (error) {
        console.error('保存 AI 配置失败:', error);
        showNotification(`保存失败: ${error.message}`, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-save"></i> 保存配置';
        }
    }
}

/**
 * Sync config to backend via Electron main process IPC (avoids CORS)
 */
async function syncConfigToBackend() {
    try {
        if (!aiSettingsState.serviceConnected) {
            console.log('AI 服务未连接，跳过配置同步');
            return;
        }

        const result = await window.electronAPI.syncAiConfigToBackend();
        if (result.success) {
            console.log('配置已同步到后端, active:', result.active_providers);
            if (result.active_providers) {
                updateActiveProvidersDisplay(result.active_providers);
            }
        } else {
            console.error('同步配置到后端失败:', result.error);
        }
    } catch (error) {
        console.error('同步配置到后端失败:', error);
    }
}

/**
 * 更新活跃提供商显示
 */
function updateActiveProvidersDisplay(activeProviders) {
    document.querySelectorAll('.ai-provider-item').forEach(item => {
        const provider = item.dataset.provider;
        const isActive = activeProviders.includes(provider);
        
        // 可以在这里添加更多视觉反馈
        if (isActive) {
            item.classList.add('active-provider');
        } else {
            item.classList.remove('active-provider');
        }
    });
}

/**
 * 显示通知
 */
function showNotification(message, type = 'info') {
    // 如果项目中有全局通知函数，使用它
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    
    // 否则使用简单的 alert
    if (type === 'error') {
        alert(`错误: ${message}`);
    } else {
        alert(message);
    }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initAiSettings,
        loadAiSettings,
        saveAiConfig,
        checkAiServiceStatus,
        AI_PROVIDERS
    };
}
