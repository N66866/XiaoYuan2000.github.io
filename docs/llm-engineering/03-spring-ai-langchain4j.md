# Spring AI 与 LangChain4j

## 本章导读

Java 调用大模型最简单的方式是直接发 HTTP 请求，但真实的大模型应用不只是“把问题发给模型，再拿到回答”。一旦进入生产系统，就会遇到 Prompt 管理、流式输出、结构化输出、对话记忆、工具调用、RAG、可观测、超时重试、安全校验等一整套工程问题。

Spring AI 和 LangChain4j 的价值，就是把这些常用能力抽象出来，让 Java 后端可以在熟悉的编程模型中构建 LLM 应用。

本章重点整理三件事：Java 为什么需要 LLM 应用框架、Spring AI / Spring AI Alibaba 如何承载 Spring 生态 AI 应用、LangChain4j 如何用低层 API 和 `AI Services` 抽象大模型能力。

## Java 为什么需要 LLM 应用框架

### 直接 HTTP 调用可以做什么

很多模型平台都提供 OpenAI Compatible API。以对话模型为例，请求通常会包含：

- `model`：模型名称。
- `messages`：对话消息，包含 `system`、`user`、`assistant` 等角色。
- `stream`：是否开启流式输出。
- `Authorization`：API Key。
- `Content-Type`：通常是 `application/json`。

Java 里可以用 JDK 自带的 `HttpClient`、OkHttp、WebClient、RestTemplate 等任意 HTTP 客户端调用模型。

简化理解：

```java
HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(apiUrl))
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer " + apiKey)
        .POST(HttpRequest.BodyPublishers.ofString(requestBody))
        .build();

HttpResponse<String> response = client.send(
        request, HttpResponse.BodyHandlers.ofString());
```

这种方式能跑通最简单的模型调用，但它只是“能调通”，不等于适合构建完整 AI 应用。

### 直接 HTTP 调用的问题

如果只用 HTTP Client，很多能力都要自己手写：

- 请求体组装。
- 多模型供应商适配。
- System Prompt / User Prompt 管理。
- 模型参数管理，例如 temperature、top-p、max tokens。
- 流式输出解析。
- JSON 结构化输出解析。
- 对话历史拼装。
- RAG 上下文注入。
- 工具调用参数解析和结果回填。
- 超时、重试、错误处理。
- 日志、指标、链路追踪和审计。

所以，面试里如果问“为什么不用 HttpClient 直接调模型”，可以这样答：

> HttpClient 能完成最基础的模型调用，但生产级 LLM 应用需要 Prompt 管理、流式输出、结构化输出、记忆、RAG、工具调用、可观测和安全控制。如果全部手写，会重复、难维护、难扩展。Spring AI 的价值不是少写几行 HTTP 代码，而是提供一套面向 Spring 生态的 AI 应用工程抽象。

## Spring AI 是什么

Spring AI 是 Spring 生态面向 AI 应用开发的一套框架。它不是简单封装模型 API，而是希望让 Java 开发者像使用 JDBC、RestClient、Spring Data 一样使用 AI 能力。

它覆盖的典型能力包括：

- Chat Model：对话模型调用。
- Embedding Model：向量模型调用。
- Prompt：提示词和消息建模。
- PromptTemplate：提示词模板。
- Structured Output：结构化输出。
- Chat Memory：对话记忆。
- Tool Calling：工具调用。
- RAG：检索增强生成。
- VectorStore：向量数据库接入。
- Advisor：模型调用链增强。
- Observation：可观测能力。

可以把 Spring AI 理解成：**Spring Boot 项目里的 LLM 应用开发基础设施**。

## Spring AI Alibaba 是什么

Spring AI Alibaba 基于 Spring AI 构建，重点增强阿里云通义、DashScope/百炼和企业级智能体开发能力。

它和 Spring AI 的关系可以这样理解：

- Spring AI 提供通用 AI 应用抽象。
- Spring AI Alibaba 继承 Spring AI，并针对阿里云生态和企业 Agent 场景做增强。

### 主要增强点

Spring AI Alibaba 不只是“接百炼更方便”，还提供了更偏企业级的能力：

