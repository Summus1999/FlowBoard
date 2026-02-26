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
                <span>默认模型路由</span>
            </div>
            
            <!-- 默认路由配置 -->
            <div class="setting-item">
                <div class="setting-info">
                    <span class="setting-name">主力模型</span>
                    <span class="setting-desc">默认使用的 AI 模型</span>
                </div>
                <div class="setting-control">
                    <select id="aiDefaultProvider" class="ai-select">
                        ${Object.entries(AI_PROVIDERS).map(([key, provider]) => `
                            <option value="${key}" ${aiSettingsState.defaultProvider === key ? 'selected' : ''}>${provider.name}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
            
            <div class="setting-item">
                <div class="setting-info">
                    <span class="setting-name">降级模型</span>
                    <span class="setting-desc">主力模型不可用时使用</span>
                </div>
                <div class="setting-control">
                    <select id="aiFallbackProvider" class="ai-select">
                        ${Object.entries(AI_PROVIDERS).map(([key, provider]) => `
                            <option value="${key}" ${aiSettingsState.fallbackProvider === key ? 'selected' : ''}>${provider.name}</option>
                        `).join('')}
                    </select>
                </div>
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
    
    // 默认提供商选择
    const defaultProviderSelect = document.getElementById('aiDefaultProvider');
    if (defaultProviderSelect) {
        defaultProviderSelect.addEventListener('change', (e) => {
            aiSettingsState.defaultProvider = e.target.value;
        });
    }
    
    // 降级提供商选择
    const fallbackProviderSelect = document.getElementById('aiFallbackProvider');
    if (fallbackProviderSelect) {
        fallbackProviderSelect.addEventListener('change', (e) => {
            aiSettingsState.fallbackProvider = e.target.value;
        });
    }
    
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
 * 保存 AI 配置
 */
async function saveAiConfig() {
    const saveBtn = document.getElementById('aiSaveConfigBtn');
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
    }
    
    try {
        // 1. 保存到 Electron 加密存储
        const saveResult = await window.electronAPI.saveAiConfig({
            serviceUrl: aiSettingsState.serviceUrl,
            apiToken: aiSettingsState.apiToken,
            providers: aiSettingsState.providers,
            defaultProvider: aiSettingsState.defaultProvider,
            fallbackProvider: aiSettingsState.fallbackProvider,
            monthlyBudget: aiSettingsState.monthlyBudget
        });
        
        if (!saveResult.success) {
            throw new Error(saveResult.error || '保存失败');
        }
        
        console.log('AI 配置已保存到本地存储');
        
        // 2. 同步到后端
        await syncConfigToBackend();
        
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
