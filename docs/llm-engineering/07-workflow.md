# Workflow 工作流

## 本章导读

Workflow 将目标拆成节点、状态和流转规则，再按照预定义路径执行。AI Workflow 只是在传统流程中加入 LLM、RAG 或工具调用节点，核心价值仍是用确定性编排控制执行边界。

Agent 则让 LLM 动态决定下一步。Agentic Workflow 将二者结合：工作流负责总体边界和状态，Agent 负责局部规划、工具选择、反思或协作。

~~~text
规则稳定、步骤固定、风险较高 -> Workflow
步骤无法提前枚举、需要探索 -> Agent
既要可靠主流程，又要局部自主性 -> Agentic Workflow
~~~

生产级 Workflow 不只是流程图，还必须可恢复、可重试、可审计、可观测、可终止，并能在高风险节点引入人工审批。

## 1. Workflow、Agent 与 Agentic Workflow

### 1.1 传统 Workflow

传统工作流通过预定义步骤完成业务目标，常见于审批、工单、订单履约和数据同步。节点可包含顺序执行、条件分支、并行、等待和人工审批。

- 流程由代码、BPMN 或可视化编排提前确定。
- 执行路径可预测，易测试、审计和追责。
- 对未知情况的适应能力有限，分支过多会增加维护成本。

### 1.2 AI Workflow

AI Workflow 是包含 AI 节点的 Workflow。LLM 可负责意图识别、抽取、分类、总结、生成和审核辅助，但节点顺序与可选路径主要由流程定义。

~~~mermaid
flowchart LR
    S["用户输入"] --> V["参数与权限校验"]
    V --> C["LLM 意图分类"]
    C -->|"知识问答"| R["RAG 检索"]
    C -->|"业务查询"| T["业务 API"]
    R --> G["LLM 生成"]
    T --> G
    G --> E["结构校验与输出"]
~~~

移除 LLM 节点后，它仍是普通工作流。因此 AI Workflow 的控制者主要是流程引擎，而不是 LLM。

### 1.3 Agent

Agent 围绕目标动态选择步骤和工具，执行路径会随模型判断与工具结果改变，适合开放式调研、复杂排障等无法提前枚举步骤的任务。

Agent 不是 AI Workflow 的严格子类。更实用的架构判断是：

- Workflow：LLM 与工具由预定义代码路径编排。
- Agent：LLM 动态控制自己的过程和工具使用。
- 二者都可归入广义的 Agentic System。

关于 Agent 的循环、记忆和多智能体设计，见 [Agent 智能体](./06-agent.md)。

### 1.4 Agentic Workflow

Agentic Workflow 用工作流承载状态和边界，在关键节点引入规划、工具使用、反思或多智能体协作。它**不要求 LLM 在运行时生成整张工作流**，固定图中的动态路由、Agent 节点和有限反馈环也是常见实现。

ReAct Agent 可以成为 Agentic Workflow 的一个节点，但二者不在同一层级：ReAct 是单个 Agent 的推理行动范式，Agentic Workflow 是更大的任务编排结构。

| 类型 | 控制者 | 动态性 | 典型场景 |
| --- | --- | --- | --- |
| Automated Workflow | 代码或工作流引擎 | 低 | 审批、同步、定时任务 |
| AI Workflow | 预定义流程，局部调用 LLM | 低到中 | 分类、抽取、内容流水线 |
| Agent | LLM 动态选择行动 | 高 | 开放调研、诊断、探索任务 |
| Agentic Workflow | Workflow 控整体，Agent 控局部 | 中到高 | 研究报告、多角色审核、复杂助手 |

## 2. 常见编排范式

### 2.1 Prompt Chaining

将任务拆为串行 LLM 节点，后一个节点消费前一个节点的结果，中间可加入规则或人工 Gate。

~~~text
生成大纲 -> 校验结构 -> 撰写正文 -> 事实检查 -> 润色
~~~

它适合依赖关系明确的任务；调用链过长则会增加延迟、费用和错误传播。

### 2.2 Routing

先识别意图、风险或数据类型，再路由到不同流程、模型、知识库或工具。路由结果应结构化并限制为枚举值。