- DashScope / 百炼模型接入。
- RAG 知识库方案。
- Graph 工作流编排。
- Agent / Multi-Agent 支持。
- Nacos MCP Registry 等企业级 MCP 集成。
- ARMS、Langfuse 等可观测集成。
- JManus、DeepResearch 等开箱即用的智能体产品。

其中 Graph 是比较重要的增强。它受 LangGraph 思路影响，用有向图、DAG 和循环来组织智能体工作流，适合多步骤、多角色、可回溯的 Agent 应用。

### Spring AI 与 Spring AI Alibaba 对比

| 维度 | Spring AI | Spring AI Alibaba |
| --- | --- | --- |
| 基础能力 | 模型抽象、Prompt、Embedding、RAG | 继承 Spring AI |
| 模型生态 | 多厂商模型适配 | 强化 DashScope / 百炼 |
| 工作流编排 | 需要自己组合 | Graph 工作流增强 |
| Agent 能力 | 偏底层能力，需要手动实现 | 内置 Agent / Multi-Agent 能力 |
| 企业治理 | 基础可观测 | 阿里云生态、可观测、治理增强 |
| 适合场景 | 通用 Spring Boot AI 应用 | 阿里云生态、企业级 Agent、复杂编排 |

## 快速接入 DashScope

课程示例中通过 Spring AI Alibaba 接入 DashScope。核心步骤通常是：

1. 引入 Spring AI Alibaba BOM。
2. 引入 DashScope starter。
3. 在配置文件中配置 API Key。
4. 注入 `ChatModel` 或 `ChatClient` 开始调用。

示例配置形态：

```yaml
spring:
  ai:
    dashscope:
      api-key: ${DASHSCOPE_API_KEY}
```

工程注意点：

- 不要把 API Key 写死在代码里，应使用环境变量、配置中心或密钥管理服务。
- Spring AI / Spring AI Alibaba 版本变化较快，BOM、starter、包名和 API 方法要保持版本一致。
- 课程中的版本可以作为学习基准，真实项目要以项目实际依赖版本为准。

## Spring AI 核心抽象

### ChatModel

`ChatModel` 是 Spring AI 中和对话模型交互的底层统一接口。无论底层是 OpenAI、DashScope、Ollama，还是其他模型服务，在 Spring AI 里都可以抽象成 `ChatModel`。

它通常支持两类调用：

- `call(Prompt)`：非流式调用，一次性返回完整响应。
- `stream(Prompt)`：流式调用，返回响应式流。

具体实现包括：

- `DashScopeChatModel`：用于调用 DashScope / 百炼。
- `OllamaChatModel`：用于调用本地 Ollama 模型。

### Prompt

`Prompt` 是模型输入。它通常包含：

- `Message` 列表：system、user、assistant、tool 等消息。
- `ChatOptions`：模型参数，例如模型名、temperature、top-p、max tokens 等。

可以把 `Prompt` 理解为一次模型调用的完整输入对象。

### Message

`Message` 表示对话中的一条消息。常见角色包括：

- System：系统提示词，控制角色、规则和边界。
- User：用户输入。
- Assistant：模型历史回复。
- Tool：工具调用结果。

这和 OpenAI 风格的 `messages` 结构是一致的。

### ChatOptions

`ChatOptions` 用来设置模型调用参数，例如：

- 模型名称。
- temperature。
- top-p。
- max tokens。
- stop。
- 厂商特定参数。

这些参数决定模型输出的稳定性、发散程度、长度和具体调用行为。

### ChatResponse

`ChatResponse` 是模型输出。它不仅包含文本结果，还可能包含元信息，例如：

- 生成内容。
- token 使用情况。
- finish reason。
- 模型响应元数据。

从第一章的原理看，`ChatResponse` 可以理解为模型基于 `Prompt` 预测生成后的响应结果。

## ChatModel 与 ChatClient

### ChatModel 更底层

`ChatModel` 是模型调用抽象，适合框架底层、简单封装或需要直接控制 `Prompt` 的场景。

示意：

