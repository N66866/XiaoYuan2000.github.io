# Agent 智能体

## 本章导读

Agent（智能体）让 LLM 从“根据上下文生成回答”，升级为“理解目标、决定下一步、调用外部能力、观察结果、持续修正并交付结果”的执行系统。

可靠 Agent 不等于“模型加几个工具”。它还需要状态、执行控制、权限、停止条件、错误恢复、记忆、可观测和必要的人类审批。

- LLM 负责理解意图、规划或选择行动。
- Agent Runtime / Java 后端负责校验、执行工具、维护状态、重试、终止和审计。
- Tools、MCP、RAG、API、数据库等提供外部能力和事实依据。
- 人类负责高风险动作、模糊业务规则与最终责任边界。

~~~mermaid
flowchart LR
    U["用户目标"] --> M["LLM 决策"]
    M --> R["Agent Runtime"]
    R --> T["工具 / RAG / API / 数据库"]
    T --> O["Observation：结果、错误、状态"]
    O --> M
    M --> F["最终答案或交付物"]
    R --> H["权限、审计、预算、HITL"]
~~~

## 1. Agent 是什么

### 1.1 定义与组成

Agent 是以 LLM 为推理核心，围绕目标进行规划、行动、观察和调整的系统。它不仅回答问题，还可在受控范围内完成检索资料、查询订单、生成报告、修改代码、调用内部服务或等待审批后继续执行等多步骤任务。

~~~text
Agent = LLM + Memory + Tools + Planning + Action
~~~

| 组成 | 责任 |
| --- | --- |
| LLM | 理解目标、推理、选择工具、生成计划与最终表达 |
| Memory / State | 保存会话、工具结果、任务进度、检查点和长期偏好 |
| Tools | 执行查询、计算、检索、写文件、调用业务 API 等真实动作 |
| Planning | 将目标拆为可执行步骤，识别依赖、顺序和替代方案 |
| Action | 运行时校验并执行模型请求的工具调用，再回填结果 |

最重要的边界：**模型不会真实执行工具。** 它只输出 Tool Call；真实执行者始终是 Java 后端、Agent Runtime 或业务系统。

### 1.2 Agent 与普通聊天、Function Calling

| 能力 | 普通聊天 LLM | 单次 Function Calling | Agent |
| --- | --- | --- | --- |
| 理解用户目标 | 有 | 有 | 有 |
| 调用外部工具 | 无 | 通常一到数次 | 可多轮、多工具、可重试 |
| 根据结果修正 | 有限 | 框架可回填 | 有显式状态和循环控制 |
| 任务规划 | 通常隐式 | 通常简单 | 可显式计划、重规划、分工 |
| 风险与停止控制 | 调用方处理 | 基础框架能力 | 步数、预算、超时、取消、审批 |
| 生产可观测 | 较少 | 较少 | 需记录状态、工具与成本轨迹 |

给 LLM 一组工具并不自动等于可靠 Agent。只有当系统能受控完成“决策 -> 执行 -> 观察 -> 下一轮决策”的闭环，并具备安全和终止机制时，才具备 Agent 的工程价值。

### 1.3 适用与不适用场景

适合：

- 用户目标开放，步骤不能提前完全枚举。
- 需要根据中间结果动态选择工具或修正路径。
- 多源信息查询、复杂调研、代码排障、知识工作辅助。
- 需要分解、协作、反思或人工审批的任务。

不适合：

- 规则稳定、步骤固定、几行代码即可完成的 SOP。
- 必须 100% 精确且错误损失极高的端到端操作，例如直接转账、不可逆删除。
- 高频、低延迟、低成本的纯确定性计算。

原则：确定性流程由代码和状态机主控；AI 处理模糊输入、异常分流、信息归纳和开放式决策。

## 2. Workflow Agent 与 Autonomous Agent

| 维度 | Workflow Agent / 编排型 | Autonomous Agent / 自主型 |
| --- | --- | --- |
| 控制方式 | 预定义节点、条件和边 | LLM 动态决定下一步 |
| 路径确定性 | 高 | 低，可能发散 |
| 可靠性 | 较高，易审计 | 依赖模型、Prompt 与运行时约束 |
| 灵活性 | 受流程边界限制 | 可处理未知路径 |
| 典型场景 | 审批、质检、固定运营流程 | 调研、排障、探索性任务 |

