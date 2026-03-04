# AI 聊天空消息错误修复指南

## ❌ 问题描述

当你在 AI 助手中提问时，出现以下错误：

```
API Error: 400 - {"error":{"message":"Invalid request: the message at position 2 with role 'assistant' must not be empty","type":"invalid_request_error"}}
```

## 🔍 原因分析

这个错误是因为聊天记录中存在**空的 assistant 消息**（之前流式传输失败留下的），导致发送给 Kimi API 的消息格式不正确。

## ✅ 解决方案

### 方案一：使用清理工具（推荐）

关闭应用后，运行以下命令：

```bash
npm run clean-empty-messages
```

这会：
- 删除所有空的 assistant 消息
- 清理未完成的流式消息
- 显示清理结果

然后重启应用即可正常使用。

### 方案二：手动删除（如果方案一无效）

1. 找到数据库文件位置：
   - **Windows**: `%APPDATA%\FlowBoard\flowboard.db`
   - **macOS**: `~/Library/Application Support/FlowBoard/flowboard.db`
   - **Linux**: `~/.config/FlowBoard/flowboard.db`

2. 使用 SQLite 工具打开数据库

3. 执行 SQL 删除空消息：
   ```sql
   DELETE FROM chatMessages 
   WHERE role = 'assistant' 
   AND (content IS NULL OR TRIM(content) = '');
   ```

4. 重启应用

### 方案三：新建对话（临时方案）

如果只是某次对话有问题：
1. 点击左侧边栏的 **"新对话"**
2. 在新的会话中继续提问

---

## 🛡️ 预防措施

代码已更新，现在会自动：
- 过滤掉空的 assistant 消息
- 跳过未完成的流式消息
- 确保发送给 API 的消息都是有效的

但如果数据库中已有历史空消息，仍需手动清理一次。

---

## 💡 验证方法

清理后，你可以：
1. 重启应用
2. 在 AI 助手中随便问一个问题（如"你好"）
3. 如果能正常回复，说明清理成功

---

## ⚠️ 注意事项

- 清理工具只会删除**空的**和**失败的**消息
- 正常的聊天记录不会被删除
- 建议在清理前关闭 FlowBoard 应用

---

## 🆘 仍然无法解决？

如果以上方法都无效：
1. 检查 Kimi API Key 是否正确配置
2. 确认网络连接正常
3. 查看控制台日志获取详细错误信息
4. 尝试切换到其他 AI 提供商（如硅基流动）
