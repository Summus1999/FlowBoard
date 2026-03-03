/**
 * FlowBoard Jest 测试初始化
 * 全局测试配置和模拟
 */

import '@testing-library/jest-dom';

// ============================================
// 全局模拟对象
// ============================================

// 模拟 localStorage
global.localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};

Object.defineProperty(global, 'localStorage', {
  value: global.localStorageMock
});

// 模拟 IndexedDB
global.indexedDB = {
  databases: () => Promise.resolve([]),
  deleteDatabase: () => Promise.resolve(),
  open: jest.fn(() => {
    const request = {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: {
        objectStoreNames: {
          contains: () => false
        },
        createObjectStore: jest.fn(() => ({
          createIndex: jest.fn()
        })),
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            put: jest.fn(() => ({ onsuccess: null })),
            get: jest.fn(() => ({ onsuccess: null })),
            getAll: jest.fn(() => ({ onsuccess: null })),
            delete: jest.fn(() => ({ onsuccess: null })),
            clear: jest.fn(() => ({ onsuccess: null }))
          })),
          oncomplete: null
        }))
      }
    };
    
    // 模拟异步打开成功
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: request });
      }
    }, 0);
    
    return request;
  })
};

// 模拟 window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 模拟 IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() { return null; }
  unobserve() { return null; }
  disconnect() { return null; }
};

// 模拟 ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() { return null; }
  unobserve() { return null; }
  disconnect() { return null; }
};

// 模拟 navigator.clipboard
global.navigator.clipboard = {
  writeText: jest.fn(() => Promise.resolve()),
  readText: jest.fn(() => Promise.resolve(''))
};

// 模拟 window.location
delete window.location;
window.location = {
  href: 'http://localhost',
  reload: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn()
};

// 模拟 window.electronAPI
global.window.electronAPI = {
  getPlatform: jest.fn(() => Promise.resolve('win32')),
  saveData: jest.fn(() => Promise.resolve({ success: true })),
  loadData: jest.fn(() => Promise.resolve({ success: true, data: null })),
  selectFile: jest.fn(() => Promise.resolve({ canceled: false, filePaths: ['/test/path'] })),
  setAutoLaunch: jest.fn(() => Promise.resolve({ success: true })),
  openExternal: jest.fn(),
  saveAiConfig: jest.fn(() => Promise.resolve({ success: true })),
  loadAiConfig: jest.fn(() => Promise.resolve({})),
  testAiProvider: jest.fn(() => Promise.resolve({ success: true }))
};

// 模拟 Monaco Editor
global.monaco = {
  editor: {
    create: jest.fn(() => ({
      getValue: jest.fn(() => ''),
      setValue: jest.fn(),
      setModelLanguage: jest.fn(),
      addCommand: jest.fn(),
      dispose: jest.fn()
    })),
    defineTheme: jest.fn(),
    setTheme: jest.fn()
  },
  KeyMod: { CtrlCmd: 2048 },
  KeyCode: { KeyS: 49, Enter: 3 }
};

// 模拟 require (AMD loader)
global.require = {
  config: jest.fn(),
  onError: jest.fn()
};

// ============================================
// 全局测试工具函数
// ============================================

// 创建 DOM 元素辅助函数
global.createMockElement = (tag, attrs = {}) => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
};

// 模拟 DOM 事件
global.mockEvent = (type, data = {}) => ({
  type,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  target: data.target || {},
  currentTarget: data.currentTarget || {},
  ...data
});

// 等待异步操作完成
global.flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// 重置所有模拟
global.resetAllMocks = () => {
  localStorageMock.clear();
  jest.clearAllMocks();
};

// ============================================
// Jest 配置扩展
// ============================================

// 自定义匹配器
expect.extend({
  toHaveBeenCalledOnceWith(received, ...expected) {
    const pass = received.mock.calls.length === 1 &&
      this.equals(received.mock.calls[0], expected);
    
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to have been called once with ${expected}`
        : `expected ${received} to have been called once with ${expected}`
    };
  }
});

// 测试前清理
beforeEach(() => {
  global.resetAllMocks();
  document.body.innerHTML = '';
});

// 测试后清理
afterEach(() => {
  jest.clearAllTimers();
});