生产中通常组合使用：

~~~text
固定 Workflow 负责主流程与风险边界
    -> Agent 负责模糊理解、工具选择或异常处理
    -> 人工审批决定高风险动作
~~~

例如退款审批由规则、风控和审批流主导，Agent 只协助理解诉求、补充资料和生成解释；行业报告可使用受限 ReAct 或 Plan-and-Execute 做研究，但应限定数据源、预算、审核和交付格式。

## 3. ReAct：最常见的 Agent 循环

### 3.1 Thought、Action 与 Observation

ReAct 是 Reasoning + Acting 的组合。Agent 在每一步基于已有状态决定下一步，执行工具并观察结果：

~~~text
Thought / Decide -> Action / Tool Call -> Observation / Tool Result
                                  ^                    |
                                  |____________________|
~~~

| 阶段 | 含义 |
| --- | --- |
| Thought / Decide | 模型分析目标、上下文和工具，选择下一步 |
| Action | 模型产生结构化 Tool Call，运行时决定是否允许并执行 |
| Observation | 工具返回事实数据、错误或状态，写回上下文 |

Observation 是工具的真实返回，不是模型反思。模型在下一轮读取 Observation 后，才可能修正计划、换工具、重试或输出最终答案。

不要为了 ReAct 向用户暴露完整内部思维链。生产中应保留结构化决策、工具轨迹和必要摘要，避免泄露内部策略、敏感上下文和不可靠中间推理。

### 3.2 工具调用的消息协议

工具调用消息必须保持结构完整：

~~~text
System
-> User
-> Assistant（包含一个或多个 tool_calls）
-> ToolResponse（每条响应关联对应 toolCallId）
-> Assistant（再次调用工具，或输出最终答案）
~~~

- AssistantMessage 的 tool_calls 表示模型已作出的行动决策。
- ToolResponseMessage 的结果是下一轮模型的 Observation。
- 每条 Tool Response 必须关联正确 toolCallId。

若 Assistant 声明 Tool Call 后缺失对应 Tool Response，很多 OpenAI Compatible 接口会判定消息序列非法并返回 400；这不是普通的答案质量问题，而是协议校验失败。

### 3.3 手写 ReAct 的最小闭环

在 Spring AI 中，手写 ReAct 时通常关闭框架自动工具执行：

~~~java
ToolCallingChatOptions options = ToolCallingChatOptions.builder()
        .toolCallbacks(tools)
        .internalToolExecutionEnabled(false)
        .build();
~~~

含义是：模型只表达“想调用什么工具”；后端显式控制何时执行、如何校验、是否审批、如何处理异常和如何进入下一轮。

~~~java
messages.add(systemMessage);
messages.add(userMessage);

for (int round = 1; round <= maxRounds; round++) {
    ChatResponse response = chatModel.call(messages);
    if (!response.hasToolCalls()) {
        return response.getText();
    }

    messages.add(assistantMessageWithToolCalls(response));
    for (ToolCall call : response.getToolCalls()) {
        ToolResponse result = validateAndExecute(call);
        messages.add(toolResponseMessage(result));
    }
}
return forceFinalAnswer(messages);
~~~

关闭自动执行不是让 LLM 执行工具。LLM 从来不能执行工具；它只是让 Agent Runtime 获得工具调度的显式控制权。

### 3.4 状态、停止条件与错误回填

最小 while 循环可跑通 Demo，但生产 Agent 还要维护：

- 用户问题、系统规则、会话与任务状态。
- 每轮模型输出、Tool Call、Tool Response、错误与重试记录。
- 最大轮数、总超时、Token/费用预算、取消信号。
- 相同工具和相同参数的重复调用检测。
- 工具权限、参数 Schema、业务状态和幂等性。

停止条件至少包括：

1. 模型返回无 Tool Call 的最终答案。
2. 到达最大轮次、总超时或预算上限。
3. 工具连续失败、重复循环或不可恢复错误。
4. 用户取消，或人工拒绝高风险动作。

