# Function Calling 与 MCP

## 本章导读

LLM 擅长理解意图、生成内容和规划步骤，但它不是实时数据库、计算器，也不能直接操作订单、支付、文件或内部系统。Function Calling 和 MCP 都是在给模型补上连接外部世界的能力。

先记住这条主线：

- 模型负责理解意图、选择工具、生成参数。
- 后端或 Agent Runtime 负责校验、执行、权限、审计和回填结果。
- 工具负责查询、计算或执行受控业务动作。
- MCP 把工具能力进一步标准化成可发现、可复用、可跨语言接入的服务。

## Function Calling 是什么

Function Calling，也称 Tool Calling，让模型从开发者提供的工具列表中选择合适工具，并输出结构化调用参数。

最重要的边界是：**模型不会真的执行函数。** 它只返回“调用哪个工具、传什么参数”的指令；真正执行工具的始终是 Java 后端、Agent 或业务系统。

### 标准调用链路

1. 后端定义工具名称、描述、参数 Schema 和返回值语义。
2. 将用户问题和工具定义发送给模型。
3. 模型决定是否调用工具，返回工具名和结构化参数。
4. 后端校验参数、用户权限和业务规则。
5. 后端执行查询、计算或业务动作。
6. 将工具结果作为 `tool` 消息或等价上下文回填给模型。
7. 模型生成最终自然语言回答，或继续请求其他工具。

适合的场景包括：实时天气、订单/库存查询、精确计算、内部 API、创建工单、受控业务动作，以及 Agent 的搜索、文件、浏览器等能力。

### 工具 Schema

OpenAI Compatible 风格的工具定义通常包含名称、描述、参数 JSON Schema 和严格模式：

```json
{
  "type": "function",
  "name": "get_weather",
  "description": "查询指定城市的实时天气。",
  "parameters": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "城市名称，例如北京。" },
      "unit": {
        "type": "string",
        "enum": ["celsius", "fahrenheit"],
        "description": "温度单位。"
      }
    },
    "required": ["city"],
    "additionalProperties": false
  },
  "strict": true
}
```

`strict: true` 可以提高参数符合 Schema 的概率，但不能替代服务端校验。

从模型角度看，工具定义本质仍是一份 Prompt：模型只读到工具说明书，并据此预测结构化 tool call；它不知道你的工具内部是怎样实现的。

## 如何设计一个好工具

### 名称、描述和参数必须清楚

工具名应表达业务动作，例如 `get_order_status`、`apply_refund`、`search_knowledge_base`，避免 `doAction` 之类无语义名称。描述要说明何时调用、参数格式和使用边界；每个参数也需要说明。

### 参数少且扁平

参数尽量扁平，避免深层嵌套 JSON。工具最好只暴露当前任务真正需要的 3 到 4 个参数；默认值和内部字段由后端补全。

### 固定候选使用枚举

订单状态、查询类型、业务渠道等固定候选应使用 `enum`。城市、商品名、自由文本等开放集合通常不应强行枚举，除非业务只支持固定白名单。

### 安全参数由后端注入

租户 ID、当前用户 ID、权限范围、Token、组织 ID、审批身份不应由模型生成。它们必须从登录态、安全上下文或会话中获取。

模型生成的参数永远是不可信输入，必须做类型、范围、枚举、权限、幂等和业务状态校验。

### 返回值和错误要可理解

返回值既要让程序可处理，也要让模型读懂。错误不要只抛异常，应返回可恢复信息：

```json
{
  "success": false,
  "code": "CITY_NOT_SUPPORTED",
  "message": "当前工具只支持中国大陆城市，请提供规范城市名称。"
}
```

模型拿到清晰错误后，才能补问、修正参数或选择替代工具。

### 避免复杂工具链

工具结果不会自动进入下一轮模型上下文，应用必须显式回填。不要设计大量彼此强依赖的细粒度工具链；对于稳定的业务组合，可以封装成更高层工具。

## Spring AI 中的 Tool Calling

Spring AI 正式版统一使用 Tool Calling 概念，早期 Function Calling API 已被相应 Tool API 替代。

### 使用 Function Bean 暴露已有服务

已有业务服务可以包装成 Spring Bean 形式的函数式接口：

```java
@Bean
@Description("根据时区查询当前时间")
public Function<TimeRequest, TimeResponse> getTimeFunction(TimeService service) {
    return service::getTimeByZoneId;
}
```

这种方式对应 `FunctionToolCallback`，适合复用已有的 `Function<T, R>`、`Consumer`、`Supplier` 等函数式 Bean。