```java
Prompt prompt = new Prompt("你好，介绍一下 Java");
ChatResponse response = chatModel.call(prompt);
```

流式调用：

```java
Flux<ChatResponse> stream = chatModel.stream(prompt);
```

这里的 `Flux` 是 Reactor 的响应式流类型，适合承载流式 token 或 chunk。它不是普通异步类，而是响应式编程里的数据流抽象。

### ChatClient 更适合业务开发

`ChatClient` 是 Spring AI 提供的更高层门面，封装了 Prompt 构建、模型参数、Advisor、结构化输出、流式响应等能力。

常见写法：

```java
String content = chatClient
        .prompt("你好，介绍一下 Java")
        .call()
        .content();
```

流式写法：

```java
Flux<String> content = chatClient
        .prompt("你好，介绍一下 Java")
        .stream()
        .content();
```

业务开发里通常优先使用 `ChatClient`，因为它更接近“应用层 API”。

### ChatClient 默认配置

构造 `ChatClient` 时可以设置默认项：

- `defaultSystem`：默认系统提示词。
- `defaultUser`：默认用户提示词。
- `defaultOptions`：默认模型参数。
- `defaultAdvisors`：默认增强器。
- `defaultTools`：默认工具。

需要注意：运行时重新指定的 system/user/options 可能覆盖默认配置。默认配置适合放通用规则，动态用户输入仍然应该在每次调用时传入。

### 面试回答：ChatModel 和 ChatClient 区别

> ChatModel 是 Spring AI 的底层模型调用抽象，负责统一不同厂商对话模型的 call 和 stream 能力；ChatClient 是面向业务开发的高层门面，封装了 Prompt 构建、Options、Advisor、结构化输出和流式调用。一般业务开发优先用 ChatClient，底层扩展或特殊控制时再直接使用 ChatModel。

## 流式输出

### 为什么需要流式输出

大模型生成内容是一个 token 接一个 token 产生的。如果等完整回答生成后再返回，用户会感觉响应很慢。流式输出可以边生成边返回，提升交互体验。

通用 Web 场景里常见方案包括：

- SSE：Server-Sent Events。
- `SseEmitter`。
- `StreamingResponseBody`。
- WebFlux `Flux`。

课程中建议 Spring 场景优先考虑 WebFlux / `Flux`，因为代码更简洁，也和 Spring AI 的流式接口天然契合。

### Spring AI 中的流式输出

`ChatModel` 和 `ChatClient` 都支持流式调用：

```java
Flux<ChatResponse> response = chatModel.stream(prompt);
```

```java
Flux<String> content = chatClient.prompt(message)
        .stream()
        .content();
```

如果返回给浏览器，通常需要设置响应类型：

```java
@GetMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> chat(String message) {
    return chatClient.prompt(message).stream().content();
}
```

工程注意点：

- 响应类型通常使用 `text/event-stream`。
- 编码注意 UTF-8，避免中文乱码。
- 要处理客户端断开连接、超时和异常。
- 流式输出适合展示文本，但结构化对象解析通常需要完整结果。

## Prompt 模板管理

### PromptTemplate

Spring AI 提供 `PromptTemplate` 来管理提示词模板。它支持通过变量占位符渲染 Prompt。

示例：

```java
PromptTemplate promptTemplate =
        new PromptTemplate("请给我推荐几个关于 {topic} 的开源项目");

Prompt prompt = promptTemplate.create(Map.of("topic", "Spring AI"));
```

模板的价值是把稳定提示词和动态输入分开：

- 稳定部分：角色、任务、格式、规则。
- 动态部分：用户问题、业务参数、检索资料。

### 提示词外置

真实项目里不建议把大段 Prompt 写死在 Java 代码中。更好的做法是外置到配置文件或 `.st` 模板文件中，再通过 `Resource` 加载。

好处：

- 修改 Prompt 不需要改业务代码。
- 方便版本管理。
- 方便评测和回滚。
- 方便不同场景复用。

这和第二章 Prompt Engineering 的结论一致：Prompt 应该模板化、版本化、可测试。

## 结构化输出

### 为什么需要结构化输出