达到最大轮次时，若上一条 AssistantMessage 仍有未闭合 Tool Call，不应直接删除它。应为每个未闭合调用补 Tool Response，例如“已取消：达到最大执行轮次”，再请求模型根据已有证据生成最终答案，保证消息协议闭合。

工具失败也应结构化回填模型，让其重试、换方案、澄清或降级，而不是一出错就静默结束。

## 4. Graph Runtime：把 Agent 变成状态机

复杂 Agent 常用 Graph 组织执行过程。以 Spring AI Alibaba 的 ReactAgent 为例，本质是把 ReAct 编译为有向图和状态机：

~~~mermaid
flowchart LR
    S["State / Checkpoint"] --> M["Model Node"]
    M -->|"存在 Tool Call"| T["Tool Node"]
    T -->|"写入 Observation"| M
    M -->|"最终回答"| E["End"]
    M --> H["Hook / Interceptor"]
    T --> H
~~~

| 组件 | 作用 |
| --- | --- |
| Model Node | 调用 LLM，输出最终回答或 Tool Call |
| Tool Node | 校验并执行工具，将返回值写为 Tool Response |
| 条件边 | 决定 Model -> Tool、Tool -> Model 或 End |
| Overall State | 保存消息、进度、结果、错误、预算和运行上下文 |
| Hook / Interceptor | 增加日志、监控、审批、动态 Prompt 等横切能力 |
| Checkpoint / Saver | 持久化线程状态，支持恢复和审计 |

相比把所有分支塞进 while 循环，Graph 更适合可中断节点、条件路由、并行、重试、人审、持久化恢复和轨迹可视化。代价是要理解节点、边和状态演化。

## 5. Agent 记忆、状态与持久化

### 5.1 Memory 不等于聊天记录

Agent 需要记住的不只是之前说过什么，还包括：

- 当前任务目标与步骤进度。
- 模型决策、工具调用与工具结果。
- 待审批动作、失败原因、重试次数。
- 用户偏好、长期事实和引用来源。

长期任务不应把全部历史永久塞入 Prompt。需要窗口记忆、摘要、结构化任务状态、外部存储和检索记忆共同配合。

### 5.2 Spring AI Alibaba 的 Saver

| 组件 | 作用 |
| --- | --- |
| MemorySaver | JVM 内存中的临时保存，应用重启后丢失 |
| MysqlSaver 等持久化 Saver | 将线程、检查点与运行状态写入数据库，支持恢复 |
| RunnableConfig.threadId | 标识同一会话或任务线程，用于加载正确状态和恢复执行 |

持久化 Agent 的基本要求：

1. 为每次任务分配稳定 threadId / conversationId。
2. 在模型、工具、审批等关键节点后保存 checkpoint。
3. 服务重启或网络断开后，根据相同 threadId 恢复最后一致状态。
4. 记录工具幂等键和已执行动作，防止恢复时重复扣款、重复发消息或重复写文件。

## 6. 常见 Agent 架构

### 6.1 ReAct Agent

适合步骤短、环境动态、每一步都依赖上一轮 Observation 的任务，例如排障、搜索和工具型助手。

优点：灵活、实现简单、可边观察边修正。  
缺点：模型调用通常串行，成本和延迟随步数增长；缺少显式全局计划时可能短视、重复或走局部最优。

### 6.2 Plan-and-Execute Agent

适合复杂、可拆解、可审计且部分任务可并行的目标。

| 角色 | 作用 |
| --- | --- |
| Planner | 根据目标生成带任务 ID、依赖和顺序的结构化计划 |
| Executor | 按任务执行工具、子 Agent 或局部 ReAct 循环 |
| Critic / Replanner | 根据原始目标与执行证据判断是否完成；未完成则补充或重规划 |

~~~mermaid
flowchart LR
    U["目标"] --> P["Planner"]
    P --> X["Executor"]
    X --> C["Critic / Goal Check"]
    C -->|"未达成"| P
    C -->|"已达成"| F["汇总交付"]
~~~

计划不能一成不变：工具失败、外部数据变化、前置结果不符合预期、遗漏子任务或用户补充要求时，都应触发 Replan。

常见实现：

- Planner 生成计划；每个任务由嵌套 ReAct Executor 完成；Critic 决定是否重规划。
- Planner 直接输出结构化工具任务和参数；后端按依赖编排执行；异常时才局部用 ReAct 重规划。

