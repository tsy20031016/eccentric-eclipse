---
title: "Aegis Agent — 企业级 Agent 执行系统"
description: "Aegis Agent — 企业级 Agent 执行系统"
status: "active"
---

## S1:用户问题十维解构规范（Enterprise Query Decomposition Taxonomy）

$$x \;\longmapsto\; \big(D_1,\,D_2,\,D_3,\,D_4,\,D_5,\,D_6,\,D_7,\,D_8,\,D_9,\,D_{10}\big)$$

| 维度 | 名称 | 数学对象 | 取值/判据 |
| --- | --- | --- | --- |
| D1 | 意图确定性 | $H(\text{Intent}\mid x)$ | 单义 / 可枚举多义 / 组合意图 / 隐性意图 / 元请求 |
| D2 | 判定类型 | 问题所属计算类别 | 求值 / 搜索 / 优化 / 合规判定(CSP) / 无良定义 |
| D3 | 信息闭合性 | 答案所需信息来源 | 参数内禀 / 私有静态 / 私有实时 / 跨系统异构 |
| D4 | 依赖拓扑 | 图/网结构类型 | 独立并行 / 链式 / 一般DAG / 有环(反馈) / 树状守卫(Petri网) |
| D5 | 结构确定性 | $H(G\mid\text{Intent})$ | =0（静态可编译）/ >0（需动态重规划） |
| D6 | 可验证性 | 是否存在Verify oracle | 强验证 / 弱验证(统计/规则) / 不可验证(纯偏好) |
| D7 | 风险与后果尺度 | $\text{Severity}\times\text{Reversibility}^{-1}$ | 只读 / 可逆写入 / 不可逆(需人工在环) |
| D8 | 权限与敏感度 | $\text{Scope}(x)\subseteq\text{Permissions}$ | 权限内 / 越权触发(需剪枝) / 跨租户(应拒绝) |
| D9 | 时效敏感度 | 答案半衰期 $\tau(x)$ | 快衰减(不可缓存) / 慢衰减(可复用) |
| D10 | 编排规模 | 涉及智能体数量 | 单智能体 / 多智能体协作(通信复杂度) |



处理顺序上的硬约束（这一点很关键，不是十个维度平权并列）：

AgentInput

    ↓

D1 意图解析门

    ↓

D8 计划前粗粒度权限检查

    ↓

D7 计划前风险预分类

    ↓

D2 + D3 问题类型与信息需求

    ↓

D4 + D5 任务图与结构确定性

    ↓

D6 节点级验证方案

    ↓

D8 计划后节点级权限复检

    ↓

D7 计划后节点级风险复检

    ↓

D9 缓存与时效策略定稿

    ↓

D10 单/多智能体执行形态定稿

    ↓

Query IR


## 现考虑D1意图确定性：

## 一、把意图拆成五种情形

D1 用五个互斥标签表达入口判断，并给下游一个处理方向：

- **单义**：目标足够明确，例如“计算 23 × 7”。可以继续构造任务结构。
- **可枚举多义**：存在几个可说清楚的解释，例如“帮我开个账户”，但没有说明账户类型。应列出候选并请用户澄清。
- **组合意图**：一句话里有多个需要分别处理的任务，例如“查库存，再生成采购建议”。应拆出子任务及其关系。
- **隐性意图**：字面诉求和真正要解决的问题可能不同，例如“这个报表我看不懂”，背后可能需要解释异常或提炼结论。应重新推断目标，再决定下一步。
- **元请求**：用户询问 Agent 本身的能力或规则，例如“你能做什么？”应进入系统能力说明路径。

这五类描述的是**意图的表达形态**，不是安全等级。“可枚举多义”不等于危险，“单义”也不意味着有权限执行。D1 的 `action` 字段只是下游路由建议；权限仍由 D8 判定，后果仍由 D7 判定。

##  二、为什么不能只让模型直接选五选一

整句分类很方便，但一句输入可能同时包含多项任务，其中某个子任务又有多义或隐性目标。单次分类容易把这些信号压扁。Aegis Agent 因此把 D1 分成**证据提取**和**最终裁决**两层：先留下每个判断的依据，再通过可复现的规则、可选的校准模型与分歧裁判形成结果。