如果模型回答是给人看的，自然语言通常够用。但如果模型输出要继续被程序处理，就必须结构化。

常见场景：

- 生成 API 参数。
- 抽取表单字段。
- 生成分类标签。
- 输出 Java 对象。
- 进入后续工作流节点。

只靠一句“请输出 JSON”不够稳定。模型可能输出多余解释、字段缺失、类型错误或 JSON 不合法。

### StructuredOutputConverter

Spring AI 提供 `StructuredOutputConverter` 来辅助结构化输出。

它背后主要做两件事：

1. 调用模型前，向 Prompt 中追加格式说明，让模型知道应该输出什么结构。
2. 调用模型后，把模型输出的完整文本解析并转换成 Java 类型。

也就是说，它不只是“追加一句 JSON 输出”，还负责后处理转换。

### BeanOutputConverter

`BeanOutputConverter` 可以把模型输出转换成 Java Bean。

示意：

```java
BeanOutputConverter<Book> converter =
        new BeanOutputConverter<>(Book.class);

String format = converter.getFormat();
```

`getFormat()` 会生成格式约束，通常被放进 Prompt 里，指导模型按目标 Bean 字段输出。

拿到模型完整结果后，再转换：

```java
Book book = converter.convert(result);
```

### entity 方法

`ChatClient` 也提供更简洁的方式：

```java
Book book = chatClient
        .prompt("请推荐一本 Java 相关的书")
        .system("你是一个专业图书推荐人员")
        .call()
        .entity(Book.class);
```

底层仍然是构造输出转换器、注入格式要求、调用模型、解析结果。

### 结构化输出注意点

- 转 Bean 需要完整字符串结果，不适合直接对 `Flux<String>` 的分片做最终对象转换。
- 结构化输出仍然要做后端校验，不能只信模型。
- JSON 解析失败时要有重试、修复或降级策略。
- List、Map、泛型对象可以通过对应 Converter 或 `ParameterizedTypeReference` 处理。

## 对话记忆

### 手动维护 Message List

最直接的记忆方式，是把历史消息保存下来，每次请求时组装成 `List<Message>` 再交给模型。

优点是直观，缺点是：

- 每个接口都要手动拼装。
- 历史消息过多会占用上下文窗口。
- 多会话、多用户场景管理麻烦。

### MessageWindowChatMemory

`MessageWindowChatMemory` 是 Spring AI 提供的窗口式短期记忆。它只保留最近一定数量的消息，超过窗口大小时移除更早消息。

注意：`maxMessages` 统计的是全部消息，包括 user、assistant、system、tool 等，不只是用户输入。

它适合短期多轮对话，但本质上仍然是上下文窗口管理，不等于长期记忆。

### MessageChatMemoryAdvisor

`MessageChatMemoryAdvisor` 可以把记忆能力挂到 `ChatClient` 调用链中。它会在模型调用前后自动处理历史消息：

- 调用前：根据会话 ID 取出历史消息，注入上下文。
- 调用后：把用户输入和模型回复写回记忆。

它解决的是“不要每次手动维护 Message List”的问题。

### ChatMemory.CONVERSATION_ID

多用户、多会话场景必须区分会话。Spring AI 里可以通过 `ChatMemory.CONVERSATION_ID` 传入当前会话 ID。

示意：

```java
chatClient.prompt()
        .user(message)
        .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, chatId))
        .call()
        .content();
```

这样同一个 `chatId` 下的对话会被归为同一组记忆。

### 持久化记忆

内存记忆应用重启后会丢失，多实例部署也不共享。如果需要跨重启、跨实例、可审计，就要使用持久化存储。

Spring AI 通过 `ChatMemoryRepository` 扩展存储能力，常见实现包括：

- JDBC。
- Cassandra。
- Neo4j。
- CosmosDB。
- MongoDB。

课程中提到 JDBC 方案，本质是把对话消息按 conversation id 和 timestamp 存储起来，再由 `MessageWindowChatMemory` 或 Advisor 读取。

更深入的长期记忆、摘要记忆、语义记忆，会放到后续 LLM 记忆章节展开。

## Advisor 机制

### Advisor 像 AI 调用链上的 AOP

