/**
 * FlowBoard Jest 配置文件
 * 用于前端 JavaScript 模块的单元测试
 */

module.exports = {
  // 根目录（项目根目录）
  rootDir: '../..',
  
  // 测试环境
  testEnvironment: 'jsdom',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/tests/unit/frontend/**/*.test.js'
  ],
  
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json'],
  
  // 转换器配置
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // 模块名称映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1'
  },
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  
  // 覆盖率配置
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.min.js',
    '!js/**/languages.js',
    '!js/**/code-snippets.js'
  ],
  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // 测试超时
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
  
  // 清除模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 忽略路径
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/ai_service/'
  ]
};
