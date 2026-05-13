# Java Agent 开发落地提示

这一篇不展开完整项目代码，只把前面 10 篇源文档里偏 Java 工程落地的内容抽出来，作为后续 Agent 开发篇的预备笔记。

## 调用大模型 API

Java 后端调用大模型时，建议先封装一个模型客户端，而不是把 HTTP 请求散落在业务代码里。

这个客户端至少要处理：

- API Key 配置。
- Base URL 配置。
- model 参数。
- 非流式调用。
- 流式调用。
- 超时和重试。
- 错误响应解析。
- token usage 记录。

后续如果从 SiliconFlow 切换到其他 OpenAI 兼容服务，只需要改客户端配置或适配层。

## 非流式接口封装

非流式接口适合作为普通 service 方法：

```java
String answer = llmClient.chat(messages);
```

业务层不应该关心 HTTP 细节，只关心输入 messages 和输出 answer。

适合场景：

- 摘要
- 分类
- 结构化抽取
- 后台批处理

## 流式接口封装

流式接口不要简单返回字符串，而要考虑回调或响应式处理。

可以抽象成：

```java
llmClient.streamChat(messages, chunk -> {
    // 把增量内容推给前端
});
```

在 Web 项目中，常见做法是后端用 SSE 转发给前端。

需要特别注意：

- 连接中断时要释放资源。
- 模型输出结束时要发送完成事件。
- 异常要能通知前端。
- 最终完整内容要落日志，方便审计。

## Spring Boot SSE 服务端

如果前端需要类似 ChatGPT 的打字机效果，后端可以用 `SseEmitter` 转发模型流式响应。

生产环境要补齐这些能力：

- 设置合理超时时间。
- 定时发送心跳，避免代理断开连接。
- 检测客户端断连，及时停止模型请求。
- 使用线程池管理流式任务。
- 在 Nginx 中关闭响应缓冲。
- 定义 `message`、`error`、`done` 等事件类型。

前端不应该直连大模型 API。API Key、权限校验、RAG 检索、日志审计都应该留在后端。

## 文档解析服务

RAG 入库可以单独抽一个 `DocumentParser` 服务。

职责包括：

- 检测文件真实类型。
- 调用 Tika 抽取文本。
- 抽取基础元数据。
- 处理乱码、空文本、异常文件。
- 对扫描件标记为需要 OCR。

不要让解析逻辑直接混在 Controller 或入库任务里。

## Chunk 服务

分块逻辑建议独立成 `ChunkSplitter`。

输入是文档文本和结构信息，输出是 chunk 列表。

每个 chunk 至少包含：

- `chunkId`
- `docId`
- `content`
- `chunkIndex`
- `metadata`

如果后续要支持不同策略，可以定义接口：

```java
interface ChunkSplitter {
    List<Chunk> split(DocumentText document);
}
```

然后实现固定分块、递归分块、Markdown 标题分块等策略。

## 元数据模型

元数据不要随便塞字符串，建议从一开始就有清晰结构。

常见字段：

```java
class ChunkMetadata {
    String docId;
    String fileName;
    String sourceType;
    String headingPath;
    Integer pageNumber;
    Integer chunkIndex;
    String version;
    LocalDateTime updatedAt;
    Set<String> departments;
    Set<String> roles;
}
```

真实项目里可以根据业务裁剪，不要一开始过度设计，但文档来源、位置、权限、版本这几类最好提前考虑。

## Embedding 服务

Embedding 调用也建议封装成服务：

```java
float[] vector = embeddingClient.embed(text);
```

批量入库时要注意：

- 批处理大小。
- API 限流。
- 失败重试。
- 向量维度一致性。
- 文本过长时的截断或重新分块。

向量维度必须和向量数据库 schema 保持一致。模型一换，维度可能就变了，索引也可能要重建。

## 向量库访问层

向量数据库建议封装成 Repository 或 Gateway。

它要负责：

- 创建 collection。
- 写入 chunk、向量和元数据。
- 向量检索。
- 标量字段过滤。
- 删除或重建某个文档的 chunk。
- 返回分数和来源信息。

业务层不要直接依赖 Milvus SDK 的细节，后续才好替换实现。

## 权限过滤

权限过滤要尽量发生在检索阶段，而不是生成阶段。

错误做法：

```text
先把所有 chunk 检索出来，再告诉模型不要回答用户无权查看的内容。
```

正确做法：

```text
检索时就按用户部门、角色、ACL 过滤，只把有权限的 chunk 交给模型。
```

模型不是权限系统，不能把安全责任交给 Prompt。

## 推荐模块划分

一个 Java RAG / Agent 项目可以先拆成这些模块：

- `llm-client`：大模型 Chat API。
- `embedding-client`：Embedding API。
- `document-parser`：文档解析。
- `chunk-splitter`：文本分块。
- `vector-store`：向量库读写。
- `retrieval-service`：检索、融合、重排序。
- `answer-service`：组装 Prompt，调用模型生成答案。
- `audit-log`：记录问题、召回资料、回答、token 用量。