Spring AI 的 `Advisor` 可以理解成模型调用链上的插件或拦截器，和 Spring AOP 很像。

它可以在模型调用前后做增强：

- 调用前修改 Prompt。
- 注入历史记忆。
- 注入 RAG 检索上下文。
- 做安全拦截。
- 打印日志。
- 记录观测指标。
- 调用后处理响应。

### CallAdvisor 与 StreamAdvisor

Advisor 分同步和流式两类：

- `CallAdvisor`：增强非流式调用。
- `StreamAdvisor`：增强流式调用。

它们分别对应 `call()` 和 `stream()` 调用链。

Advisor 会按顺序执行，所以顺序很重要。比如：

- 安全拦截应该在真正调用模型前执行。
- 记忆注入应该在模型调用前完成。
- 日志可以包裹整个调用过程。
- 最终调用模型的 Advisor 通常在链路末尾。

### 常见内置 Advisor

常见 Advisor 包括：

- `SimpleLoggerAdvisor`：记录请求和响应日志。
- `SafeGuardAdvisor`：做安全审查或敏感词拦截。
- `MessageChatMemoryAdvisor`：注入和写入对话记忆。
- RAG 相关 Advisor：注入检索上下文。

面试表达：

> Advisor 是 Spring AI 模型调用链上的增强器，类似 AOP。它可以在模型调用前后插入日志、记忆、安全、RAG 等逻辑。Advisor 的顺序会影响最终 Prompt、上下文和调用结果，所以生产中要明确设计调用链顺序。

## 本地模型接入

Spring AI 也支持本地模型，例如 Ollama。

接入后，`OllamaChatModel` 和 `DashScopeChatModel` 一样都可以作为 `ChatModel` 使用。

这体现了 Spring AI 的模型抽象价值：

- 云模型是 `ChatModel`。
- 本地模型也是 `ChatModel`。
- 业务层可以尽量面向统一接口开发。

适合使用本地模型的场景：

- 数据不能出内网。
- 需要离线部署。
- 成本敏感。
- 对模型能力要求没那么高。
- 做本地开发和原型验证。

## LangChain4j 是什么

LangChain4j 可以理解成 Java 版 LangChain 思路的大模型应用开发框架。它把模型调用、Prompt、Memory、Tool、RAG 等能力抽象成 Java 组件，让 Java 开发者可以更方便地构建 LLM 应用。

它和 Spring AI 的关系可以这样理解：

- 二者都在解决 Java LLM 应用工程化问题。
- Spring AI 更贴近 Spring 官方生态。
- LangChain4j 可以独立于 Spring 使用，也可以和 Spring Boot 集成。
- LangChain4j 的 `AI Services` 抽象更像 Spring Data JPA：开发者定义接口，框架通过代理生成实现。

所以它们可以看作竞品，也可以看作两套不同风格的 Java LLM 应用框架。学习时重点不是站队，而是理解它们如何抽象模型、Prompt、记忆、工具和 RAG。

## LangChain4j 快速接入

### 依赖和配置

使用 OpenAI Compatible 接口时，可以引入 LangChain4j 核心包和 OpenAI Spring Boot starter。

常见配置形态：

```properties
langchain4j.open-ai.chat-model.api-key=${DASHSCOPE_API_KEY}
langchain4j.open-ai.chat-model.model-name=qwen-max-latest
langchain4j.open-ai.chat-model.base-url=https://dashscope.aliyuncs.com/compatible-mode/v1
langchain4j.open-ai.chat-model.log-requests=true
langchain4j.open-ai.chat-model.log-responses=true
```

这里的 `OpenAiChatModel` 不代表只能调用 OpenAI 官方模型。它更准确地说是使用 OpenAI Compatible 协议的模型客户端。只要模型平台兼容 OpenAI 风格接口，例如 DashScope / 百炼，就可以通过 `base-url` 指向对应服务。

工程注意点：

- API Key 不要写死在配置文件里，应使用环境变量或配置中心。
- `log-requests` 和 `log-responses` 方便排查问题，但生产环境要注意脱敏。
- 版本变化较快时，要统一 `langchain4j` 相关依赖版本。