第二种通常更可控、成本更低，适合工具语义稳定的业务流程。

### 6.3 ReWOO 与 LLMCompiler

| 架构 | 解决的问题 | 核心做法 |
| --- | --- | --- |
| ReWOO | 普通计划难表达任务结果依赖；每步 Observation 都调用 LLM 成本高 | Planner 定义 E1、E2 等中间变量，后续任务引用前序结果 |
| LLMCompiler | 无依赖任务仍被串行执行 | 将计划表示为 DAG，依据依赖关系动态调度并行任务 |

示例：先查询客户 ID 得到 E1，再用 E1 查询订单，属于依赖任务；同时查询天气、航班和酒店价格则可并行。两种优化都依赖计划质量，仍需超时、失败回退与重新规划。

### 6.4 Reflection Agent

Reflection Agent 在最终候选答案生成后增加“评估 -> 反馈 -> 修订”的闭环：

~~~text
生成候选答案 -> 评估完整性、事实、逻辑、格式
    -> 通过：交付
    -> 不通过：注入简短反馈，重新规划或调用工具
~~~

适合离线报告、代码审查、复杂摘要、质量优先的交付；不适合对首 Token 延迟极敏感的实时交互。

在 Java/Spring AI 中，更好的设计是组合而非重写：

- SimpleReactAgent 继续负责 Tool Call、状态和流式循环。
- ReflectionAgent 在外层增加最大反思轮次与 ReflectionAdvisor。
- ReflectionAdvisor 在模型给出无 Tool Call 的候选最终答案后评估；当前仍在请求工具时跳过反思。

反思判断推荐结构化输出：

~~~json
{
  "passed": false,
  "feedback": "缺少引用来源，请补充依据并说明不确定项。"
}
~~~

这样后端可稳定处理通过/失败、反馈注入和终止，而不是脆弱地解析自然语言。反思同样必须限制最大轮次、预算、无改进次数和超时；“模型说满意”不能是唯一结束条件。

### 6.5 Human in the Loop（HITL）

HITL 把高风险决定从模型侧上移到业务审批层。典型受控工具包括执行 SQL、写文件、退款、支付、发消息、删除资源和修改权限。

~~~text
模型生成 Tool Call
-> 命中受控工具
-> 中断并返回待审批信息
-> 人工批准 / 修改参数 / 拒绝
-> 使用原 checkpoint 恢复
-> 执行工具或将拒绝原因回填模型
~~~

审批发生在**模型生成 Tool Call 后、工具真正执行前**。审批人可：

- APPROVED：按原参数执行。
- EDITED：替换为人工修改后的参数后执行。
- REJECTED：不执行，向模型回填拒绝原因或建议。

Spring AI Alibaba 中可使用 HumanInTheLoopHook。恢复时使用相同 threadId 和 checkpoint，才能保留被拦截调用、此前 Observation 和审批上下文。

HITL 不是“弹一个确认框”就结束，还要记录审批人、理由、时间、参数变更、最终工具结果和审计 ID。

## 7. 多 Agent 协作

### 7.1 为什么需要多 Agent

单 Agent 的问题：

- 上下文过长导致注意力分散、延迟和成本上升。
- 工具过多，模型容易选错或误解工具边界。
- 任务跨多个专业领域，单一 Prompt 难以兼顾。
- 子任务有并行空间，串行执行过慢。
- 一个大 Agent 难以独立测试、调优和替换。

多 Agent 通过专业化分工和上下文隔离缓解这些问题，但不是越多越好。它会增加模型调用、消息传递、路由、状态一致性、故障定位、权限治理和评测成本。只有职责清晰、可并行或显著提升质量时才值得拆分。

### 7.2 三种协作模式

| 模式 | 控制权 | 适合场景 | 关键特点 |
| --- | --- | --- | --- |
| SubAgent | 主 Agent 始终控制 | 研究、检索、计算、审查子任务 | 子 Agent 被包装为 Tool，返回压缩结果 |
| HandOff | 当前 Agent 移交给目标 Agent | 客服分流、线性专业流程 | 后续用户交互由目标 Agent 主导 |
| Group Chat | GroupChatManager 选择发言者 | 动态讨论、角色协作、代码生成团队 | 多角色共享消息，需要严格终止与调度 |