### 使用 @Tool 定义普通方法

新工具通常更适合使用 `@Tool`：

```java
public class TimeTools {

    @Tool(description = "根据时区查询当前时间")
    public String getTimeByZoneId(
            @ToolParam(description = "时区，例如 Asia/Shanghai") String zoneId) {
        return ZonedDateTime.now(ZoneId.of(zoneId)).toString();
    }
}
```

这种方式对应 `MethodToolCallback`。Spring AI 通过反射读取方法、参数和注解，生成 Schema 并在调用时反射执行方法。

| 类型 | 来源 | 执行方式 | 适合场景 |
| --- | --- | --- | --- |
| `FunctionToolCallback` | 函数式 Bean | 调用函数式接口 | 复用已有函数式集成 |
| `MethodToolCallback` | 带 `@Tool` 的普通方法 | 反射调用方法 | 新业务工具、工具类 |

二者最终都实现 `ToolCallback`，其核心职责是提供工具定义、工具元数据和 `call` 执行入口。

### 使用 ChatClient 注入工具

```java
@GetMapping(value = "/time", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> time(String city) {
    return chatClient.prompt()
            .tools(new TimeTools())
            .user(city + "现在几点？")
            .stream()
            .content();
}
```

默认情况下，Spring AI 会完成模型决策、工具执行、结果回填和最终回答生成。

### 自动执行与手动编排

简单、低风险、同步查询工具可以自动执行。人工审批、异步任务、复杂审计、ReAct、多 Agent 编排或流式 tool call 参数聚合时，应关闭内部自动执行：

```text
internalToolExecutionEnabled = false
```

此时应用自行处理模型 tool call、参数校验、工具执行、结果回填和是否继续下一轮模型调用。

### 流式 Tool Calling 的坑

不同模型在流式响应中返回 tool call 的行为不同：有的会一次返回完整名称和参数，有的会将名称或 `arguments` 拆到多个 chunk。

手动处理时必须先累积完整 tool call，再执行工具。看到首个 tool call 就立即执行，可能遇到工具名或参数尚未完整的问题。高风险工具建议关闭自动执行后统一聚合、校验、审批。

## 实战思路：自动退款客服

“识别质量问题后申请退款”是 Function Calling 的典型场景，但不能只依赖模型的一句话判断。

1. Prompt 识别质量问题、共情并补问确认。
2. 后端从会话和订单系统获取可信的用户、订单、商品信息。
3. 满足触发条件后，模型申请 `apply_refund` 工具调用。
4. 后端校验订单归属、售后状态、退款窗口、幂等状态和风控规则。
5. 工具执行退款申请，返回申请编号和状态。
6. 模型或后端基于真实结果告知用户后续流程。

订单 ID、用户 ID、权限和退款资格必须来自后端。退款、支付、删除、通知等写操作要保留审计日志，并按风险设置人工确认。

## MCP 是什么

MCP，全称 Model Context Protocol，是一个开放协议，用于把 AI 应用与外部 Tools、Resources、Prompts 标准化连接起来。

它不是某个具体框架或 SDK。它的核心价值是把工具从某一个 Agent 的内部代码中拆出来，成为可被多个 Host、不同语言和不同运行环境复用的独立能力服务。

一个常用类比是：Function Calling 像某个应用内部直接调用方法；MCP 像给外部能力制定统一 USB 接口。

## MCP 与 Function Calling 的区别

| 对比项 | Function Calling | MCP |
| --- | --- | --- |
| 核心定位 | 模型选择工具和生成参数的机制 | 外部能力发现、描述与调用的标准协议 |
| 工具定义 | 多数由当前应用维护 | 由 MCP Server 独立暴露 |
| 执行位置 | 通常由当前应用后端执行 | MCP Server 执行，Host/Client 发起协议调用 |
| 复用范围 | 常绑定单个应用或 Agent | 可被多个支持 MCP 的 Host 复用 |
| 跨语言能力 | 取决于业务方自行集成 | 协议天然支持跨语言、跨框架 |
| 典型传输 | 应用内部或自定义 | Stdio、SSE、Streamable HTTP |

二者不互斥。MCP Tools 最终仍会以 Schema 的形式提供给模型，模型在两种方式中都只负责决策；MCP 将能力发现、协议通信和工具执行标准化、服务化。

## MCP 的角色和能力

### Host、Client、Server