证据提取采用四个阶段：

1. **Stage 0：元请求识别。**先判断用户是否在问系统自身。这里结合模型多次采样的投票与规则信号；达到提前退出条件时，可直接进入元请求分支。
2. **Stage 1：任务骨架。**提取任务、目标和依赖边，关注有几个可独立处理的子任务。多次采样不一致时保留一致性信息，避免把一句话随意拆成很多任务。
3. **Stage 2：候选意图及熵。**针对每个子任务枚举合理解释，估计候选概率，再计算熵、有效候选数与概率间隔。候选越分散，越需要澄清。这里的熵只针对**已枚举的候选意图分布**，并不是对用户真实心理状态的精确测量。
4. **Stage 3：溯因差异。**比较字面任务计划和推断出的后验目标、计划，估计二者偏离程度。如果照字面执行很可能无法满足真实需求，就为“隐性意图”提供证据。

与此同时，整句五分类投票作为一份独立意见运行。Stage 1 得到子任务后，Stage 2 和 Stage 3 可以并行提取证据。最终特征还纳入轻量规则和字符级 TF-IDF 信号，让系统在无模型环境中也能运行离线评测。

从信息论角度，`H(Intent | x)` 是 D1 的概念性判据：给定输入后，目标仍有多大不确定性。工程实现没有声称直接测得这个理论量。在线 Stage 2 的候选熵只覆盖模型枚举出来的解释；离线模式的标签分数熵则只是代理指标，两者不能混用。

## 三、从证据到决策

V2 的基础裁决是一个有顺序的级联：先看元请求，再看是否需要拆分多个任务，再看候选多义，最后看字面与后验目标的偏离；都未命中时归为单义。这个顺序使结果可以解释为“哪条证据触发了哪条分支”。阈值可以在开发集上校准。

级联之外，还有一个可选的多类别逻辑回归堆叠器，读取阶段特征、整句投票及轻量分类分数。它只用开发集训练，校准产物标记在线或离线模式，加载时检查模式一致性。当级联、堆叠器和整句意见出现分歧时，可按配置调用模型裁判审阅证据；裁判输出无效则回退到级联结论。这样，模型可以参与理解与复核，最终结果仍保留来源和推理轨迹。

检测器的接口也对应这一分层：`extract()` 负责生成结构化证据，`decide()` 负责据此裁决。结果包含五分类标签、置信度、建议动作、运行模式、分阶段证据与决策轨迹。它让后续编排能分清“得到了什么结论”和“结论从何而来”。

 ## 四、如何接入现有 Agent

D1 目前可独立调用，也能通过可选的 `IntentCertaintyAnalyzer` 为现有 S11 任务分析器补充信息。适配器保留输入网关已经确定的事实；在线 Stage 2 若产生真实候选分布，就把候选及概率提供给 S11 的意图模糊度计算。离线代理熵只写入摘要，不作为在线候选概率进入编排评分。结构化摘要可以进入 Trace，方便回看判断依据。

当前默认配置关闭这条检测链，因此既有主流程不会因为 D1 增加模型调用。D1 的建议动作也没有自动变成 D8、D7 或工具执行指令。未来接入 Query Compiler 时，应把 D1 的输出作为后续权限、风险和结构规划的明确输入，同时保留它的证据来源与不确定性。

## 五、验证结果与边界

S14 使用相互隔离的开发集与测试集，各 60 条、每类 12 条。离线开发集五折验证准确率为 80%；冻结实现后，离线测试集正确 50/60，准确率 83.33%，宏平均 F1 为 0.8345。这证明离线路径在该数据集上可运行并有一定区分能力，**不能推导出线上多阶段模型链路具有同样准确率**。线上特征依赖真实模型输出，需要单独收集样本、校准和评测。

当前还有三个工程边界。第一，Stage 2 只能在枚举出的候选中估计不确定性，遗漏候选会造成低估。第二，在线多次采样、整句投票和分歧裁判有调用成本与延迟，提前退出和按分歧调用只能缓解，不能消除。第三，D1 与 D8、D7 的硬顺序仍待 Query Compiler 落地；今天的模块化实现不能写成“生产执行链已完成”。