这样拆的好处是：后续接 MCP、工具调用、记忆系统、多 Agent 协作时，不会把所有能力挤在一个 service 里。

## Query Rewrite 与 Router

当系统开始支持多轮对话和工具调用时，可以增加两个前置模块：

- `query-rewrite-service`：负责指代消解、上下文补全、口语转正式。
- `intent-router`：负责判断问题走 RAG、工具调用、闲聊还是澄清。

Router 不建议直接写成一堆散落的 `if-else`。可以先定义统一结果：

```java
class RouteDecision {
    String intent;
    String rewrittenQuery;
    double confidence;
    String reason;
}
```

这样后续要记录日志、监控准确率、做兜底都会方便很多。

## Function Calling

Function Calling 建议单独抽一个工具调用层，不要让业务代码直接散在模型响应解析里。

可以先定义工具注册表：

```java
interface AgentTool {
    String name();
    String description();
    Object execute(Map<String, Object> arguments);
}
```

核心流程包括：

- 把工具定义转换成模型 API 需要的 `tools` 数组。
- 解析模型返回的 `tool_calls`。
- 根据工具名路由到具体 Java 方法。
- 校验参数和权限。
- 执行工具并拿到结构化结果。
- 把工具结果作为第二轮消息发回模型。

工具描述要认真写。模型会根据 `name`、`description` 和参数 schema 判断是否调用工具。

工具调用必须经过后端安全控制，尤其是写操作、敏感查询和跨系统调用。模型只能提出调用意图，不能直接拥有执行权限。

## 工具治理与稳定性

工具一旦进入生产环境，就要按后端接口来治理。

工具设计建议：

- 单一职责：一个工具只做一件事。
- 参数最小化：只暴露必要参数。
- 返回值结构化：统一 `success`、`code`、`message`、`data`。
- 写操作幂等：使用 `requestId` 避免重复执行。
- 工具描述清晰：写明何时使用、何时不要使用。

稳定性建议：

- 每个工具设置超时。
- 查询类工具可以有限重试。
- 写操作谨慎重试，必要时不自动重试。
- 外部系统故障时提供降级话术。
- 高频失败时熔断，避免拖垮系统。

安全建议：

- 工具执行前做权限校验。
- 参数做格式校验和注入防护。
- 敏感字段返回前脱敏。
- 删除、退款、取消订单等高风险操作需要二次确认。
- 记录审计日志：用户、工具名、参数摘要、结果、耗时。

可观测性建议：

- 监控调用量、成功率、耗时、错误码。
- 串联用户问题、模型 `tool_calls`、工具结果和最终回答。
- 对工具描述变更做 A/B 测试，观察误调用率是否下降。

## 会话记忆

多轮对话的记忆本质是保存并重新传入历史消息。

Java 项目里可以先做三层：

- 内存实现：方便本地 demo。
- Redis 实现：保存在线会话，设置过期时间。
- 数据库归档：保存需要审计或分析的历史。

推荐策略是“摘要 + 最近 N 轮”。旧对话压缩为摘要，最近几轮保留原文，避免 token 不断膨胀。

## MCP Server

接入 MCP 时，可以把业务能力封装成 MCP Server 暴露出去。

最常见的是 Tools：

- 查询订单。
- 查询用户信息。
- 创建工单。
- 触发内部流程。

Resources 适合暴露可读取上下文，Prompts 适合封装可复用提示词模板。

工程上要注意：

- 工具入参 schema 要稳定。
- 工具名和描述要让模型容易理解。
- 每个工具都要有权限校验。
- 工具调用要记录日志。
- 工具失败要返回可理解的错误，而不是直接抛堆栈。

如果只是 Spring 项目内部使用，可以优先看 Spring AI 的封装；如果要理解协议细节或做底层集成，再直接使用官方 Java SDK。

## JSON-RPC 与 MCP 协议实现

MCP 底层使用 JSON-RPC 2.0 时，要特别注意协议对象的合法性。

实现时建议统一封装：

- `JsonRpcRequest`
- `JsonRpcNotification`
- `JsonRpcResponse`
- `JsonRpcError`

几个容易踩坑的点：

- Request 必须带 `id`，Notification 不带 `id`。
- Notification 不应该返回响应。
- Response 中 `result` 和 `error` 不能同时出现。
- 协议错误码和业务错误码要分开。
- Batch 请求中只有带 `id` 的请求需要响应。

远程 MCP Server 还要补齐鉴权、超时、重试、幂等和链路追踪。JSON-RPC 只规定消息格式，不负责这些工程能力。

## RAG 评估任务

RAG 项目建议尽早做评估脚手架，而不是等效果不好时再补。

可以准备一个评测数据结构：

```java
class RagEvalCase {
    String question;
    String expectedAnswer;
    List<String> goldenChunkIds;
    String category;
}
```

评估任务做三件事：

- 批量执行检索，计算 Hit Rate、MRR 等指标。
- 批量生成答案，检查忠实度和相关性。
- 输出报告，对比每次 Prompt、chunk 策略、embedding 模型调整后的效果。

有了评估闭环，RAG 优化才不会全靠感觉。