- Host：承载 AI 体验的应用，例如 Claude Desktop、Cursor、IDE 或企业 Agent 平台。
- Client：Host 内部为某个 MCP Server 建立的协议客户端，负责连接、初始化和调用。
- Server：独立运行的能力提供方，暴露工具、资源和提示词。

一个 Host 可以连接多个 MCP Server；通常一个 Client 对应一个 Server 连接。

### Tools、Resources、Prompts

- Tools：可执行动作，例如查订单、调用 API、读文件、创建工单。
- Resources：可读取的上下文资源，例如文档、配置、代码、数据库 Schema；不一定在云端。
- Prompts：Server 提供的可复用提示词模板。

## MCP 生命周期与 JSON-RPC

MCP 的数据层通常使用 JSON-RPC 2.0 表达请求、响应、错误和通知。

### 初始化与能力协商

连接建立后，Client 先发送 `initialize`，协商协议版本和双方能力；随后发送 `notifications/initialized`，表示准备完毕。初始化完成前，不应直接开始业务调用。

### 动态发现能力

初始化后，Client 可以调用：

- `tools/list`：获取工具名称、描述、输入 Schema。
- `resources/list`：获取资源。
- `prompts/list`：获取提示词模板。

工具发生变化时，Server 可以发送 `notifications/tools/list_changed`，Client 再刷新工具列表。动态发现避免了工具列表硬编码在 Agent 代码中。

