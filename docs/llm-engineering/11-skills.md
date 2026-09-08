# Skills 能力封装

## 本章导读

Agent Skill 是将某类任务中已经验证有效的做法，封装为可发现、按需加载、可组合和可维护的能力目录。它通常包含任务指令、参考资料、确定性脚本和产物模板。

Skill 不是新的模型、算法或工具协议。它解决的是：**如何把“完成某类任务的经验”稳定交给 Agent，并在不塞满上下文的前提下长期复用。**

~~~text
Tool 定义能做什么
Skill 说明怎样把事情做好
Workflow 控制实际按什么路径运行
Harness 保证执行过程安全、可验证、可恢复
~~~

## 1. 为什么需要 Skill

在 Skill 出现之前，经验通常散落在：

- 越写越长的 System Prompt。
- Controller、工具和业务代码中的隐式规则。
- 固定 Workflow 的节点配置。
- 团队成员口头传递的操作步骤。

随着 Agent 能力增加，这种方式会导致：

- Prompt 持续膨胀，每次请求都消耗无关 Token。
- 相似任务重复编写指令和工具链。
- 执行步骤、参考资料和脚本分散，难以维护。
- 模型不知道何时使用哪套经验，结果不稳定。
- 经验无法独立测试、版本化、组合和发布。

Skill 将零散经验组织成一个独立能力单元，让 Agent 先看到简短目录，命中任务后再读取完整说明和必要资源。

## 2. Skill 与相关概念的边界

| 概念 | 主要解决的问题 | 典型内容 |
| --- | --- | --- |
| Prompt | 本次怎样向模型描述任务 | 角色、指令、示例、输出格式 |
| Context | 本轮让模型看到哪些信息 | Prompt、历史、RAG、记忆、工具、状态 |
| Tool | Agent 能执行什么原子动作 | 读文件、查数据库、发送邮件 |
| MCP | 外部能力如何标准化暴露和发现 | Tools、Resources、Prompts 与传输协议 |
| Skill | 某类任务怎样稳定完成 | SOP、约束、References、Scripts、Assets |
| Workflow | 节点实际怎样流转 | 状态、分支、循环、重试、审批 |

### 2.1 Skill 不是 Tool

Tool 通常是一个可调用动作；Skill 是指导 Agent 组合知识、工具和步骤完成目标的程序性经验。一个简历评估 Skill 可以调用 PDF 读取、信息抽取和报告生成工具，但它本身不等于这些工具。

### 2.2 Skill 不是 MCP

MCP 是连接与交换协议，解决能力如何从 Server 暴露给 Client。Skill 解决做事方法，可以在步骤中使用 MCP 工具，也可以只使用本地脚本和参考资料。

### 2.3 Skill 不是 Workflow 的升级版

Skill 可以描述工作流程和失败处理，但这些自然语言步骤仍需 Agent 理解与执行。Workflow Runtime 则明确维护 State、Node、Edge、条件、循环和 Checkpoint，能够强制控制实际路径。

二者可以组合：Workflow 的某个节点调用专业 Agent，Agent 再加载对应 Skill；或者 Skill 指示 Agent 调用一个已经编排好的子工作流。

### 2.4 Skill 与长期记忆

Skill 可视为程序性记忆：保存“怎样做某类事”。长期记忆还包括用户偏好、历史事件和实体事实。Skill 应是可验证、可版本化的通用方法，不应混入某个用户的敏感信息。

## 3. 标准目录结构

一个 Skill 至少包含 `SKILL.md`，其余目录按需使用：

~~~text
resume-review/
├── SKILL.md                 # 必选：元数据与执行指令
├── references/              # 可选：规则、示例、字段说明
│   ├── job-description.md
│   └── scoring-rubric.md
├── scripts/                 # 可选：确定性程序
│   ├── extract_resume.py
│   └── validate_report.py
└── assets/                  # 可选：模板、图片等产物资源
    └── report-template.md
~~~

不同客户端可能对目录名、可执行文件和加载行为有扩展，使用时应以目标运行时的 Skill 规范为准。

### 3.1 `SKILL.md`

`SKILL.md` 由 YAML Frontmatter 和 Instruction 正文组成：

