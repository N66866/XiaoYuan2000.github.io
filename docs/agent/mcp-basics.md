# MCP 协议入门

MCP 是 Model Context Protocol，可以理解为大模型应用连接外部工具和上下文的一套标准协议。

如果 Function Calling 是“给模型一个工具”，那么 MCP 更像是“用统一标准管理很多工具、资源和提示词模板”。

## Function Call 的痛点

Function Call 能让模型调用工具，但工具变多之后会出现问题：

- 工具定义分散，维护困难。
- 不同语言、不同系统接入方式不统一。
- 权限、安全、审计容易混乱。
- 工具能力变化后，客户端不容易感知。

MCP 试图用统一协议解决这些工程问题。

可以想象一个 IDE 助手：它既要读项目文件，又要查 Git 提交，又要访问公司内部文档。如果每个能力都用一套私有 Function Call 接法，Host 会越来越难维护。MCP 的目标就是让这些能力用统一方式暴露出来。

## MCP 的三个角色

### Host

Host 是宿主应用，比如 IDE、桌面助手、Agent 平台。

用户直接使用的是 Host。

### Client

Client 是 Host 内部用来连接 MCP Server 的客户端。

一个 Host 可以连接多个 MCP Server。

### Server

Server 暴露具体能力，比如文件系统、数据库、Git、搜索服务、业务系统接口。

模型真正能调用的工具和资源，通常由 Server 提供。

一个完整例子：

```text
Host：Cursor / 桌面助手
Client：Host 内部的 MCP 连接
Server：文件系统 MCP Server，暴露“读取文件”“列目录”等能力
```

用户问“帮我看看这个项目的 README”，Host 通过 Client 调用文件系统 Server 读取文件，再把内容交给模型分析。

## MCP 的三大能力

### Tools

Tools 是工具调用能力。

适合执行动作，例如：

- 查询订单。
- 创建工单。
- 发送消息。
- 调用内部 API。

Tools 更像传统 Function Call。

### Resources

Resources 是资源访问能力。

适合暴露可读取的数据，例如：

- 当前项目文件。
- 用户资料。
- 配置内容。
- 某个业务对象详情。

Resources 的重点是“给模型上下文”，不一定是执行动作。

例如“当前打开的 Java 文件内容”更像 Resource，因为它只是上下文；“运行单元测试”更像 Tool，因为它会执行一个动作。

### Prompts

Prompts 是可复用提示词模板。

它可以把团队沉淀的最佳实践封装起来，供 Host 或用户选择使用。

比如：

- 代码审查模板。
- SQL 优化模板。
- 事故复盘模板。

## MCP 与 Function Call 的关系

MCP 不是简单替代 Function Call，而是在更高层做标准化。

可以这样理解：

- Function Call 关注模型怎么调用一个函数。
- MCP 关注工具、资源、提示词如何被发现、描述、连接和管理。

## 传输机制

### Stdio

通过标准输入输出通信。

适合本地工具、命令行进程、IDE 插件场景。

优点是简单、安全边界清晰。缺点是不适合远程服务。

### SSE / Streamable HTTP

通过 HTTP 流式通信。

适合远程服务、平台化部署和跨机器调用。

远程 MCP Server 需要更认真地考虑鉴权、限流、审计和网络稳定性。

## Java SDK 的分层理解

官方 Java SDK 可以按四层理解：

- Schema 层：协议对象和数据结构。
- Transport 层：负责 Stdio、SSE、Streamable HTTP 等通信。
- Session 层：管理一次连接中的消息交互。
- Client / Server 层：开发者最常使用的 API。

如果使用 Spring AI，很多底层细节会被封装；如果直接用官方 SDK，就能更清楚地控制协议和传输。

## Tools、Resources、Prompts 怎么选

| 能力 | 适合做什么 | 例子 |
| --- | --- | --- |
| Tools | 执行动作 | 查订单、发邮件、创建任务 |
| Resources | 提供上下文数据 | 文件内容、用户资料、配置项 |
| Prompts | 固化任务模板 | 代码审查、摘要、排障流程 |

一个简单判断：

- 需要“做事”：用 Tools。
- 需要“读资料”：用 Resources。
- 需要“复用一套提示词流程”：用 Prompts。

比如“读取 `pom.xml` 内容”适合 Resource，“执行 `mvn test`”适合 Tool，“按团队规范生成代码 Review 提示词”适合 Prompt。

## MCP 落地时要关注什么

- 工具命名是否清晰。
- 入参 schema 是否稳定。
- 权限边界是否明确。
- 调用日志是否可追踪。
- 工具失败时模型如何兜底。
- Server 能力变化后客户端如何更新。

MCP 的价值不只在协议本身，而在于让 Agent 工具生态变得更可管理。
