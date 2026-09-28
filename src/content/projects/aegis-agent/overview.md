---
title: "项目说明"
description: "项目说明"
status: "active"
---

<span style="color:#222222;font-size:20px">一.用户问题解构流程：</span>

S1:用户问题十维解构规范（Enterprise Query Decomposition Taxonomy）

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


## 现考虑D1：意图确定性



## D1架构图：

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

1. 位置与职责

D7 位于计划前的 `D1 → D8 → D7 → D2/D3` 顺序中。D1 识别意图，D8 先做粗粒度授权和能力剪枝，D7 只评估 D8 **已允许**的原子能力。它回答“这个动作可能造成多严重、能否恢复、是否需要人工确认”，不回答“主体是否有权限”，也不执行工具。

目前 D8 与 D7 均可独立调用，但 Query Compiler 尚未把它们接成主请求链。`PrePlanRiskService.classify()` 的输入是 D8 的 `PrePlanAuthorization`，输出是 `PrePlanRisk`。

2. 输入如何进入 D7

D8 结果带有 `allowed_capabilities`、`denied_capabilities`、`pruned_capabilities` 和结构化 `AccessClaim`。D7 只用允许清单中的稳定能力键回查 `AccessClaim.requests`，得到动作、资源类型、数据等级等字段。被拒绝或剪枝的能力不参与风险聚合。

若 D8 未放行，D7 返回 `not_applicable`。若允许清单缺失、能力键无法唯一回查，或同一能力同时被允许和拒绝/剪枝，D7 返回 `indeterminate`。这保证了分类不能建立在不完整或互相矛盾的授权结果上。

3. 策略判定与可替换性

`RiskPolicyEvaluator` 是后果策略的唯一调用协议：输入一个 `RequestedAccess`，返回带策略版本、匹配状态、规则 ID、严重度、可恢复性、效果类型及原因码的 `RiskPolicyDecision`。

当前 `StaticRiskPolicyEvaluator` 从 `RISK_POLICY_PATH` 指向的 JSON 后果矩阵装配。规则按动作、资源类型、数据等级匹配；显式字段更多的规则优先。最高特异度仍有多个匹配，或没有规则命中时，结果为未决。策略后端异常、返回非法结构、或同一请求内策略版本改变，也都收敛为 `indeterminate`。

企业将来可以实现同一协议来连接 OPA 或内部策略中心。D7 服务本身不依赖 Rego、OPA API 或网络服务；当前默认实现仍可完全离线运行。

4. 后果评分与聚合

单项后果的预分类分数为 `severity / recoverability`：严重度为 1–4，可恢复性取可逆 `1`、可补偿 `0.5`、不可逆 `0.25`。这是有序的工程分级，不代表事故概率或财务损失。

每项能力分别留下 `Consequence`（能力键、规则 ID、严重度、可恢复性、效果及分数）。只要一项不可逆或分数达到 `8`，整体为 `human_review`；否则有写入或外部效果时为 `reversible_write`，全部为纯读取时为 `read_only`。任何能力未决，整体为 `indeterminate`，已知高风险项的人工确认标记仍保留。

导出属于外部效果：即使操作形式像读取，已披露的数据不能靠撤销本地文件恢复。规则必须显式声明这种后果，服务不会仅凭动作名猜测。

5. 具体动作的待审契约

计划前的 `human_review` 只是一项义务。计划展开后，调用方才能构造 `ProposedAction`：计划 ID、工具调用 ID、能力键、工具名和规范 JSON 参数。`propose_approval()` 只为 D8 已允许且 D7 对**该项能力**明确判为高风险的动作创建 `ApprovalRequest`。

待审请求的 SHA-256 指纹绑定主体、租户、工具及参数、计划与调用 ID、D8 策略和权限快照、D7 后果规则及过期时间。`matches()` 只验证当前待执行动作是否仍是同一待审动作；参数、身份、策略或到期时间变化都会使请求失效。指纹不是签名，也不是“已批准”的证明。对外摘要不包含工具参数正文。

6. 现状与待接入部分

**已实现**：D8 输出到 D7 的数据契约、JSON 风险策略适配器、可替换策略协议、确定性评分与未决语义、具体动作的待审请求和一致性检查。

**待接入**：可信认证边界、Query Compiler 的硬顺序、计划后节点级 D8/D7 复检、审批人身份和批准状态的服务端验证、LangGraph `interrupt()` / `Command(resume=...)`、以及跨重启等待审批所需的持久化 checkpointer。执行节点必须在确认和复检之后才产生副作用。

代码入口：[风险服务](../app/risk/service.py)、[策略协议](../app/risk/protocols.py)、[静态策略适配器](../app/risk/policy.py)、[待审契约](../app/risk/approval.py)。实施与验收记录见 [S16](S16_d7_preplan_risk.md) 和 [S17](S17_d7_policy_approval_contract.md)。

## D7架构图：


![D7-diagram.png](https://tsy20031016.github.io/eccentric-eclipse/images/projects/aegis-agent/1790632079998-p43uxd5y.png)