~~~markdown
---
name: resume-review
description: Analyze a candidate resume against a job description and produce evidence-based interview questions. Use when the user requests resume screening, JD matching, or interview preparation.
---

# Resume Review

## Preconditions
- A resume and job description must be available.

## Workflow
1. Read the resume and JD.
2. Extract evidence before scoring.
3. Validate the report structure.

## Safety
- Do not infer protected personal attributes.
- Mark unsupported claims as unknown.

## Completion Criteria
- Every score cites resume or JD evidence.
~~~

Frontmatter 用于发现和路由，正文用于执行。正文应包含：

- 适用与不适用场景。
- 输入前提和缺失信息处理。
- 可复现的步骤及步骤顺序。
- 需要调用的工具、脚本和参考文件。
- 风险边界、禁止动作和人工确认点。
- 输出格式与完成标准。
- 失败、重试和降级方式。

### 3.2 Metadata

核心字段通常是：

- `name`：唯一、稳定、机器可识别的 Skill 名称。
- `description`：说明做什么，以及什么请求应该使用它。

`description` 决定 Agent 能否选中 Skill：

- 过于宽泛会导致不相关任务也触发。
- 过于狭窄会漏掉合理表达。
- 多个 Skill 描述高度重叠会造成路由冲突。
- 只描述能力、不描述触发场景，会降低匹配准确率。

名称、长度、字符和目录一致性要求可能因规范版本不同而变化，应在加载阶段进行 Schema 校验。

### 3.3 Instruction

Instruction 是命中 Skill 后加载的执行说明。它应短而明确，不应堆入大段领域资料或大量示例。

好的 Instruction 描述决策点，而不只是一串理想路径。例如：输入缺失时询问用户，解析失败时尝试备用工具，涉及高风险操作时暂停审批，验证失败时最多修订多少次。

### 3.4 References

References 保存执行时可能需要查阅的细节：

- 详细业务规则和字段定义。
- API、数据库或文件格式说明。
- 评分 Rubric、Few-shot 示例和典型坏案例。
- 固定岗位 JD、法律条文或项目规范。

Reference 不应因为 Skill 被加载就全部进入 Context。Instruction 应明确在什么步骤读取哪个文件，运行时再按文件或范围加载。

### 3.5 Scripts

Scripts 承载不适合交给模型临场生成的确定性逻辑：

- PDF、表格和结构化文件解析。
- Schema 校验、格式化、排序和统计计算。
- 大文件搜索、过滤和裁剪。
- 固定的构建、测试、渲染与验收操作。

执行脚本通常只需将结构化结果返回模型，不必把源代码全部注入 Context。但这不是绝对规则：调试或安全审查时，Agent 可能需要读取脚本内容。

脚本产生真实副作用，必须由 Harness 实施权限、超时、沙箱、参数和审计控制。

### 3.6 Assets

Assets 是生成产物时直接使用的资源，例如：

- 报告、邮件、页面和配置模板。
- 图片、字体、样式和品牌素材。
- 文档模板与示例工程骨架。

Reference 主要给 Agent 阅读，Asset 主要用于生成或组成交付物。示例报告通常属于 Reference，可复用的空白模板更适合放入 Assets。

## 4. 渐进式披露

Skill 通过分阶段加载减少上下文消耗：

| 层级 | 内容 | 加载时机 | 目的 |
| --- | --- | --- | --- |
| L1 Metadata | `name`、`description` | 技能发现时常驻 | 让模型知道有哪些能力 |
| L2 Instruction | `SKILL.md` 正文 | Skill 命中后 | 获得完整 SOP 与边界 |
| L3 Reference/Assets | 规则、示例、模板 | 具体步骤需要时 | 补充最小必要细节 |
| L4 Script | 确定性程序 | 执行到相应步骤时 | 稳定完成计算或副作用 |

~~~mermaid
flowchart LR
    U["用户任务"] --> M["匹配 Metadata"]
    M -->|"命中"| I["读取 Instruction"]
    I --> R["按步骤读取 Reference / Asset"]
    I --> S["按需执行 Script / Tool"]
    R --> O["生成并验证产物"]
    S --> O
