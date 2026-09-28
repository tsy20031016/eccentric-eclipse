---
title: "Aegis Agent — 企业级 Agent 执行系统"
description: "Aegis Agent — 企业级 Agent 执行系统"
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


现考虑D1：意图确定性

D1架构图：
![System Architecture Diagram For intent Determinism Detection.png](https://tsy20031016.github.io/eccentric-eclipse/images/projects/aegis-agent/1790589069822-w7r2ub09.png)

考虑D8：

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