### OpenAiChatModel

配置完成后，可以注入 `OpenAiChatModel` 做一次简单调用：

```java
@Autowired
private OpenAiChatModel chatModel;

public String chat(String message) {
    return chatModel.chat(message);
}
```

这属于 LangChain4j 的低层 API 用法，直接面向模型对象。

## LangChain4j 低层 API

低层 API 更接近模型调用细节，适合学习底层流程、做定制化能力，或者在高层 API 覆盖不了需求时手动组合。

### ChatModel

`ChatModel` 用于普通阻塞式对话调用。常见调用方式包括：

- `chatModel.chat("你好")`
- `chatModel.chat(List<ChatMessage>)`
- `chatModel.chat(ChatRequest)`

它和 Spring AI 的 `ChatModel` 类似，都是对聊天模型的抽象。

### ChatMessage

`ChatMessage` 表示对话消息，包含用户消息、系统消息、AI 回复、工具结果等角色。多轮对话时，本质上就是把历史 `ChatMessage` 重新组装后提交给模型。

### ChatRequest

`ChatRequest` 用于更精细地控制一次模型调用。

它可以设置：

- `modelName`
- `temperature`
- `topP`
- `maxOutputTokens`
- `responseFormat`
- `toolSpecifications`
- `toolChoice`

如果只是简单问答，用 `chat(String)` 就够了；如果要控制模型参数、结构化输出或工具调用，就需要 `ChatRequest`。

### StreamingChatModel

LangChain4j 低层 API 中，普通 `ChatModel` 和流式 `StreamingChatModel` 是分开的。

也就是说，配置了：

```properties
langchain4j.open-ai.chat-model.*
```

不等于自动配置了流式模型。流式输出通常还需要：

```properties
langchain4j.open-ai.streaming-chat-model.*
```

低层流式输出还要通过 `StreamingChatResponseHandler` 接收分片。如果要在 Spring WebFlux 中返回 `Flux<String>`，通常需要自己桥接，或者在高层 API 中引入 `langchain4j-reactor`。

这也是为什么课程里说 LangChain4j 低层 API 的流式输出比 Spring AI 更麻烦。

## AI Services：LangChain4j 的高层抽象

### 为什么说它像 Spring Data JPA

`AI Services` 是 LangChain4j 很有辨识度的高层抽象。

它的思路是：开发者只定义一个 Java 接口，描述 AI 能力，框架负责生成实现类。这个体验很像 Spring Data JPA：你定义 Repository 接口，框架帮你生成查询实现。

示例：

```java
@AiService
public interface Assistant {

    String chat(String userMessage);
}
```

业务代码里可以直接注入并调用：

```java
@Autowired
private Assistant assistant;

public String chat(String message) {
    return assistant.chat(message);
}
```

对业务开发来说，高层 API 更推荐，因为它把模型调用、Prompt、Memory、Tools 等胶水逻辑封装起来了。

### 提示词注解

LangChain4j 支持通过注解声明系统提示词和用户提示词：

```java
@AiService
public interface Assistant {

    @SystemMessage("你是一个专业 Java 面试官")
    @UserMessage("请回答这个问题：{{question}}")
    String answer(String question);
}
```

注意模板变量使用 `{{变量名}}`。

提示词也可以通过资源文件外置，避免大段 Prompt 写在代码里。这一点和 Spring AI 的 `PromptTemplate` 思路一致：Prompt 应该模板化、版本化、可测试。

### 高层流式输出

如果接口方法希望返回 `Flux<String>`，需要额外引入 `langchain4j-reactor`。

否则可能出现类似提示：需要导入 reactor 模块才能使用 `Flux<String>` 作为返回类型。

这说明 LangChain4j 的响应式流支持不是默认无感开启的，需要额外依赖配合。

### 结构化输出

高层 API 可以直接让方法返回 POJO。

例如：

```java
@AiService
public interface BookAssistant {

    Book recommendBook(String topic);
}
```

框架会根据返回类型追加输出格式要求，并尝试把模型输出解析成目标对象。

工程上仍然要注意：