~~~

这种方式将“能力发现”和“能力执行”解耦。系统不需要每次把所有 Skill 的完整内容塞入 System Prompt，也不会让模型一开始就读取所有辅助文件。

渐进式披露并不保证 Token 一定更少。如果 Metadata 数量过多、描述冗长，或命中后一次读取全部 References，仍会产生上下文膨胀。因此需要限制目录规模、分组路由和记录实际加载 Token。

## 5. 如何设计高质量 Skill

### 5.1 选择合适粒度

适合封装为 Skill 的任务通常具有：

- 会重复出现，不是一次性操作。
- 存在经过验证的固定步骤、判断标准或踩坑经验。
- 需要组合多个工具、资料或脚本。
- 输出能够通过规则、脚本或人工验收。

过大的“完成所有软件开发任务”无法给出稳定流程；过小的“将字符串转小写”更适合普通工具函数。

### 5.2 明确触发边界

`description` 应覆盖常见用户表达，同时指出边界。例如简历 Skill 可以响应“筛选候选人、JD 匹配、生成面试问题”，但不应因普通的“写一份简历”请求误触发。

当多个 Skills 相似时，可以：

- 合并真正重叠的能力。
- 在描述中写清输入类型、目标和排除场景。
- 使用领域路由后只暴露小范围 Metadata。
- 为冲突任务要求用户澄清。

### 5.3 保持确定性边界

- 计算、解析、校验和排序尽量使用 Script。
- 开放式总结、分类和内容生成交给 LLM。
- 权限、租户、金额和副作用由后端校验。
- 高风险动作进入 Human-in-the-loop。

Skill 可以建议重试，但最大轮次、超时和费用预算必须由 Harness 强制执行。

### 5.4 提供可验证完成标准

不要只写“生成高质量报告”，而应写成：

- 输出必须通过指定 JSON Schema。
- 每个结论包含证据引用。
- 脚本退出码为 0，目标测试和回归测试通过。
- 产物存在、可打开且必填章节齐全。
- 未找到依据时明确标记未知，不得猜测。

### 5.5 管理路径和依赖

- Skill 内文件使用相对于 Skill 根目录的稳定路径，由运行时解析为绝对路径。
- 不要写死作者机器上的绝对路径。
- 外部依赖、运行时和版本要在 Preconditions 中说明。
- 网络下载和包安装属于副作用，需要权限与校验。
- JAR 或打包环境中的资源可能要复制到临时目录后才能由脚本访问。

## 6. 实战：简历评估 Skill

### 6.1 目录分工

~~~text
resume-review/
├── SKILL.md
├── references/
│   ├── jd.md
│   ├── scoring-rubric.md
│   └── example-report.md
├── scripts/
│   ├── extract_resume.py
│   └── validate_report.py
└── assets/
    └── report-template.md
~~~

执行流程：

1. 校验简历、JD 和输出语言是否存在。
2. 调用确定性解析工具提取 PDF 文本和页码。
3. 读取 JD 与评分 Rubric。
4. 先抽取候选人事实和来源，再进行匹配评价。
5. 输出优势、差距、匹配度和三类面试问题。
6. 使用脚本验证报告结构、引用和评分范围。
7. 证据不足时标记待确认，不推测经历。

### 6.2 评分边界

模型给出的百分比不是客观概率。评分应基于明确 Rubric，并展示各维度依据和权重。招聘场景还要避免根据性别、年龄、婚育、民族等受保护属性作出判断，并保留人工决策。

### 6.3 为什么 JD 应成为 Reference

如果固定 JD 很长，把它放进 `SKILL.md` 会使每次使用都加载；放入 `references/jd.md` 后，仅在进行 JD 匹配时读取，也便于独立更新和版本管理。

如果不同岗位使用不同 JD，则不应把单个 JD 固化在通用 Skill 中，应将 JD 作为本次输入或按岗位选择 Reference。

## 7. Skill 的通用运行原理

不同 Agent 客户端实现细节不同，但核心链路相似：