### 调用工具

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": { "city": "Beijing" }
  },
  "id": 101
}
```

成功响应使用 `result`，失败响应使用 `error`，`id` 用于匹配请求与响应。

JSON-RPC 在 MCP 中承担消息格式和生命周期约定，不代表 MCP 等同于传统 RPC 框架。MCP 的重点是向模型提供能力与上下文描述，让模型进行意图驱动的决策；RPC 更关注一次确定的远程过程执行。

## MCP 传输方式

| 传输方式 | 连接形式 | 适合场景 | 注意点 |
| --- | --- | --- | --- |
| Stdio | Host 启动子进程，通过 stdin/stdout 通信 | 本地 IDE、本地助手 | 生命周期绑定 Host；日志应写 stderr，避免污染协议流 |
| SSE | GET 长连接接收事件，POST 端点发送请求 | 旧版远程 MCP | 读写分离，需要心跳、重连和两个端点 |
| Streamable HTTP | 统一 HTTP POST 端点，可流式返回 | 新版远程 MCP、网关和云部署 | 更适配标准 HTTP 基础设施，可按需流式或无状态 |

SSE 是早期远程传输方案；Streamable HTTP 试图解决 SSE 双通道、长连接资源和恢复复杂度问题。新项目优先评估 Streamable HTTP，同时按客户端兼容性决定是否保留 SSE。

## Spring AI 中接入 MCP

### 开发 MCP Server

Spring AI 可以将带 `@Tool` 的 Bean 方法暴露为 MCP Tools。MCP Server 负责工具定义、参数解析和业务调用；业务代码仍需做权限、超时、校验和审计。

传输层可选择 Stdio、本地兼容的 SSE，或更适合远程部署的 Streamable HTTP。

### 开发 MCP Client

Client 选择对应 Transport 后，创建并初始化 `McpSyncClient` 或异步客户端。初始化完成后才发现工具并调用。

把 MCP 工具交给 `ChatClient` 时，框架会将远程工具包装成 `ToolCallback`。链路仍然是：模型选择工具 -> Client 发送 `tools/call` -> Server 执行 -> 结果回填模型或直接返回。

### 跳过模型二次总结

默认工具结果通常再次交给模型总结，适合用户可见的自然语言回答。

以下场景可以跳过总结：工具结果本身就是最终结构化响应、多 Agent 中间步骤、高性能 API、批处理，或工具已经完成检索/推理/生成。

Spring AI 本地 `@Tool(returnDirect = true)` 可以表达直接返回意图。但课程使用的 MCP Callback 实现中，`returnDirect` 元数据不一定会从 MCP Server 自动传递到 Client。遇到这种情况，需要核对版本，必要时自定义 MCP `ToolCallback` 或 Provider 透传元数据，不能假设注解一定生效。

## MCP 生产工程要点

### HTTPS、认证和授权缺一不可

HTTPS 解决传输机密性和完整性；认证确认调用者身份；授权决定该身份能使用哪些工具、读取哪些数据。

- 本地 Stdio 工具常通过环境变量传 API Key，适合单用户本地场景。
- 多用户企业场景不应依赖共享环境变量区分权限。
- 远程 SSE / Streamable HTTP 通常通过 `Authorization: Bearer <token>`、OAuth 或网关认证传递身份。
- Server 应像普通 Web 服务一样通过 Filter、Interceptor、网关或安全框架校验请求。

生产环境不要信任所有 TLS 证书或关闭主机名校验；这类做法只可用于受控本地调试。

### 重连、超时和幂等

远程连接会遇到网络波动、长连接被代理回收、Server 重启和客户端切换。

- SSE 需要心跳、超时和重连策略。
- Streamable HTTP 需要明确会话、恢复和请求超时策略。
- 写操作要提供幂等键，避免重试时重复退款、重复下单或重复通知。
- 工具执行要设置超时、重试边界、熔断和失败降级。

### context-path 与 URI 拼接

MCP 路径对前缀和斜杠高度敏感。推荐：

```text
baseUrl  = http://127.0.0.1:8004/stream/test/
endpoint = api/mcp
```

这会得到：

```text
http://127.0.0.1:8004/stream/test/api/mcp
```

`baseUrl` 缺少末尾 `/` 时，相对路径可能替换最后一段；`endpoint` 以 `/` 开头时，可能覆盖 `context-path`。如果必须配置 `context-path`，保持“baseUrl 以 `/` 结尾，endpoint 不以 `/` 开头”，并让 Client、Server、反向代理和框架版本保持一致。

### 工具过滤

工具不是越多越好。大量工具 Schema 会占用上下文、增加 Token 成本、降低模型选择准确率，并扩大权限攻击面。

只向模型暴露当前用户、当前业务场景和当前意图真正需要的工具集，并结合风险等级、租户和数据范围做过滤。

### 调试工具

MCP Inspector 可以连接 Stdio、SSE、Streamable HTTP Server，查看能力列表、JSON-RPC 消息和工具调用结果，是 MCP Server 开发和排障的常用工具。

排障日志应包含初始化结果、`tools/list` 结果、Transport 地址、工具参数、结果和异常链路，但必须脱敏，不能记录 Token、隐私或敏感业务数据。

## MCP 与其他协议的边界

- HTTP 是传输协议；MCP 可以运行在 HTTP 或 Stdio 之上。
- JSON-RPC 是 MCP 常用的消息格式和生命周期语言。
- gRPC、Dubbo、Feign 等 RPC 框架强调确定性的服务调用；MCP 强调把能力和上下文标准化提供给 AI 决策。
- A2A 解决多个 Agent 间的发现、协商和任务协作；MCP 解决 Agent 如何标准化使用外部工具与资源。

复杂系统中，Agent 可以通过 A2A 协作分工，每个 Agent 再通过 MCP 调用外部能力。

## 与后续章节的边界

- RAG 的检索、向量库和评估：第五章。
- Agent 的 ReAct、规划和多 Agent 协作：第六章。
- Workflow 和 Graph 编排：第七章。
- 对话记忆、长期记忆和摘要压缩：第九章。

## 面试速记

### Function Calling 是什么

Function Calling 让模型根据工具 Schema 选择工具并生成参数。模型只负责决策，应用负责校验和执行；工具结果通常再回填模型生成最终回答。

### 如何设计好工具

工具名、描述、参数和返回值要清晰；参数少且扁平；固定候选用枚举；身份和权限参数由后端注入；错误信息可恢复；高风险写操作必须有校验、幂等、审计和必要的人审。

### MCP 和 Function Calling 的区别

Function Calling 是模型调用工具的基础机制，通常由应用自己维护工具定义和执行逻辑；MCP 是把工具、资源、提示词独立暴露并标准化发现、调用的协议。MCP 可以跨语言、跨客户端复用能力，但模型在两种方式中都只负责决策。

### MCP 的 Host、Client、Server 是什么

Host 是承载 AI 体验的应用；Client 是 Host 内连接某个 MCP Server 的协议客户端；Server 是独立能力提供方，可暴露 Tools、Resources、Prompts。

### Spring AI 的 ToolCallback 有什么区别

`MethodToolCallback` 来自 `@Tool` 普通方法，通常通过反射执行；`FunctionToolCallback` 来自 `Function<T, R>` 等函数式 Bean，通过函数式接口执行。二者都向模型提供工具定义并负责执行入口。

### 为什么 MCP 上线要强调安全

MCP 工具可能访问数据库、文件、订单和内部 API。HTTPS 只保护传输，仍需要认证、授权、最小权限、参数校验、工具过滤、超时、幂等和审计，避免模型或未授权用户越权执行高风险操作。