研究 -> 写作 -> 审核的一个设计：

1. 主 Agent 并发调用多个研究 SubAgent。
2. 主 Agent 汇总研究 Artifact，交给写作 Agent。
3. 写作 Agent HandOff 给审核 Agent，或由固定 Workflow 调用审核节点。
4. 审核失败回写作节点，达到最大修订次数后交付或转人工。

### 7.3 SubAgent 的上下文隔离

主 Agent 将子 Agent 当 Tool 调用时，子 Agent 通常只接收压缩后的子任务输入，并只返回结论、引用或 Artifact。这样可避免把主对话的完整历史、无关工具结果和长文档复制进每个子任务。

典型模式中，主 Agent 维护用户会话和长期记忆；子 Agent 尽量无状态或仅维护短期任务状态。长期共享信息应写入受权限保护的任务状态、知识库或 Artifact，而不是让每个 Agent 无限累积聊天记录。

### 7.4 AutoGen Group Chat

| 组件 | 作用 |
| --- | --- |
| AssistantAgent | 使用 LLM 生成内容、规划或审查 |
| UserProxyAgent | 代表用户，可发起任务、调用函数或执行受控代码 |
| GroupChat | 保存参与 Agent、消息、最大轮数和发言选择规则 |
| GroupChatManager | 调度消息、选择下一位发言者、控制终止 |

GroupChat 需明确最大轮数、发言选择策略、终止信号、最终产物责任人、是否允许连续发言、代码执行隔离和测试结果回填。“多个 Agent 商量”不会自动保证正确，应有清晰角色契约、结构化交接、独立验证器和结束条件。

### 7.5 Spring AI Alibaba 的多 Agent

Spring AI Alibaba 可通过 Graph 组合：

- Agent Tool：把子 Agent 包装为主 Agent 可调用的 Tool。
- HandOff：通过图的状态更新和节点跳转，转到专门 Agent。
- SupervisorAgent：由监督者模型持续路由子 Agent。
- 自定义 Graph：描述串行、并行、条件分支、循环和汇聚。

设计前先明确共享状态、Artifact 格式、Agent 权限和恢复策略，再画图。

## 8. A2A：跨系统 Agent 协作

### 8.1 A2A 与 MCP

同一进程内多个 Agent 可直接用方法调用、事件或 Graph 通信。多个应用、团队、框架、机器或组织中的 Agent 需要跨网络发现能力、提交任务、追踪状态、接收进度和传递产物，这才是 A2A（Agent to Agent）的目标。

| 维度 | MCP | A2A |
| --- | --- | --- |
| 连接对象 | LLM 应用 / Agent 与工具、资源、Prompt | Agent 与远程 Agent |
| 核心目标 | 标准化外部能力接入与发现 | 标准化能力发现、任务协作和交付 |
| 对方通常是什么 | 搜索、文件、数据库、业务 API 等 | 能自主规划、调用工具、生成 Artifact 的 Agent |
| 交互重点 | Tools、Resources、Prompts | Agent Card、Task、Message、Artifact、状态 |
| 类比 | LLM 的外部能力协议 | 带任务生命周期的 Agent RPC / 协作协议 |

两者可组合：一个 A2A Remote Agent 可以在内部使用 MCP；主 Agent 通过 A2A 委派任务给远程 Agent。

### 8.2 核心对象和流程

| 对象 | 作用 |
| --- | --- |
| Client Agent | 发起协作的本地 Agent，构造请求并管理会话 |
| Remote Agent / Server | 接收任务、执行 Agent 逻辑并返回结果 |
| Agent Card | 能力契约：名称、描述、任务能力、输入输出 Schema、认证、限流等 |
| Task | 一个有 ID、类型、输入和上下文的具体工作单元 |
| Message | 承载 Task 输入、进度、结果和错误的通信单元 |
| Artifact | 报告、代码、图片、文件、日志等可复用产物 |

最小流程：

