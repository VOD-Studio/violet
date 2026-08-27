# 聊天采用独立的版本化 API 契约

Status: accepted（2026-08-20）

## 背景

聊天功能需要先服务当前 React 前端，后续还要允许其他 Web、移动端或桌面端接入。若直接复用当前前端的查询缓存形状、组件参数或数据库字段，后续客户端会被迫跟随内部实现变化。

聊天还需要处理实时事件、断线补发、消息列表分页、上传重试和跨客户端的发送重试。这些行为必须成为后端契约，而不能由某个前端私自约定。

## 决策

聊天对外提供独立的版本化 REST/JSON 资源接口，并提供单用户 SSE 事件流：

```text
/api/v1/chat/conversations
/api/v1/chat/conversations/{conversationId}
/api/v1/chat/conversations/{conversationId}/members
/api/v1/chat/conversations/{conversationId}/messages
/api/v1/chat/events
```

契约约束：

- API 资源、请求和响应不依赖 React、TanStack Query 或数据库模型。
- 消息列表使用 cursor 分页，按稳定排序加载历史，不使用 offset 分页。
- 消息发送支持 `Idempotency-Key`，网络重试不会制造重复消息。
- 图片先通过通用上传接口获得媒体资源 ID，再用媒体 ID 创建图片消息；消息接口不承载 Base64 文件。
- SSE 事件具有稳定事件 ID、事件类型、契约版本、发生时间和结构化数据，支持 `Last-Event-ID` 断线补发。
- 维护机器可读的 OpenAPI 或等价 schema，覆盖请求、响应、错误、枚举、分页和事件 payload。
- 现有浏览器 session cookie 是第一版认证主路径；跨域 Web 前端通过受控 CORS 或代理接入，不复用 MCP PAT，也不额外引入聊天专用凭证。

## 理由

1. REST 资源适合不同技术栈消费，SSE 足以覆盖当前“HTTP 写入、服务端下行推送”的实时模型。
2. cursor、事件 ID 和幂等键分别解决实时插入导致的分页漂移、断线丢事件和响应丢失重试三类常见客户端故障。
3. 单独的媒体上传契约能复用现有分片上传与图片校验，同时避免消息接口被大文件请求绑定。
4. 机器可读 schema 让其他前端可以生成类型和校验，不需要阅读或复制 Go 内部类型。

## 代价

- 后端需要维护版本化 DTO、事件 schema 和兼容策略，不能直接把领域实体序列化为响应。
- SSE 事件重放需要保存足够的用户事件记录，不能只依赖进程内瞬时广播。
- 真正的跨域或移动端独立登录需求出现时，需重新评估认证、CORS、CSRF 和 token 生命周期，不在本决策中隐式解决。

## 否决的替代方案

- **把领域实体直接作为 JSON 返回**：会把数据库和领域重构变成客户端 breaking change，否决。
- **仅用轮询**：无法提供稳定的低延迟体验，且会增加重复请求，否决。
- **复用 MCP PAT**：PAT 的权限和生命周期面向 MCP，不应成为聊天客户端凭证，否决。
- **消息接口直接接收 Base64 或 multipart 文件**：上传重试、媒体处理和消息幂等边界混杂，否决。