- 结构化输出不能完全依赖模型“听话”。
- 需要做后端校验。
- 解析失败要有重试、修复或降级。
- 某些 OpenAI Compatible 平台对 JSON schema / response format 的支持可能不完整。

## LangChain4j 的对话记忆

### 记忆的本质

LangChain4j 的记忆不是模型真的记住了用户，而是框架把同一个 memoryId 下的历史消息重新拼进上下文，让模型在本次调用里“看见”历史对话。

这和 Spring AI 的记忆本质一样：应用层管理历史消息，模型只负责基于当前上下文生成答案。

### MessageWindowChatMemory

`MessageWindowChatMemory` 是窗口式短期记忆，只保留最近 N 条消息。

它解决的是上下文窗口控制问题：不能把所有历史无限塞给模型，需要按窗口裁剪。

### MemoryId

`@MemoryId` 用于标识一组会话。

例如：

```java
@AiService
public interface MemoryAssistant {

    String chat(@MemoryId String memoryId, @UserMessage String message);
}
```

相同 `memoryId` 的请求会共享一组记忆；不同 `memoryId` 的请求相互隔离。

### ChatMemoryProvider

使用 `@MemoryId` 时，需要配置 `ChatMemoryProvider`。它负责根据 memoryId 提供对应的 `ChatMemory`。

示意：

```java
Assistant assistant = AiServices.builder(Assistant.class)
        .chatLanguageModel(chatModel)
        .chatMemoryProvider(memoryId -> MessageWindowChatMemory.withMaxMessages(10))
        .build();
```

注意：如果每次请求都重新 `new` 一个 `AiServices` 实例，那么内存里的 ChatMemory 也会重新创建，之前的历史自然就丢了。要让短期记忆生效，AI Service 实例和对应的 memory provider 需要被稳定复用。

持久化记忆、Redis/MySQL 存储、长期记忆设计，后续放到 LLM 记忆章节展开。

## LangChain4j 工具调用概览

LangChain4j 支持工具调用，但第三章只讲框架入口，不展开完整 Function Calling 流程。

低层 API 中，工具调用通常要手动处理：

1. 定义工具描述。
2. 把 `toolSpecifications` 放进 `ChatRequest`。
3. 模型返回 `toolExecutionRequests`。
4. 后端执行工具。
5. 把工具结果作为 `ToolExecutionResultMessage` 加回消息列表。
6. 再次调用模型生成最终回复。

这个过程虽然繁琐，但能帮助理解 Function Calling 的本质：模型只告诉我们要调用哪个工具和参数，真正执行工具、校验权限、回填结果，还是后端系统的责任。

高层 `AiServices` 可以通过 `.tools(...)` 简化工具调用，也可以通过 `ToolProvider` 按需加载工具，避免工具过多占用上下文。

详细工具调用会放到第四章 Function Calling 与 MCP。

## AiService 的实现原理

`@AiService` 的底层不是魔法，而是代理。

大致流程：

1. Spring 启动时扫描被 `@AiService` 标注的接口。
2. 框架为接口注册或替换 BeanDefinition。
3. 通过 `AiServiceFactory` 创建代理对象。
4. 业务代码调用接口方法时，被 JDK 动态代理拦截。
5. 代理根据方法签名、注解、参数、返回值类型组装 Prompt 和调用配置。
6. 最终调用 `ChatModel` 或 `StreamingChatModel`。
7. 如果返回 POJO、Flux、带 Memory 或 Tools，则由代理层完成对应编排。

面试表达：

> `@AiService` 的原理类似 Spring Data JPA。开发者定义接口，框架启动时扫描接口并创建代理对象。方法调用会被代理拦截，再根据注解、参数和返回类型组装模型请求，最终调用 ChatModel 或 StreamingChatModel。

## Spring AI、Spring AI Alibaba、LangChain4j 怎么选