权限、租户边界、资金操作等安全决策不能只相信 LLM，必须由后端代码再次校验。

### 2.3 Parallelization

- Sectioning：把互不依赖的子任务并发执行。
- Voting：对同一任务独立执行多次，再投票或聚合。

并行可降低等待时间，但要限制并发、速率、费用和超时，并处理部分分支失败。存在数据依赖的节点不能盲目并行。

### 2.4 Evaluator-Optimizer

生成节点先产出结果，评估节点检查是否达标；不通过时携带反馈返回生成节点继续修改。

~~~mermaid
flowchart LR
    W["生成"] --> R["评估"]
    R -->|"通过"| E["结束"]
    R -->|"不通过 + 反馈"| W
~~~

评估结果最好结构化为 `approved`、`score` 和 `feedback`。必须配置最大修订次数、总超时和费用预算，防止无限循环。

### 2.5 Orchestrator-Workers

协调者动态拆分任务并分派给 Worker，Worker 可并行研究或生成，最后由协调者汇总。这通常属于 Agentic Workflow，需要处理任务依赖、重复任务、Worker 失败、结果冲突和上下文膨胀。

## 3. Graph：将流程建模为状态机

LangGraph 与 Spring AI Alibaba Graph 使用相似的图模型：

~~~text
Workflow = State + Node + Edge + Runtime
~~~

| 组件 | 作用 |
| --- | --- |
| State | 保存跨节点共享的运行时数据与任务进度 |
| Node | 读取 State，完成一个计算单元并返回增量更新 |
| Edge | 定义固定的节点跳转 |
| Conditional Edge | 根据 State 选择下一节点 |
| Compiled Graph | 校验并编译后的可执行工作流 |
| Checkpointer | 持久化检查点，支持恢复、审计和人工介入 |

### 3.1 State 设计

State 可保存用户任务、租户与会话标识、计划、检索结果、草稿、审核反馈、当前轮次、错误和审批状态。

提示词一般属于节点配置或外部版本化配置，不应把所有 Prompt 塞入 State。State 只保存执行所需数据，并避免复制大文件或无边界追加历史消息。

节点返回状态增量，而不是随意修改共享对象。每个字段应指定合并方式：

- Replace：覆盖旧值，适合草稿、审核结论和计数器。
- Append：追加内容，适合消息、计划步骤和执行记录。
- 自定义聚合：适合并行结果、投票和统计信息。

### 3.2 Node、Edge 与循环

Node 应职责单一并具有清晰的输入、输出和失败语义。固定边用于确定步骤，条件边根据 State 路由：

~~~text
START -> Planner -> Researcher -> Writer -> Reviewer
                                      ^          |
                                      |-- 不通过--|
                                                 |-- 通过 -> END
~~~

Reviewer 可以由 LLM 输出 `approved`，但路由代码还要检查最大轮次、超时、预算和人工审批状态。

### 3.3 Checkpoint 与恢复

内存 State 只适合 Demo。长流程和人工介入应使用持久化 Checkpointer，并以稳定的 `threadId` 或 `taskId` 定位执行实例。

检查点用于：

- 进程崩溃或外部服务失败后从最近节点恢复。
- 暂停流程，等待人工通过、拒绝或修改后继续。
- 追踪每一步状态变化，满足审计和排障。
- 只重试失败节点，而不是重新运行整条流程。

恢复时仍要保证节点幂等，否则重放可能重复发消息、扣款或写库。

## 4. LangGraph 与 Spring AI Alibaba Graph

### 4.1 LangGraph 核心 API

| API / 类型 | 作用 |
| --- | --- |
| `TypedDict` / Pydantic Model | 定义 State |
| `StateGraph` | 创建状态图 |
| `add_node` | 注册节点 |
| `add_edge` | 添加固定边 |
| `add_conditional_edges` | 添加条件路由 |
| `compile` | 编译工作流，可注入 Checkpointer |
| `invoke` / `stream` | 同步执行 / 流式观察状态更新 |
| `update_state` | 人工修改状态后恢复 |

