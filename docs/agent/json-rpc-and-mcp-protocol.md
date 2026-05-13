# JSON-RPC 2.0 与 MCP 协议基础

MCP 底层使用 JSON-RPC 2.0 作为消息协议。理解 JSON-RPC 之后，再看 MCP 的 Tools、Resources、Prompts，会更容易明白：MCP 不是随便发 HTTP 请求，而是在一套标准消息格式上做能力协商和调用。

## JSON-RPC 是什么

JSON-RPC 2.0 可以理解为：用 JSON 表达远程方法调用的一套规范。

它关心的是消息长什么样，而不是消息通过什么传输。也就是说，它可以跑在 Stdio、HTTP、WebSocket 或其他通道上。

一个最简单的请求像这样：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

服务端返回：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": []
  }
}
```

`id` 用来把请求和响应对应起来，`method` 表示要调用的方法，`params` 是参数。

## 三种核心消息

### Request

Request 是需要响应的请求。

例如客户端问 MCP Server：“你有哪些工具？”

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "tools/list"
}
```

只要带了 `id`，服务端就应该返回对应响应。

### Notification

Notification 是不需要响应的通知。

它没有 `id`。

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

常见用途是状态通知、事件通知。注意：Notification 不应该返回响应，否则客户端和服务端对协议行为的理解就会不一致。

### Response

Response 是对 Request 的响应。

成功时返回 `result`：

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "ok": true
  }
}
```

失败时返回 `error`：

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "error": {
    "code": -32602,
    "message": "Invalid params"
  }
}
```

`result` 和 `error` 不能同时出现。

## 常见错误码

JSON-RPC 预定义了一些协议错误码：

- `-32700`：Parse error，JSON 解析失败。
- `-32600`：Invalid Request，请求对象不合法。
- `-32601`：Method not found，方法不存在。
- `-32602`：Invalid params，参数不合法。
- `-32603`：Internal error，内部错误。

业务错误不要滥用协议错误码。比如“订单不存在”是业务错误，不应该伪装成 `Method not found`。

## Batch 批处理

JSON-RPC 支持一次发送多个请求。

```json
[
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  },
  {
    "jsonrpc": "2.0",
    "method": "notifications/ping"
  }
]
```

这里第一个是 Request，需要响应；第二个是 Notification，不需要响应。

如果一个 Batch 里全是 Notification，服务端不应该返回空数组。它应该不返回响应。

## MCP 为什么选择 JSON-RPC

MCP 要解决的是大模型应用和外部工具之间的标准化连接问题。它需要的不是某个固定传输方式，而是一套轻量、清晰、跨语言的消息格式。

JSON-RPC 的优势正好匹配：

- 消息格式统一。
- JSON 人类可读，调试方便。
- 传输层无关，可以跑在 Stdio 或 HTTP 流上。
- 支持 Request / Response，也支持 Notification。
- 实现成本比 gRPC 低。

## 为什么不是直接 HTTP

HTTP 是传输协议，能规定请求怎么传，但不规定“方法调用消息”应该怎么组织。

你当然可以用 HTTP POST 自己设计：

```text
POST /callTool
POST /listResources
POST /getPrompt
```

但每个服务都可能设计一套路径、错误格式和参数结构。MCP 想要的是统一的调用协议，所以选择在传输层之上使用 JSON-RPC。

## 为什么不是 gRPC

gRPC 是强类型 RPC 框架，性能好、约束强，但对 MCP 这类场景有点重：

- 需要 `.proto` 定义。
- 调试不如 JSON 直观。
- 对轻量脚本、插件、小工具不够友好。
- 浏览器和本地进程集成时会更复杂。

MCP 更强调轻量、易实现、传输灵活，而不是极致性能。

## JSON-RPC 的局限

JSON-RPC 本身也不是什么都管。

它不负责：

- 鉴权。
- 加密。
- 超时。
- 重试。
- 幂等。
- 类型系统。
- 服务发现。

这些都需要 MCP 实现层或应用层补齐。

## 实践中最容易踩的坑

- 忘记写 `"jsonrpc": "2.0"`。
- Notification 带了响应。
- `result` 和 `error` 同时出现。
- `method` 不是字符串。
- `params` 命名和服务端 schema 对不上。
- Batch 全是 Notification 却返回 `[]`。
- 把业务错误混进协议错误码。

## 工程落地建议

实现 JSON-RPC / MCP 通信时，除了遵守协议，还要补这些工程能力：

- 输入校验：不要相信客户端传来的参数。
- 超时控制：避免一次调用拖死连接。
- 重试策略：只对安全、幂等的请求重试。
- 幂等去重：同一个请求不要重复执行副作用。
- 日志追踪：记录 `id`、`method`、耗时和错误。
- 鉴权签名：远程 Server 必须有权限边界。
- 错误码映射：协议错误和业务错误分开处理。

一句话总结：JSON-RPC 负责“消息长什么样”，MCP 在这个基础上定义“模型应用如何发现和调用工具、资源、提示词”。
