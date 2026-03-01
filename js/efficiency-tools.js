/**
 * FlowBoard - 快捷启动与效率工具集 (功能19)
 * 剪贴板历史、计算器、颜色工具、正则测试等
 */

const EfficiencyTools = {
    clipboardHistory: [],
    maxClipboardItems: 50,

    init() {
        this.createToolsPanel();
        this.initClipboardWatcher();
    },

    createToolsPanel() {
        const toolsBtn = document.createElement('button');
        toolsBtn.id = 'efficiencyToolsBtn';
        toolsBtn.className = 'efficiency-tools-btn';
        toolsBtn.innerHTML = '<i class="fas fa-toolbox"></i>';
        toolsBtn.title = '效率工具';
        toolsBtn.onclick = () => this.togglePanel();
        document.body.appendChild(toolsBtn);

        const panel = document.createElement('div');
        panel.id = 'efficiencyToolsPanel';
        panel.className = 'efficiency-tools-panel';
        panel.innerHTML = `
            <div class="tools-header">
                <h4>效率工具</h4>
                <button onclick="EfficiencyTools.togglePanel()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="tools-tabs">
                <button class="active" data-tab="clipboard" onclick="EfficiencyTools.switchTab('clipboard')">
                    <i class="fas fa-clipboard"></i> 剪贴板
                </button>
                <button data-tab="calculator" onclick="EfficiencyTools.switchTab('calculator')">
                    <i class="fas fa-calculator"></i> 计算器
                </button>
                <button data-tab="color" onclick="EfficiencyTools.switchTab('color')">
                    <i class="fas fa-palette"></i> 颜色
                </button>
                <button data-tab="regex" onclick="EfficiencyTools.switchTab('regex')">
                    <i class="fas fa-code"></i> 正则
                </button>
                <button data-tab="converter" onclick="EfficiencyTools.switchTab('converter')">
                    <i class="fas fa-exchange-alt"></i> 转换
                </button>
            </div>
            <div class="tools-content">
                <div class="tool-panel active" id="toolClipboard">
                    ${this.renderClipboardPanel()}
                </div>
                <div class="tool-panel" id="toolCalculator">
                    ${this.renderCalculatorPanel()}
                </div>
                <div class="tool-panel" id="toolColor">
                    ${this.renderColorPanel()}
                </div>
                <div class="tool-panel" id="toolRegex">
                    ${this.renderRegexPanel()}
                </div>
                <div class="tool-panel" id="toolConverter">
                    ${this.renderConverterPanel()}
                </div>
            </div>
        `;
        document.body.appendChild(panel);
    },

    togglePanel() {
        document.getElementById('efficiencyToolsPanel').classList.toggle('active');
    },

    switchTab(tab) {
        document.querySelectorAll('.tools-tabs button').forEach(b => b.classList.remove('active'));
        document.querySelector(`.tools-tabs button[data-tab="${tab}"]`).classList.add('active');
        
        document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`tool${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
    },

    // ========== 剪贴板历史 ==========
    renderClipboardPanel() {
        return `
            <div class="clipboard-panel">
                <div class="clipboard-toolbar">
                    <button onclick="EfficiencyTools.clearClipboard()">清空历史</button>
                    <button onclick="EfficiencyTools.pinClipboardItem()">固定选中</button>
                </div>
                <div class="clipboard-list" id="clipboardList">
                    ${this.clipboardHistory.map((item, idx) => `
                        <div class="clipboard-item ${item.pinned ? 'pinned' : ''}" data-idx="${idx}">
                            <div class="clipboard-text">${this.escapeHtml(item.text.slice(0, 100))}</div>
                            <div class="clipboard-meta">
                                <span>${new Date(item.time).toLocaleTimeString()}</span>
                                ${item.pinned ? '<i class="fas fa-thumbtack"></i>' : ''}
                            </div>
                            <button onclick="EfficiencyTools.copyFromHistory(${idx})">复制</button>
                        </div>
                    `).join('') || '<p class="empty">暂无剪贴板记录</p>'}
                </div>
            </div>
        `;
    },

    initClipboardWatcher() {
        // 监听页面内复制事件
        document.addEventListener('copy', (e) => {
            const text = window.getSelection().toString();
            if (text) {
                this.addToClipboard(text);
            }
        });

        // 定期读取剪贴板（需要用户交互触发）
        document.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && !this.isSensitive(text)) {
                    this.addToClipboard(text);
                }
            } catch (e) {}
        }, { once: true });
    },

    addToClipboard(text) {
        // 去重
        const existing = this.clipboardHistory.findIndex(i => i.text === text);
        if (existing !== -1) {
            this.clipboardHistory[existing].time = Date.now();
            return;
        }

        this.clipboardHistory.unshift({
            text,
            time: Date.now(),
            pinned: false
        });

        if (this.clipboardHistory.length > this.maxClipboardItems) {
            this.clipboardHistory = this.clipboardHistory.slice(0, this.maxClipboardItems);
        }

        this.updateClipboardUI();
    },

    isSensitive(text) {
        // 简单检测是否可能是密码
        const patterns = [
            /password[:\s]+\S+/i,
            /passwd[:\s]+\S+/i,
            /pwd[:\s]+\S+/i,
            /[a-z0-9]{32,}/i  // 长串可能是密钥
        ];
        return patterns.some(p => p.test(text));
    },

    updateClipboardUI() {
        const panel = document.getElementById('toolClipboard');
        if (panel) {
            panel.innerHTML = this.renderClipboardPanel();
        }
    },

    async copyFromHistory(idx) {
        const item = this.clipboardHistory[idx];
        if (item) {
            await navigator.clipboard.writeText(item.text);
            showToast('已复制到剪贴板');
        }
    },

    clearClipboard() {
        this.clipboardHistory = this.clipboardHistory.filter(i => i.pinned);
        this.updateClipboardUI();
    },

    // ========== 计算器 ==========
    renderCalculatorPanel() {
        return `
            <div class="calculator">
                <input type="text" id="calcDisplay" class="calc-display" readonly>
                <div class="calc-buttons">
                    <button onclick="EfficiencyTools.calcClear()">C</button>
                    <button onclick="EfficiencyTools.calcInput('/')">/</button>
                    <button onclick="EfficiencyTools.calcInput('*')">×</button>
                    <button onclick="EfficiencyTools.calcBack()">←</button>
                    <button onclick="EfficiencyTools.calcInput('7')">7</button>
                    <button onclick="EfficiencyTools.calcInput('8')">8</button>
                    <button onclick="EfficiencyTools.calcInput('9')">9</button>
                    <button onclick="EfficiencyTools.calcInput('-')">-</button>
                    <button onclick="EfficiencyTools.calcInput('4')">4</button>
                    <button onclick="EfficiencyTools.calcInput('5')">5</button>
                    <button onclick="EfficiencyTools.calcInput('6')">6</button>
                    <button onclick="EfficiencyTools.calcInput('+')">+</button>
                    <button onclick="EfficiencyTools.calcInput('1')">1</button>
                    <button onclick="EfficiencyTools.calcInput('2')">2</button>
                    <button onclick="EfficiencyTools.calcInput('3')">3</button>
                    <button class="calc-equals" onclick="EfficiencyTools.calcEquals()">=</button>
                    <button class="calc-zero" onclick="EfficiencyTools.calcInput('0')">0</button>
                    <button onclick="EfficiencyTools.calcInput('.')">.</button>
                </div>
                <div class="calc-advanced">
                    <button onclick="EfficiencyTools.calcToHex()">HEX</button>
                    <button onclick="EfficiencyTools.calcToBin()">BIN</button>
                    <button onclick="EfficiencyTools.calcTimestamp()">时间戳</button>
                </div>
            </div>
        `;
    },

    calcInput(val) {
        const display = document.getElementById('calcDisplay');
        display.value += val;
    },

    calcClear() {
        document.getElementById('calcDisplay').value = '';
    },

    calcBack() {
        const display = document.getElementById('calcDisplay');
        display.value = display.value.slice(0, -1);
    },

    calcEquals() {
        const display = document.getElementById('calcDisplay');
        try {
            display.value = eval(display.value) || '';
        } catch (e) {
            display.value = 'Error';
        }
    },

    calcToHex() {
        const display = document.getElementById('calcDisplay');
        const val = parseInt(display.value);
        if (!isNaN(val)) {
            display.value = '0x' + val.toString(16).toUpperCase();
        }
    },

    calcToBin() {
        const display = document.getElementById('calcDisplay');
        const val = parseInt(display.value);
        if (!isNaN(val)) {
            display.value = '0b' + val.toString(2);
        }
    },

    calcTimestamp() {
        const display = document.getElementById('calcDisplay');
        display.value = Math.floor(Date.now() / 1000);
    },

    // ========== 颜色工具 ==========
    renderColorPanel() {
        return `
            <div class="color-tool">
                <input type="color" id="colorPicker" class="color-picker" oninput="EfficiencyTools.onColorChange()">
                <div class="color-values">
                    <div class="color-value-row">
                        <label>HEX</label>
                        <input type="text" id="colorHex" readonly>
                        <button onclick="EfficiencyTools.copyColor('hex')">复制</button>
                    </div>
                    <div class="color-value-row">
                        <label>RGB</label>
                        <input type="text" id="colorRgb" readonly>
                        <button onclick="EfficiencyTools.copyColor('rgb')">复制</button>
                    </div>
                    <div class="color-value-row">
                        <label>HSL</label>
                        <input type="text" id="colorHsl" readonly>
                        <button onclick="EfficiencyTools.copyColor('hsl')">复制</button>
                    </div>
                </div>
                <div class="color-history" id="colorHistory"></div>
            </div>
        `;
    },

    onColorChange() {
        const color = document.getElementById('colorPicker').value;
        document.getElementById('colorHex').value = color.toUpperCase();
        
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        document.getElementById('colorRgb').value = `rgb(${r}, ${g}, ${b})`;
        
        // 简化的 HSL 转换
        document.getElementById('colorHsl').value = `hsl(...)`;
    },

    // ========== 正则测试 ==========
    renderRegexPanel() {
        return `
            <div class="regex-tool">
                <div class="regex-input">
                    <label>正则表达式</label>
                    <input type="text" id="regexPattern" placeholder="例如: \d+">
                    <label>标志</label>
                    <input type="text" id="regexFlags" value="g" style="width: 60px;">
                </div>
                <div class="regex-test">
                    <label>测试文本</label>
                    <textarea id="regexText" rows="4" placeholder="输入要匹配的文本..."></textarea>
                </div>
                <button class="btn-primary" onclick="EfficiencyTools.testRegex()">测试匹配</button>
                <div class="regex-result" id="regexResult"></div>
                <div class="regex-presets">
                    <label>常用正则：</label>
                    <button onclick="EfficiencyTools.setRegex('^\\w+@[a-zA-Z_]+?\\.[a-zA-Z]{2,3}$')">邮箱</button>
                    <button onclick="EfficiencyTools.setRegex('^1[3-9]\\d{9}$')">手机号</button>
                    <button onclick="EfficiencyTools.setRegex('\\d{4}-\\d{2}-\\d{2}')">日期</button>
                    <button onclick="EfficiencyTools.setRegex('https?://[^\\s]+')">URL</button>
                </div>
            </div>
        `;
    },

    testRegex() {
        const pattern = document.getElementById('regexPattern').value;
        const flags = document.getElementById('regexFlags').value;
        const text = document.getElementById('regexText').value;
        const resultDiv = document.getElementById('regexResult');

        try {
            const regex = new RegExp(pattern, flags);
            const matches = text.match(regex);
            
            if (matches) {
                resultDiv.innerHTML = `<span class="success">匹配成功！</span><br>共 ${matches.length} 个匹配：<br>${matches.map(m => `<code>${m}</code>`).join(', ')}`;
            } else {
                resultDiv.innerHTML = '<span class="warning">无匹配结果</span>';
            }
        } catch (e) {
            resultDiv.innerHTML = `<span class="error">正则错误: ${e.message}</span>`;
        }
    },

    setRegex(pattern) {
        document.getElementById('regexPattern').value = pattern;
    },

    // ========== 转换工具 ==========
    renderConverterPanel() {
        return `
            <div class="converter-tool">
                <div class="converter-section">
                    <h5>JSON ↔ 对象</h5>
                    <textarea id="jsonInput" rows="3" placeholder="输入 JSON 或 JS 对象..."></textarea>
                    <div class="converter-actions">
                        <button onclick="EfficiencyTools.jsonToObject()">格式化</button>
                        <button onclick="EfficiencyTools.objectToJson()">压缩</button>
                    </div>
                </div>
                <div class="converter-section">
                    <h5>Base64 编解码</h5>
                    <textarea id="base64Input" rows="2" placeholder="输入文本..."></textarea>
                    <div class="converter-actions">
                        <button onclick="EfficiencyTools.toBase64()">编码</button>
                        <button onclick="EfficiencyTools.fromBase64()">解码</button>
                    </div>
                </div>
                <div class="converter-section">
                    <h5>时间戳转换</h5>
                    <input type="text" id="timestampInput" placeholder="时间戳或日期...">
                    <div class="converter-actions">
                        <button onclick="EfficiencyTools.timestampToDate()">转日期</button>
                        <button onclick="EfficiencyTools.dateToTimestamp()">转时间戳</button>
                    </div>
                    <div id="timestampResult"></div>
                </div>
            </div>
        `;
    },

    jsonToObject() {
        const input = document.getElementById('jsonInput');
        try {
            const obj = JSON.parse(input.value);
            input.value = JSON.stringify(obj, null, 2);
        } catch (e) {
            showToast('无效的 JSON');
        }
    },

    objectToJson() {
        const input = document.getElementById('jsonInput');
        try {
            const obj = JSON.parse(input.value);
            input.value = JSON.stringify(obj);
        } catch (e) {
            showToast('无效的 JSON');
        }
    },

    toBase64() {
        const input = document.getElementById('base64Input');
        input.value = btoa(unescape(encodeURIComponent(input.value)));
    },

    fromBase64() {
        const input = document.getElementById('base64Input');
        try {
            input.value = decodeURIComponent(escape(atob(input.value)));
        } catch (e) {
            showToast('无效的 Base64');
        }
    },

    timestampToDate() {
        const input = document.getElementById('timestampInput').value;
        const ts = input.length === 10 ? parseInt(input) * 1000 : parseInt(input);
        const date = new Date(ts);
        document.getElementById('timestampResult').textContent = date.toLocaleString();
    },

    dateToTimestamp() {
        const input = document.getElementById('timestampInput').value;
        const date = new Date(input);
        if (!isNaN(date)) {
            document.getElementById('timestampResult').textContent = 
                `秒: ${Math.floor(date.getTime() / 1000)}\n毫秒: ${date.getTime()}`;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出
window.EfficiencyTools = EfficiencyTools;