LangGraph 适合 Python 技术栈中的循环任务、状态驱动 Agent、多智能体和 Human-in-the-loop。

### 4.2 Spring AI Alibaba Graph 核心 API

| API / 类型 | 作用 |
| --- | --- |
| `KeyStrategyFactory` | 声明 State 字段的合并策略 |
| `ReplaceStrategy` / `AppendStrategy` | 覆盖 / 追加字段 |
| `OverAllState` | 节点读取的共享状态 |
| `NodeAction` | Java 节点接口，`apply` 返回更新 Map |
| `StateGraph` | 注册节点、固定边和条件边 |
| `CompiledGraph` | 编译后的可执行图 |
| `RunnableConfig` | 线程、检查点等运行参数 |

简化后的 Java 结构如下，包名和 API 应以项目实际版本为准：

~~~java
KeyStrategyFactory strategies = () -> Map.of(
        "draft", new ReplaceStrategy(),
        "feedback", new ReplaceStrategy(),
        "approved", new ReplaceStrategy(),
        "revisionCount", new ReplaceStrategy()
);

StateGraph graph = new StateGraph(strategies)
        .addNode("writer", node_async(new WriterNode(chatClient)))
        .addNode("reviewer", node_async(new ReviewerNode(chatClient)))
        .addEdge(StateGraph.START, "writer")
        .addEdge("writer", "reviewer")
        .addConditionalEdges(
                "reviewer",
                edge_async(new ReviewerRouteAction()),
                Map.of("rewrite", "writer", "end", StateGraph.END)
        );

CompiledGraph workflow = graph.compile();
Optional<OverAllState> result = workflow.invoke(initialState, runnableConfig);
~~~

Spring AI Alibaba 可从三层理解：

- Augmented LLM：模型、消息、工具、MCP、向量库等基础能力。
- Graph：底层状态机与工作流运行时。
- Agent Framework：在 Graph 上封装 ReAct、上下文工程和人机协作。

Graph 的价值不是拖拽画布，而是把复杂 AI 执行过程变成可编码、可测试、可恢复的状态机。

## 5. 平台与框架选型

### 5.1 Dify

Dify 偏向 LLM 应用开发和管理，适合快速搭建对话应用、RAG 与 AI Workflow。常见节点有开始、LLM、分类器、知识检索、条件分支、循环、代码、HTTP、插件、MCP 和子工作流。

它适合 AI 能力占主导、需要可视化配置和快速验证的场景；复杂业务事务和严格代码测试仍需后端服务配合。

### 5.2 n8n

n8n 偏向通用自动化与跨系统集成，AI 只是其中一类节点。它擅长定时、Webhook、应用事件等触发方式，连接 SaaS、数据库、消息队列和 HTTP API，并完成数据清洗、循环、分支和写入。

“定时读取多个业务系统 -> 转换数据 -> 调用 LLM -> 写入数据库”通常优先考虑私有部署的 n8n。

### 5.3 对比

| 方案 | 核心定位 | 优先场景 |
| --- | --- | --- |
| Dify | LLM 应用、RAG、模型和工作流管理 | 企业 AI 应用快速构建 |
| n8n | 通用自动化、连接器和数据流 | 跨系统同步与业务自动化 |
| Coze | 低代码 Bot 和渠道发布 | 快速验证面向用户的机器人 |
| FastGPT / RAGFlow | 私有知识库与 RAG | 文档问答和知识管理 |
| LangGraph | Python 代码优先状态图 | 高度定制 Agentic Workflow |
| Spring AI Alibaba Graph | Java 代码优先状态图 | 深度集成 Spring 业务系统 |

平台的模型支持、节点、许可证和企业功能变化较快，选型时应按当前版本验证。

私有数据不意味着只能选择 Java 框架。Dify 与 n8n 均可部署在企业网络内；真正的选型维度是定制深度、连接器、治理要求、测试方式、团队栈和运维成本。

常见组合是：n8n 负责任务触发和跨系统编排，Dify 或 Java AI 服务负责模型/RAG，核心业务系统继续负责权限、事务和最终写入。