D1 的价值不在于给输入贴一个漂亮标签，而在于把“是否理解用户目标”变成可检查的中间结果：明确意图继续规划，多义先澄清，复合请求先拆分，隐性诉求先重新推断，元请求转入能力说明。只有在这一步留下可追溯的判断依据，后面的权限、风险和任务规划才有稳定的对象。

项目实现可参阅 [D1 检测器](../app/intent_certainty/pipeline.py)、[级联与堆叠器](../app/intent_certainty/decider.py)、[编排适配器](../app/intent_certainty/analyzer.py)；开发记录见 [S13](S13_intent_certainty.md) 和 [S14](S14_intent_certainty_v2.md)。





D1架构图：
![System Architecture Diagram For intent Determinism Detection.png](https://tsy20031016.github.io/eccentric-eclipse/images/projects/aegis-agent/1790589069822-w7r2ub09.png)






## 考虑D8：(D8设计为独立架构，需要额外接入请求链)

可信主体 PrincipalContext

        ↓

静态企业红线预检

        ↓
LLM 提取 AccessClaim（不参与授权）

        ↓
结构化企业红线复检

        ↓
确定性企业权限策略裁决

        ↓
允许 / 剪枝 / 澄清 / 拒绝 / 无法判定

两个可独立替换的企业子程序：

- EnterpriseRedlinePrecheck
  - 静态企业红线预检
  - 支持原始请求检查和结构化语义复检
- PermissionPolicyAdjudicator
  - 确定性企业权限策略裁决
  - 显式拒绝优先、默认拒绝、跨租户显式授权、组合请求部分剪枝

AUTHORIZATION_REDLINE_POLICY_PATH=policies/examples/redlines.json
AUTHORIZATION_PERMISSION_POLICY_PATH=policies/examples/permissions.json

安全边界

- 主体身份只能来自可信认证系统，不能从用户文本或 session_id 推断。
- LLM 只能提取访问声明，输出授权字段会被严格拒绝。
- 策略故障、模型故障均收敛为 indeterminate，不会默认放行。
- D8 属于计划前粗粒度检查，结果固定要求计划展开后再次做资源级权限复检。
- 当前作为独立模块交付，尚未接入现有 Agent 主请求链。

## D8架构图：

![D8架构diagram.png](https://tsy20031016.github.io/eccentric-eclipse/images/projects/aegis-agent/1790614594478-aw6b1asc.png)



## D7 计划前风险预分类：

## 1. 位置与职责

D7 位于计划前的 `D1 → D8 → D7 → D2/D3` 顺序中。D1 识别意图，D8 先做粗粒度授权和能力剪枝，D7 只评估 D8 **已允许**的原子能力。它回答“这个动作可能造成多严重、能否恢复、是否需要人工确认”，不回答“主体是否有权限”，也不执行工具。

目前 D8 与 D7 均可独立调用，但 Query Compiler 尚未把它们接成主请求链。`PrePlanRiskService.classify()` 的输入是 D8 的 `PrePlanAuthorization`，输出是 `PrePlanRisk`。

## 2. 输入如何进入 D7

D8 结果带有 `allowed_capabilities`、`denied_capabilities`、`pruned_capabilities` 和结构化 `AccessClaim`。D7 只用允许清单中的稳定能力键回查 `AccessClaim.requests`，得到动作、资源类型、数据等级等字段。被拒绝或剪枝的能力不参与风险聚合。

若 D8 未放行，D7 返回 `not_applicable`。若允许清单缺失、能力键无法唯一回查，或同一能力同时被允许和拒绝/剪枝，D7 返回 `indeterminate`。这保证了分类不能建立在不完整或互相矛盾的授权结果上。

## 3. 策略判定与可替换性

`RiskPolicyEvaluator` 是后果策略的唯一调用协议：输入一个 `RequestedAccess`，返回带策略版本、匹配状态、规则 ID、严重度、可恢复性、效果类型及原因码的 `RiskPolicyDecision`。

当前 `StaticRiskPolicyEvaluator` 从 `RISK_POLICY_PATH` 指向的 JSON 后果矩阵装配。规则按动作、资源类型、数据等级匹配；显式字段更多的规则优先。最高特异度仍有多个匹配，或没有规则命中时，结果为未决。策略后端异常、返回非法结构、或同一请求内策略版本改变，也都收敛为 `indeterminate`。

企业将来可以实现同一协议来连接 OPA 或内部策略中心。D7 服务本身不依赖 Rego、OPA API 或网络服务；当前默认实现仍可完全离线运行。

## 4. 后果评分与聚合

单项后果的预分类分数为 `severity / recoverability`：严重度为 1–4，可恢复性取可逆 `1`、可补偿 `0.5`、不可逆 `0.25`。这是有序的工程分级，不代表事故概率或财务损失。

每项能力分别留下 `Consequence`（能力键、规则 ID、严重度、可恢复性、效果及分数）。只要一项不可逆或分数达到 `8`，整体为 `human_review`；否则有写入或外部效果时为 `reversible_write`，全部为纯读取时为 `read_only`。任何能力未决，整体为 `indeterminate`，已知高风险项的人工确认标记仍保留。

导出属于外部效果：即使操作形式像读取，已披露的数据不能靠撤销本地文件恢复。规则必须显式声明这种后果，服务不会仅凭动作名猜测。

## 5. 具体动作的待审契约

计划前的 `human_review` 只是一项义务。计划展开后，调用方才能构造 `ProposedAction`：计划 ID、工具调用 ID、能力键、工具名和规范 JSON 参数。`propose_approval()` 只为 D8 已允许且 D7 对**该项能力**明确判为高风险的动作创建 `ApprovalRequest`。

待审请求的 SHA-256 指纹绑定主体、租户、工具及参数、计划与调用 ID、D8 策略和权限快照、D7 后果规则及过期时间。`matches()` 只验证当前待执行动作是否仍是同一待审动作；参数、身份、策略或到期时间变化都会使请求失效。指纹不是签名，也不是“已批准”的证明。对外摘要不包含工具参数正文。

## 6. 现状与待接入部分

**已实现**：D8 输出到 D7 的数据契约、JSON 风险策略适配器、可替换策略协议、确定性评分与未决语义、具体动作的待审请求和一致性检查。

**待接入**：可信认证边界、Query Compiler 的硬顺序、计划后节点级 D8/D7 复检、审批人身份和批准状态的服务端验证、LangGraph `interrupt()` / `Command(resume=...)`、以及跨重启等待审批所需的持久化 checkpointer。执行节点必须在确认和复检之后才产生副作用。

代码入口：[风险服务](../app/risk/service.py)、[策略协议](../app/risk/protocols.py)、[静态策略适配器](../app/risk/policy.py)、[待审契约](../app/risk/approval.py)。实施与验收记录见 [S16](S16_d7_preplan_risk.md) 和 [S17](S17_d7_policy_approval_contract.md)。

## D7架构图：


![D7-diagram.png](https://tsy20031016.github.io/eccentric-eclipse/images/projects/aegis-agent/1790632939154-c8az8qhc.png)


## D2判定类型：架构思路

## 1. D2 回答什么

D2 判断任务的**主要计算目标**，为后续求解器或规划方式选择提供依据。它不判断数据在哪里（D3）、任务依赖图是什么形状（D4/D5）、答案如何验证（D6），也不授予权限或批准风险动作。

六类目标为：
`evaluation` 求值/推导、
`retrieval` 检索/枚举、
`decision` 判定/约束满足、
`optimization` 优化/排序、
`construction` 构造/规划、
`diagnosis` 解释/诊断。
“合规判定”是 `decision` 的一种具体应用；约束满足是该类中的另一种形式，不与合规判定画等号。

“定义不足”与六类正交。D2 用 `definition_status=sufficient|insufficient` 表达能否根据现有问题描述确定求解目标与必要条件。缺少的槽位单独列出，不制造第七种问题类型。这里的“充分”只指**问题规格**，不表示所需数据已到手；数据闭合性由 D3 判断。


## 2. 输入与前置门控

未来 Query Compiler 应先完成 D1、D8、D7，剪枝后为 D2 提供 `ScopedProblem(text, capability_keys)`。D2 核对所引用的能力是否属于 D8 允许清单、是否未被拒绝或剪枝，以及 D7 是否对这些能力留下可对应的后果记录。D8 未放行或 D7 不适用时返回 `not_applicable`；D7 不可判定、范围不一致时返回 `indeterminate`。任何这些情况都不会调用证据提取器。

`ScopedProblem.text` 必须由可信编译器从已允许的任务片段产生。D2 能检查能力键和后果记录，却不能仅凭字符串证明片段没有夹带被剪枝的语义；当前 Query Compiler 尚未接线，因此这仍是上游契约，而非已完成的端到端保障。D7 的 `human_review` 不阻止只读的 D2 分析，也不意味着动作已获批准。

## 3. 证据提取与校验

`ProblemEvidenceExtractor` 是可替换协议。默认 `AegisLLMProblemEvidenceExtractor` 复用项目配置的 OpenAI Compatible 模型，只标注步骤、类型、原文证据、规格槽位和唯一最终目标，不输出权限、风险或执行结论。

解析层要求严格 JSON、已知字段与六类枚举、1–12 个步骤、恰好一个最终目标。每个证据片段和槽位值都必须逐字出现在 `ScopedProblem.text` 中；多余字段、伪造引文、无效类型或无法解析的结果会变成 `indeterminate`，不默认为求值或单义。槽位只描述问题规格：如优化需要候选空间和评价标准；是否能取得候选数据属于 D3。

## 4. 确定性裁决与输出

服务以唯一最终步骤的类型作为 `primary_kind`，按步骤顺序去重得到 `operations`。例如“查找供应商并选择价格最低者”的主要目标是优化，子操作还包含检索。依赖边和任务图不在此处构造，留给 D4/D5。

每类有明确的必需槽位：求值/检索需要 `target`，判定需要 `predicate`，优化需要 `candidate_space` 与 `criterion`，构造需要 `deliverable`，诊断需要 `phenomenon`。任一步骤缺槽位时，结果保留问题类型，同时给出 `needs_clarification`、`insufficient` 和形如 `step_2.criterion` 的缺失项；全部齐备则为 `classified`、`sufficient`。模型的类型标注仍可能有语义误判；确定性校验解决结构和证据可追溯问题，不等于证明语义正确。

`ProblemClassification` 还输出能力键、原因码、证据以及固定的 `requires_post_plan_recheck=true`。它是未来 Query IR 的一个字段，不是求解结果，也不触发工具。

## 5. 现状与下一步

S18 已实现独立的 D2 模型、LLM 证据提取器、范围门控、裁决器及离线测试。当前没有接入主 Agent 请求链，没有生产样本准确率或在线成本基线。下一步可在可信认证与 Query Compiler 接线后，为六类建立人工标注的开发/测试集，评估语义准确率与“定义不足”的召回率，再与 D3 的信息需求结果联合生成 Query IR。

代码入口：[领域模型](../app/problem_type/models.py)、[证据提取](../app/problem_type/extractor.py)、[分类服务](../app/problem_type/service.py)、[运行时装配](../app/problem_type/runtime.py)。验收记录见 [S18](S18_d2_problem_type.md)。

## D2架构图：


![D2-diagram.png](https://tsy20031016.github.io/eccentric-eclipse/images/projects/aegis-agent/1790656335585-mvb11hdt.png)



## D3 信息闭合性：架构思路

# 1. D3 回答的问题

D2 判断“这类问题怎样求解”，D3 判断“求解所需的信息是否已在输入中；若不在，预计从哪里获取”。D3 **不实际获取数据**，也不保证目录中的数据一定存在、最新或足以回答。它把必要信息拆成逐项 `InformationNeed`，再确定性汇总为：

- `closed_in_input`：所有已识别需求都来自任务本身或已提供的可用正文；
- `retrieval_required`：已识别需要从允许的、目录可定位的来源获取信息；
- `indeterminate`：需求证据、来源、授权范围、连接器或时效要求无法可靠确认；
- `not_applicable`：D8 未放行或 D7 不适用。

信息源类型为 `input_intrinsic`、`input_content`、`private_static`、`private_realtime`、`public_external`、`unknown`。公开外部来源补足了原始四项分类中“查公开网页/汇率”这一空缺。跨系统不是一种单项来源：`cross_system` 表示目录确认了两个以上不同系统；`heterogeneous` 进一步表示这些系统的数据类型或格式不同。每项来源仍保留原始类型。

## 2. 输入边界与先行门控

D3 与 D2 共享 `ScopedProblem`：文本应是上游可信编译器从 D8 已允许的任务分支中剪出的片段，能力键必须属于 D8 允许集合。D3 对照 D7 后果清单核对范围，拒绝使用被剪枝或拒绝的能力。D7 `human_review` 允许继续做只读分类，但不会因此放行工具执行。

`InformationContext` 另携带 `ProvidedContent`：内容 ID 和实际可用正文。`ProvidedContent.from_input_content()` 只接受 S10 已解析且正文非空的 `InputContent`。当前 `InputAttachment` 只有文件名、MIME 等元数据，不能用来证明信息已经提供。上游仍须负责把可供该任务使用的内容筛选后交给 D3；D3 无法仅凭文本校验语义剪枝或内容级授权。Query Compiler 尚未接线，此处是明确的数据契约。

## 3. 模型提取需求，目录核实来源

可替换的 `InformationNeedExtractor` 只输出信息需求 ID、任务原文证据、需求模式、可选正文 ID 或任务原文中的来源线索，以及是否要求当前信息。默认 LLM 适配器复用项目 OpenAI Compatible 配置。解析器要求严格 JSON、1–24 项需求、唯一需求 ID、已知字段、原文中的证据和来源线索；引用的正文 ID 必须确实在 `InformationContext` 中。模型不输出目录存在性、授权结论或连接器可用性。

`SourceCatalogResolver` 是可信元数据目录协议。当前 `StaticSourceCatalogResolver` 从版本化 JSON 装配，按明确别名查候选；D3 再用 D8 的 `RequestedAccess` 校验动作、资源类型、能力键和声明的来源系统。未命中、多个候选、未经授权或目录缺连接器时保持未决。目录版本在一次判定过程中变化也返回未决。示例目录位于 `policies/examples/information_sources.json`：知识库连接器是当前已有的 `search_knowledge`，ERP、CRM 和公开搜索条目故意没有连接器，不能被误报为可直接取数。

## 4. 聚合与时效边界

每个 `ResolvedNeed` 保存来源类型、来源与系统 ID、能力键、输入内容 ID、当前性要求和原因码。只要任一项未决，整体为 `indeterminate`，同时保留其余已确认的需求；全部只需输入时才是 `closed_in_input`，否则为 `retrieval_required`。结果记录来源目录版本、跨系统与异构标记，以及固定的执行前复检要求。

如果任务要求当前数据却只匹配到静态文档，或者只引用了无法证明当前性的上传正文，D3 返回未决。对于实时或公开外部目录条目，D3 只记录当前性要求；真正的数据时间戳、缓存有效期和重取策略由后续获取流程与 D9 决定。模型也可能错误地把缺少的数据标为 `intrinsic`，或者错误地认为一段正文满足需求；结构化校验只能约束证据形式，语义准确率还需标注数据评测。

## 5. 现状与下一步

S19 已完成独立模块、可替换来源目录、严格证据解析、确定性授权/风险范围核对与离线验收。它未接入主 Agent 请求链，不主动访问 RAG、数据库、网页或其他系统；目录中的连接器 ID 也不是数据可用性的运行时证明。下一步应由可信 Query Compiler 提供已剪枝文本和已授权输入内容，再把 D2、D3 结果合入 Query IR；后续检索和 D6 验证才能确定答案是否真正有依据。

代码入口：[模型](../app/information_closure/models.py)、[证据提取](../app/information_closure/extractor.py)、[来源目录](../app/information_closure/catalog.py)、[分类服务](../app/information_closure/service.py)、[装配点](../app/information_closure/runtime.py)。实施记录见 [S19](S19_d3_information_closure.md)。

## D3架构图：


![D3-diagram.png](https://tsy20031016.github.io/eccentric-eclipse/images/projects/aegis-agent/1790659050061-cm6auepo.png)