1. Client 获取 Agent Card，确认远程能力、输入输出和认证方式。
2. Client 按契约构造 Task，并封装到 request Message。
3. Remote Agent 校验权限和任务类型，执行推理、工具或子流程。
4. 长任务可发送进度 Message；最终结果和 Artifact 引用通过 response Message 返回。

Agent Card 与 OpenAPI 都是机器可读能力契约；区别是 Agent Card 描述任务语义、协作能力、交互方式和任务生命周期，而不只是 HTTP Endpoint。

## 9. Java 手写 Agent 的关键工程点

### 9.1 核心类职责

| 组件 | 职责 |
| --- | --- |
| ChatModel / ChatClient | 调用模型，返回最终文本或 Tool Call |
| ToolCallback | 描述并执行一个受控工具 |
| ToolCallingChatOptions | 绑定工具并控制是否自动执行 |
| ChatMemory | 保存会话消息窗口或接入持久化记忆 |
| List<Message> / OverallState | 当前任务的上下文与状态容器 |
| Advisor / Hook | 增加日志、RAG、反思、审批、动态规则等横切能力 |
| ToolCallingManager 或自定义执行器 | 校验、执行工具并生成 Tool Response |
| ReactAgent | Spring AI Alibaba 的基于 Graph Runtime 的 ReAct Agent |

模型产生的工具名和参数都是不可信输入。执行器应完成工具白名单、参数 Schema、长度/范围校验，从认证上下文注入用户/租户/权限，限流、超时、熔断、重试、幂等和审计。工具结果应脱敏、截断、结构化并带来源。

### 9.2 非流式与流式 ReAct

非流式每轮获得完整响应：要么是最终答案，要么是完整 Tool Call。流式时，文本、工具名称和 JSON 参数都可能被拆成多个 chunk，因此状态管理更复杂。

每轮 RoundState 至少记录：

- 当前模式：UNKNOWN、TOOL_CALL、FINAL_ANSWER。
- 文本缓冲区。
- 按 Tool Call ID 聚合的名称、参数片段和索引。
- 当前轮次、是否完成、是否已发送最终结果。

流式处理原则：

1. 不要只看第一个 chunk；有些模型先输出 reasoning 或文本，之后才产生 Tool Call。
2. Tool Call 片段按稳定 ID 合并，等本轮流结束并完成 JSON/Schema 校验后再执行。
3. 工具调用轮不向用户暴露内部参数、思考、未完成片段或服务器错误。
4. 工具并行时，等待本轮全部 Tool Response 写入状态后，再开始下一轮模型决策。
5. 先非流式生成全文再切字符串只是“假流式”，没有降低首 Token 等待时间。

流式回调和工具执行可能位于不同线程，应保证状态容器并发安全、取消可传播、最终结果只发送一次，并避免慢工具阻塞模型输出线程。

### 9.3 Context 管理

长任务会不断追加 Tool Response、计划、反思反馈和文档内容，应设置上下文预算：

- 保留系统约束、原始目标、关键工具结果、引用和失败原因。
- 压缩已完成且不再依赖的历史步骤。
- 将大文件、长工具输出转为 Artifact、RAG 引用或摘要。
- 记录原始来源与摘要版本；关键参数和审批结论不可随意丢弃。

## 10. 生产安全、可观测与误区

### 10.1 需要记录的轨迹

每个任务至少关联：

- threadId / taskId、用户、租户、模型和 Prompt 版本。
- 每轮时间、模型耗时、Token 与费用。
- 计划、路由、Tool Call、参数摘要和 Tool Response。
- 工具权限校验、审批人、审批意见、重试和错误。
- RAG 来源、最终答案、未完成项、取消或终止原因。

日志必须脱敏，不能记录 Access Token、完整机密文档、个人信息或不应外发的工具返回。

### 10.2 常见风险和防护

| 风险 | 防护 |
| --- | --- |
| 无限循环、重复工具调用 | 最大轮次、预算、超时、重复检测、取消 |
| 错工具或错参数 | 清晰 Schema、白名单、后端校验、测试集 |
| 越权读取或执行 | RBAC/ABAC、服务端注入安全上下文、最小权限 |
| 不可逆操作 | 幂等、事务/补偿、双重确认、HITL |
| 工具输出误导模型 | 结构化结果、可信来源、失败显式回填 |
| Prompt Injection | 外部内容视为不可信数据；工具和权限不由文本指令决定 |
| 上下文爆炸 | 摘要、Artifact、RAG、Token 预算和状态裁剪 |
| 成本失控 | 每步模型选择、缓存、并发上限、预算与告警 |