## 6. 如何选择

依次回答四个问题：

1. 步骤能否提前完整枚举？能则优先 Workflow。
2. 中间结果是否会改变后续计划？会则考虑 Agent 或条件图。
3. 错误是否会造成资金、权限或数据损失？风险越高，越要由代码和人工控制。
4. 是否需要长时间运行、暂停恢复和多人审批？需要则使用状态图与持久化检查点。

| 场景 | 推荐方案 | 原因 |
| --- | --- | --- |
| 固定退款审批 | Workflow | 规则、权限、审批链和事务明确 |
| 开放式资料调研 | 受控 Agent | 搜索路径和工具选择无法提前确定 |
| 报告生成、评审与修改 | Agentic Workflow | 固定质量流程中包含动态生成和反思 |
| 定时同步多个系统 | n8n 或传统 Workflow | 核心是连接、转换和可靠执行 |
| Java 核心业务中的复杂 AI 编排 | Spring AI Alibaba Graph | 便于代码治理、测试和业务集成 |

退款场景中，LLM 可辅助抽取材料、识别原因和生成摘要，但金额计算、资格判断、风控和最终退款必须经过确定性规则、权限校验和必要的人工审批。

## 7. 生产级设计

### 7.1 节点契约

每个节点都应定义：

- 输入与输出 Schema。
- 成功、业务拒绝、可重试失败和永久失败。
- 超时、重试次数、退避策略和降级方式。
- 是否幂等、是否产生副作用、是否需要补偿。
- 日志、指标与 Trace 字段。

LLM 输出必须经过 JSON Schema、枚举、长度和业务规则校验。模型给出的 `confidence` 只能作为辅助信号，并不等于校准后的真实概率。

### 7.2 幂等、重试与补偿

Workflow 可能因超时、重启和恢复而重复执行节点，因此有副作用的节点必须使用幂等键：

~~~text
幂等键 = 业务对象标识 + 操作类型 + 业务版本或批次
~~~

重试仅适用于网络超时、限流等暂时性错误；参数非法、权限不足等永久错误不应盲目重试。可采用指数退避、随机抖动、最大次数和死信/人工处理。

跨系统流程通常不能由单个数据库事务覆盖，需要状态记录、Outbox、补偿动作或 Saga 处理部分成功。

### 7.3 循环与人工介入

任何循环都要限制最大迭代次数、总时间、Token/费用、连续失败和重复状态。达到上限后应保存已有结果，进入失败、降级或人工审核状态。

退款、删除、对外发布、低置信度和敏感结论适合 Human-in-the-loop。暂停时保存 Checkpoint；恢复时使用同一任务标识，并重新校验权限与业务状态。

### 7.4 可观测与测试

至少记录 `workflowId`、`taskId`、租户、触发来源、节点耗时、状态、重试、错误、模型与 Prompt 版本、Token、费用、工具调用和人工审批轨迹。

测试包括节点单测、路由与状态迁移测试、失败恢复测试和端到端评测。LLM 节点还要用固定评测集持续观察准确率、格式通过率、幻觉、延迟和成本。

## 8. 实战：舆情分析 Workflow

课程案例使用 n8n、网页抓取、LLM 和 MySQL。生产化后的流程可设计为：

~~~mermaid
flowchart LR
    S["定时触发"] --> L["任务锁与增量游标"]
    L --> P["生成分页任务"]
    P --> C["限速抓取"]
    C --> X["解析与时间标准化"]
    X --> F["过滤、清洗、去重"]
    F --> U["原文 Upsert"]
    U --> A["LLM 主体与情感分析"]
    A --> V["Schema 与业务校验"]
    V -->|"通过"| D["保存结果"]
    V -->|"低置信度或异常"| H["人工审核"]
~~~

### 8.1 抓取与解析

- 使用平台允许的 API 或合规抓取方式，遵守服务条款、隐私和数据要求。
- 采用限速、指数退避与随机抖动应对临时限流，不能无限重试或绕过风控。
- 将 page 或 cursor 生成为独立数据项，实现分页并行或分批处理。
- 保存分页游标与抓取水位，失败后从断点恢复。
- 时间、唯一 ID 和固定页面结构优先使用确定性解析；LLM 抽取可能漏项。
- 统一时区和相对时间，同时保留原始值供审计。