~~~text
启动或刷新
-> 扫描 Skill 目录
-> 解析并校验 Frontmatter
-> 将 Metadata 注册到内存目录
-> 模型调用前注入可用 Skill 摘要
-> LLM 根据任务选择 Skill
-> 调用 read_skill 读取完整 Instruction
-> 按需读取辅助文件或解锁专用工具
-> 执行、验证并返回产物
~~~

### 7.1 发现阶段

运行时扫描约定目录下的 `SKILL.md`，解析 `name`、`description`、路径、来源和正文，并检查名称冲突、格式和可读权限。

用户级 Skill 与项目级 Skill 可以使用覆盖规则，但必须明确优先级并记录最终来源，防止同名恶意 Skill 替换可信版本。

### 7.2 执行阶段

模型最初只看到 Metadata 和 `read_skill` 工具。当任务匹配时，模型调用 `read_skill(skill_name)`，运行时执行权限检查并返回正文、Skill 根目录和辅助文件目录。

读取 Skill 不等于执行其中所有内容。模型仍应根据当前任务按需读取资料、调用工具，并服从更高优先级的系统规则和用户授权。

## 8. Spring AI Alibaba 集成

以下 API 来源于课程所用版本，包名与行为可能随版本变化，应以项目依赖和官方文档为准。

### 8.1 核心类型

| 类型 | 作用 |
| --- | --- |
| `SkillMetadata` | 保存名称、描述、路径、来源和正文 |
| `SkillRegistry` | 技能注册中心抽象，支持列表、读取和刷新 |
| `ClasspathSkillRegistry` | 从 classpath/JAR 中加载 Skill |
| `FileSystemSkillRegistry` | 从用户级和项目级目录加载 Skill |
| `ReadSkillTool` | 向模型暴露 `read_skill`，按名称读取正文 |
| `SpringAiSkillAdvisor` | ChatClient 调用前注入 Skill 目录 |
| `SkillsAgentHook` | ReactAgent 的 Skill Hook |
| `SkillsInterceptor` | 注入目录，并可按已读取 Skill 动态加入工具 |

### 8.2 ChatClient 路径

~~~java
SkillRegistry registry = ClasspathSkillRegistry.builder()
        .classpathPath("skills")
        .build();

ToolCallback readSkill =
        ReadSkillTool.createReadSkillToolCallback(registry, null);

SpringAiSkillAdvisor skillAdvisor = SpringAiSkillAdvisor.builder()
        .skillRegistry(registry)
        .build();

ChatClient chatClient = ChatClient.builder(chatModel)
        .defaultAdvisors(skillAdvisor)
        .defaultToolCallbacks(readSkill)
        .build();
~~~

执行时：

1. `ClasspathSkillRegistry` 扫描并注册 Metadata。
2. `SpringAiSkillAdvisor.before()` 将技能目录追加到 System Message。
3. LLM 调用 `ReadSkillTool` 获取完整 `SKILL.md`。
4. LLM 按 Instruction 使用其他已注册工具完成任务。

基础 Advisor 的 `after()` 通常不承担业务逻辑。动态工具解锁是否可用，取决于具体版本和是否使用相应 Interceptor，不能默认所有 Advisor 都具备。

### 8.3 ReactAgent 路径

~~~java
SkillRegistry registry = ClasspathSkillRegistry.builder()
        .classpathPath("skills")
        .build();

SkillsAgentHook skillsHook = SkillsAgentHook.builder()
        .skillRegistry(registry)
        .build();

ReactAgent agent = ReactAgent.builder()
        .name("resume-agent")
        .model(chatModel)
        .hooks(List.of(skillsHook))
        .build();
~~~

`SkillsAgentHook` 负责暴露 `read_skill` 工具并注册 `SkillsInterceptor`。后者在模型调用前注入 Skill 目录；部分实现还会扫描历史中的 `read_skill` Tool Call，从 `groupedTools` 中把该 Skill 关联的工具加入 `dynamicToolCallbacks`。

~~~text
读取 sql-schema Skill
-> 下一轮识别已读取的 skill_name
-> 动态解锁该 Skill 的数据库只读工具
~~~

动态注入可以减少无关工具干扰，但专用工具仍需权限校验，不能因为 Skill 被加载就自动获得高权限。

### 8.4 Registry 选择