### 10.3 落地误区

| 误区 | 更准确的工程判断 |
| --- | --- |
| 所有 SOP 都交给 Agent | 稳定流程应由代码和状态机执行，AI 处理模糊输入和异常 |
| 能自动跑就能生产 | 还需权限、审计、幂等、失败恢复、评测和人工兜底 |
| 高风险场景端到端全自动 | 评估错误损失；高风险动作使用权威系统和 HITL |
| 所有界面改聊天框 | 表单和按钮在高频确定性操作上通常更高效 |
| 多 Agent 一定更强 | 仅在职责隔离、并行或专业化显著受益时拆分 |
| Agent 可替代工作流 | Agent 应嵌入可控流程，不取代全部业务编排 |

## 11. 架构选择速查

| 需求 | 优先方案 |
| --- | --- |
| 单一工具、确定性查询 | Function Calling 或普通服务代码 |
| 步骤少但依赖工具结果 | ReAct |
| 复杂任务、可拆解且需审计/并行 | Plan-and-Execute |
| 高质量报告、代码审查、离线内容 | Reflection + 最大修订次数 |
| 写库、执行 SQL、退款、发消息 | HITL + 强权限与幂等 |
| 专家分工、并行研究 | SubAgents + 主 Agent 汇总 |
| 客服或专业职责接管 | HandOff |
| 多角色讨论与动态调度 | Group Chat / Supervisor |
| 跨应用、跨框架 Agent 协作 | A2A |
| 稳定 SOP、固定审批流 | Workflow / 状态机，AI 仅作智能节点 |

## 12. 面试速答

### 什么是 Agent？与 Function Calling 有什么区别？

> Agent 是以 LLM 为决策核心，通过状态、记忆、工具、规划和行动完成多步骤目标的执行系统。Function Calling 是 Agent 的基础能力之一：模型只产生工具调用意图，后端执行并回填结果。Agent 在此基础上增加多轮观察和修正、规划、停止条件、错误恢复、权限、审计与任务状态管理。

### ReAct 的本质是什么？

> ReAct 是“模型决策 -> 工具行动 -> 工具观察 -> 下一轮决策”的闭环。模型不执行工具，代码负责执行和状态回填。它适合每一步依赖上一步结果的动态任务，但必须限制最大轮次、超时、预算和重复调用。

### 为什么手写 ReAct 要关闭自动工具执行？

> 默认自动工具执行适合简单聊天场景，但会隐藏执行边界。关闭后，后端能显式控制工具参数校验、权限、审批、重试、持久化和每轮状态回填，从而实现可观测、可中断的 ReAct 循环。

### ReAct 与 Plan-and-Execute 如何选择？

> ReAct 每步观察后再决定下一步，灵活但串行成本高；Plan-and-Execute 先形成全局结构化计划，再按依赖执行并在失败时重规划，适合复杂、可审计、可并行的任务。生产中常把两者组合：计划主导流程，局部异常用 ReAct 处理。

### 为什么需要 Human in the Loop？

> 模型输出和工具参数都不可信。对退款、支付、执行 SQL、写文件等高风险动作，应在模型生成 Tool Call 后、工具执行前中断，让人工批准、修改或拒绝，再从同一 checkpoint 恢复。HITL 把责任边界、审计和风险控制放回业务系统。

### 多 Agent 的价值与代价是什么？

> 多 Agent 通过专业化、上下文隔离和并行执行改善复杂任务，但会增加 Token、延迟、路由、状态一致性、权限和调试成本。我会先证明单 Agent 无法满足上下文、工具复杂度或性能目标，再按清晰职责拆分，并对每个 Agent 建立输入输出契约和独立评测。

### A2A 与 MCP 的区别？

> MCP 面向 LLM 应用与工具、资源、Prompt 的标准化连接；A2A 面向 Agent 与远程 Agent 的能力发现、任务协作、状态和 Artifact 传递。一个远程 A2A Agent 可以在内部继续通过 MCP 使用工具。