| 场景 | 推荐选择 | 原因 |
| --- | --- | --- |
| 已有 Spring Boot 项目，想快速接入模型、Prompt、RAG | Spring AI | 贴合 Spring 生态，集成自然 |
| 使用阿里云百炼、DashScope、Nacos、可观测体系 | Spring AI Alibaba | 阿里云生态增强明显 |
| 构建企业级 Agent、Graph 工作流、多智能体应用 | Spring AI Alibaba | Graph 和 Agent 能力更强 |
| 纯 Java 项目，不想强绑定 Spring | LangChain4j | 可独立使用 |
| 想用接口式方式封装 AI 服务 | LangChain4j | `AI Services` 抽象直观 |
| 想深入理解工具调用底层流程 | LangChain4j 低层 API | 手动处理 tool request / tool result，更接近 Function Calling 原理 |
| 只想最简单调用一次模型 | HTTP Client | 可以，但不适合复杂 AI 应用 |

## 与后续章节的边界

第三章只讲 Java 调模型方式和 Spring AI / Spring AI Alibaba 的核心入门。

更深入的内容放到后续章节：

- Function Calling 和 MCP：放第四章。
- RAG 和向量数据库：放第五章。
- Agent 和多智能体：放第六章。
- Workflow 和 Graph：放第七章。
- Context Engineering：放第八章。
- LLM 记忆和持久化记忆：放第九章。

这样可以避免第三章变成所有概念的大杂烩。

## 面试速记

### 为什么需要 Spring AI

Java 直接用 HttpClient 能调通模型，但生产级 LLM 应用还需要 Prompt 管理、流式输出、结构化输出、对话记忆、RAG、工具调用、可观测和安全控制。Spring AI 的价值是把这些能力抽象成 Spring 生态里的统一编程模型。

### Spring AI 是什么

Spring AI 是面向 Spring 生态的大模型应用开发框架。它不只是模型 API 封装，还提供 ChatModel、ChatClient、PromptTemplate、结构化输出、Memory、Advisor、RAG、VectorStore、Observation 等一整套工程能力。

### ChatModel 和 ChatClient 区别

`ChatModel` 是底层模型调用抽象，统一不同厂商模型的 `call` 和 `stream` 能力；`ChatClient` 是业务层更常用的门面，封装 Prompt、Options、Advisor、流式输出和结构化输出。

### Spring AI 如何做结构化输出

Spring AI 通过 `StructuredOutputConverter` 在调用前给模型追加格式约束，在调用后把完整文本解析成 Java 类型。常用方式包括 `BeanOutputConverter` 和 `chatClient.call().entity(Book.class)`。

### Advisor 是什么

Advisor 是 Spring AI 调用链上的增强器，类似 AOP。它可以用于日志、记忆、安全拦截、RAG 上下文注入等场景，并且执行顺序会影响最终效果。

### Spring AI Alibaba 的价值是什么

Spring AI Alibaba 基于 Spring AI，强化 DashScope/百炼接入、阿里云生态、Graph 工作流、Agent/Multi-Agent、MCP 集成和可观测能力，更适合企业级智能体应用。

### LangChain4j 是什么

LangChain4j 是 Java 版 LangChain 思路的大模型应用框架。它可以独立于 Spring 使用，也可以集成 Spring Boot，提供模型调用、Prompt、Memory、Tool、RAG 等抽象。它最有辨识度的是 `AI Services`，可以通过接口定义 AI 服务。

### LangChain4j 低层 API 和高层 API 区别

低层 API 直接使用 `ChatModel`、`ChatRequest`、`StreamingChatModel` 等对象，灵活但繁琐，适合定制和理解底层流程；高层 API 通过 `AiServices` / `@AiService` 代理接口，封装 Prompt、Memory、Tools 和结构化输出，更适合业务开发。

### @AiService 的原理

`@AiService` 类似 Spring Data JPA。框架启动时扫描接口，创建代理对象；方法调用被代理拦截后，会根据注解、参数、返回类型组装模型请求，最终调用 `ChatModel` 或 `StreamingChatModel`。

### LangChain4j 的记忆本质

LangChain4j 的记忆不是模型真的记住了，而是框架根据 `memoryId` 找到同一会话的历史消息，并重新拼进上下文。`MessageWindowChatMemory` 控制短期消息窗口，`ChatMemoryProvider` 负责按 memoryId 提供记忆实例。
