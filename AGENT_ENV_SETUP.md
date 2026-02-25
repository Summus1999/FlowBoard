# FlowBoard 云端 Agent 环境建议

## 目标

- 让云端 Agent 启动时默认具备 FlowBoard 依赖
- 当 `package-lock.json` 未变化时跳过重复安装
- 当 lock 变化时自动增量更新依赖

## 基础镜像建议

- Node.js 20.x
- npm 10.x 或以上
- 预置 npm 缓存目录，例如 `~/.npm`
- 可选环境变量：
  - `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`

## 启动脚本建议

```bash
cd /workspace
npm run bootstrap:deps
```

## 脚本行为说明

`scripts/ensure-node-deps.js` 会执行以下逻辑：

1. 读取 `package-lock.json` 并计算 SHA256
2. 对比 `~/.cache/flowboard/npm-lock.sha256`
3. 若 hash 未变化且 `node_modules` 存在，则跳过安装
4. 若 hash 变化或 `node_modules` 缺失，则执行：
   - `npm ci --prefer-offline --no-audit`
5. 安装成功后回写 hash 标记

## 验证命令

```bash
node -v
npm ls fast-xml-parser --depth=0
```