- `ClasspathSkillRegistry`：适合随应用发布、版本固定的内置 Skill。
- `FileSystemSkillRegistry`：适合独立更新的用户级或项目级 Skill。

文件系统热加载要考虑并发读取、更新原子性、缓存失效和恶意替换。生产环境可使用只读发布目录、签名制品和明确版本，而不是允许任意进程直接修改。

## 9. Skill 安全

Skill 是自然语言、代码和资源的混合制品，并可能获得文件、网络和命令执行能力，风险不低于普通软件包。

### 9.1 主要风险

| 风险 | 示例 |
| --- | --- |
| Prompt Injection | 在 Metadata 或 Instruction 中要求窃取 `.env` |
| 数据泄露 | 将简历、源码或密钥发送到外部服务 |
| 供应链攻击 | 同名仿冒 Skill、开发者账号被盗、依赖投毒 |
| 过度授权 | 普通整理任务拥有全盘写入和任意网络权限 |
| 任意代码执行 | Script 执行未经审计的 Shell、Python 或依赖安装 |
| 路径穿越 | 通过相对路径读取 Skill 根目录之外的文件 |
| 持久化后门 | 创建定时任务、修改启动配置或注册后台服务 |
| 非确定性行为 | 相同 Skill 在不同 Context 中执行不同危险动作 |

Reference、Asset、配置和依赖脚本都属于攻击面，不能只审查 `SKILL.md`。

### 9.2 防护措施

- 只从可信来源安装，锁定版本并审查安装 Diff。
- 使用数字签名、制品校验和来源证明防止分发篡改。
- 注意 SHA-256 只能证明文件未变化，不能证明原始内容可信。
- 对 Instruction、Script、依赖和网络目标进行静态与人工审计。
- 按 Skill 授予最小文件、网络、进程和工具权限。
- 脚本在容器、WASM 或操作系统沙箱中运行。
- 高风险 Tool Call 在执行前展示参数并请求用户批准。
- 禁止默认读取密钥目录和向任意域名发送数据。
- 对日志和产物做密钥、个人信息和业务数据脱敏。
- 卸载时检查定时任务、配置、服务和缓存等遗留物。
- 建立漏洞举报、撤回、版本回滚和吊销机制。

哈希、签名和社区开源审查各自只解决部分信任问题，需要组合使用。

## 10. Skill 自进化

Skill 自进化是 Agent 在完成任务后，将已验证的非平凡经验提炼为新 Skill，或用新经验修订已有 Skill。它把执行轨迹转化为可复用的程序性记忆。

### 10.1 适合触发的情况

- 完成了会重复出现的复杂任务。
- 多次工具调用后形成稳定、可复现的方法。
- 克服了一个非显然错误，并验证了解法。
- 用户纠正的方法被测试证明有效。
- 使用现有 Skill 时发现步骤过时、遗漏或错误。
- 用户明确要求沉淀流程。

工具调用次数只能作为审查信号，不能单凭“超过 5 次或 10 次”认定值得创建 Skill。

### 10.2 创建前的质量门槛

候选经验应满足：

- 可复用，而非只适用于本次路径和临时环境。
- 最终结果已经通过外部测试、规则或人工验证。
- 已抽象输入、步骤、边界、失败处理和完成标准。
- 已删除用户数据、凭证、绝对路径和一次性参数。
- 不与现有 Skill 重复，或明确应更新哪个版本。
- 脚本和资源经过安全审查。

### 10.3 推荐治理流程

~~~mermaid
flowchart LR
    T["复杂任务完成"] --> R["后台复盘"]
    R --> C["生成 Skill 草稿或补丁"]
    C --> S["脱敏、安全与重复检查"]
    S --> E["评测和沙箱试运行"]
    E --> H["用户或维护者审核 Diff"]
    H --> V["版本化发布"]
    V --> M["监控触发率和成功率"]
~~~

模型可以自动提出建议、生成草稿和测试，但不应静默创建、修改或删除会影响未来任务的 Skill。高权限 Skill 尤其需要人工批准、版本记录和快速回滚。

后台复盘 Agent 应禁止再次触发自进化，限制轮次，并在主任务响应完成后运行，避免递归创建和争夺用户任务的上下文预算。