### 8.2 幂等与状态

数据随时间变化不妨碍幂等。帖子通常有稳定身份，可用 `(platform, post_id)` 建唯一索引：

~~~sql
UNIQUE KEY uk_platform_post_id (platform, post_id)
~~~

重复抓取时执行 Upsert：已有帖子更新内容、互动量和最后抓取时间，新帖子才插入。若正文变化，可比较 `contentHash`，只对变化内容重新分析。

建议先保存原文，再异步分析，并维护：

~~~text
analysis_status = PENDING | RUNNING | SUCCEEDED | FAILED | NEEDS_REVIEW
~~~

这样模型失败不会丢失原始数据，也便于按状态重试和统计积压。

### 8.3 LLM 分析与安全

- 输出讨论主体、情感极性、依据短语、摘要和辅助置信度。
- 后端校验枚举、类型、范围、长度和必填字段。
- 对“不讨论目标主体”和“信息不足”建立明确规则。
- 低置信度、敏感内容和结果冲突时转人工审核。
- 保存模型与 Prompt 版本，便于回溯和批量重算。
- 将网页正文视为不可信数据，隔离其中的 Prompt Injection。
- Cookie、Token 和数据库密码进入密钥管理，不写入 DSL、Prompt 或日志。

舆情结论容易受反讽、上下文缺失、方言和模型偏差影响。不能只凭模型自报置信度自动决策，应使用标注评测集衡量准确率并定期人工抽样。

## 9. 常见误区

### 误区一：有 LLM 节点就是 Agent

有 LLM 只能说明它是 AI Workflow。若路径仍由代码完全预定义，LLM 没有控制过程与工具的能力，就不是架构意义上的自主 Agent。

### 误区二：Agentic Workflow 必须动态生成整张图

不需要。固定图加动态路由、Agent 节点和有限反馈环，是更常见也更可控的实现。

### 误区三：低代码平台不能访问企业内网

Dify、n8n 可私有化部署。能否访问内网取决于部署网络、凭证与权限，而不是是否低代码。

### 误区四：模型置信度可以直接驱动高风险决策

模型自报置信度通常未经概率校准，只能作为辅助路由信号，不能替代业务校验、离线评测和人工审核。

### 误区五：重试就是重新运行整个流程

整条流程重跑可能重复副作用。应持久化状态、保证节点幂等，并从失败检查点恢复。

## 10. 面试速答

### 10.1 三种架构有什么区别？

> 区别主要看控制权。Workflow 由预定义代码路径控制，确定性高；Agent 由 LLM 动态选择步骤和工具，灵活但不确定；Agentic Workflow 用状态机控制主流程与风险边界，在局部引入 Agent 的规划、工具调用、反思或多智能体能力。

### 10.2 State、Node 和 Edge 是什么？

> State 是跨节点共享的运行时数据，Node 是读取状态并返回增量更新的计算单元，Edge 决定节点如何跳转，条件边根据 State 选择路径。Checkpointer 持久化状态，用于恢复、人工介入和审计。

### 10.3 如何防止反思流程无限循环？

> 除模型给出的通过标记外，运行时还要检查最大轮次、总超时、Token/费用、重复状态和连续失败。达到上限后保存结果，进入降级或人工审核。

### 10.4 Dify、n8n 和 Spring AI Alibaba Graph 怎么选？

> Dify 偏 LLM 应用、RAG 和模型管理；n8n 偏跨系统自动化和连接器；Spring AI Alibaba Graph 适合 Java 代码优先、需要深度业务集成和严格测试的状态图。三者也可以组合使用。

### 10.5 如何保证工作流可靠执行？

> 为节点定义明确契约和错误类型，用持久化状态支持断点恢复，以业务键保证幂等，对暂时错误限次退避重试，对跨系统副作用设计补偿，并配置超时、预算、人工审批、结构化校验、日志、指标和 Trace。