## 11. 评测与维护

### 11.1 评测指标

- Trigger Precision：不该触发时是否误触发。
- Trigger Recall：该使用时是否能找到 Skill。
- Task Success Rate：加载 Skill 后任务是否成功。
- Validation Pass Rate：产物通过脚本或规则验证的比例。
- Token/Latency Delta：渐进式加载是否真正节省成本。
- Tool Accuracy：是否选择正确工具与参数。
- Safety Violation Rate：是否越权、泄密或执行禁止动作。
- Human Intervention Rate：需要人工修正的比例。

### 11.2 测试集

每个 Skill 至少准备：

- 正向触发样例和不同表述。
- 不应触发的相近任务。
- 与其他 Skill 容易混淆的请求。
- 缺少输入、格式错误和工具失败。
- Prompt Injection、越权路径和敏感数据样例。
- 预期产物及可执行验证。

### 11.3 版本治理

- Skill、Script、Reference 和 Asset 一起进入版本控制。
- 记录变更原因、兼容性和评测结果。
- 修改 Metadata 时重点做路由回归。
- 修改脚本和权限时重点做安全回归。
- 监控上线后的误触发、失败和人工纠正，并可快速回滚。

## 12. 常见误区

### 误区一：Skill 就是一段更长的 Prompt

Skill 的 Instruction 确实包含 Prompt，但完整 Skill 还包括发现元数据、按需资料、确定性脚本、产物资源、验证和治理。

### 误区二：Skill 是升级版 Workflow

Skill 描述做事方法，Workflow Runtime 强制执行状态流转。二者的控制力度和运行职责不同。

### 误区三：所有资料都放入 `SKILL.md` 最稳定

这会破坏渐进式披露。详细资料放 References，确定性逻辑放 Scripts，模板和素材放 Assets。

### 误区四：Script 执行不消耗 Token，所以没有风险

脚本虽可避免模型理解实现细节，但会产生真实副作用，也可能需要读取和调试。必须实施沙箱、权限、超时和审计。

### 误区五：开源或哈希一致就一定安全

开源不代表有人审计，哈希只证明制品一致。还要验证来源、签名、权限、依赖和实际行为。

### 误区六：Agent 可以自动维护所有 Skill

错误更新会永久影响后续任务。自进化应生成可审核补丁，通过评测、安全检查和版本发布后才生效。

## 13. 面试速答

### 13.1 Agent Skill 是什么？

> Skill 是面向某类重复任务的能力目录，通过 Metadata、Instruction、References、Scripts 和 Assets 封装经过验证的 SOP。它不是新模型或工具协议，而是可复用的程序性经验。

### 13.2 Skill 为什么能减少上下文？

> 它使用渐进式披露：发现阶段只注入名称和描述，任务命中后才读取完整指令，执行到具体步骤时再读取 Reference 或运行 Script，避免每次加载所有能力细节。

### 13.3 Skill、Tool 和 Workflow 有什么区别？

> Tool 提供原子动作，Skill 说明如何组合知识和工具完成某类任务，Workflow 由运行时控制节点、状态和分支。Skill 可以调用 Tool，也可以被 Workflow 中的 Agent 节点加载。

### 13.4 Spring AI Alibaba 如何加载 Skill？

> Registry 扫描 `SKILL.md` 并注册 Metadata；Advisor 或 Interceptor 在模型调用前注入技能目录；LLM 命中后调用 `ReadSkillTool` 获取完整正文；Agent 再按需读取辅助文件或由 Interceptor 动态加入该 Skill 的专用工具。

### 13.5 如何设计一个安全的 Skill？

> 只从可信来源安装并锁定版本，审查 Instruction、脚本和依赖；按 Skill 授予最小文件与网络权限，在沙箱执行脚本，高风险动作人工审批，并对数据、日志、更新和卸载过程进行审计。

### 13.6 Skill 自进化如何落地？

> Agent 在复杂任务完成后提出可复用经验，后台复盘生成脱敏的 Skill 草稿或补丁，再经过重复检查、沙箱测试、安全评审、人工确认和版本化发布。模型可以提出更新，但不应静默改变未来行为。
