---
title: "D2 · 判定类型的实现过程"
description: "记录 D2 判定类型的设计、实现步骤与验证结果。"
subtitle: "实现记录 · 待撰写"
status: active
section: "decision"
topic: "用户问题十维解构"
order: 210
---

## 1. 设计目的与位置

D2 回答“任务的主要计算目标是什么，目标和必要规格是否足够明确”，位于计划前 D8/D7 之后、D3 信息需求分析之前。

六类目标分别为：
- evaluation：求值与推导；
- retrieval：检索与枚举；
- decision：判定与约束满足；
- optimization：优化与排序；
- construction：构造与规划；
- diagnosis：解释与诊断。

定义不足独立于六类。例如“选最好的供应商”仍属于优化，但缺少评价标准，需要补充规格。

## 2. 输入与可信边界

ScopedProblem 承载获准任务文本和能力键。服务对照 D8 允许集合及 D7 后果记录检查范围。

上游未放行时返回 not_applicable；范围冲突或风险结果无法对应时返回 indeterminate。这些情况不继续调用证据提取器。

任务文本必须由可信上游提供。删除能力键不能证明原文中的越权子任务已经被语义删除；部分允许请求需要明确修订获准任务。

## 3. 提取与确定性裁决

ProblemEvidenceExtractor 提取步骤、类型、原文证据、规格槽位和唯一最终目标。默认模型适配器只进行结构化提取。

解析层限制已知字段、枚举、步骤数量及最终目标数量；证据和槽位值必须来自原文。

服务依据最终步骤确定 primary_kind，按步骤顺序去重形成 operations。必需槽位包括：
- 求值和检索：target；
- 判定：predicate；
- 优化：candidate_space、criterion；
- 构造：deliverable；
- 诊断：phenomenon。

任一步骤缺少必要槽位时，保留已识别类型并返回待澄清。

## 4. 输出契约

ProblemClassification 包含主要类型、子操作、定义充分性、缺失槽位、原文证据、能力范围、原因码和计划后复检要求。

D2 不判断数据是否已经取得，也不生成正式依赖图；这些职责分别属于 D3 和 D4。

## 5. 实现与交付边界

app/problem_type/ 实现模型、提取器、范围检查、分类服务和装配，S18 有 26 条针对性离线用例。

S25 已接入主编译链。严格结构和原文锚定可以发现非法输出，但不能证明语义分类正确；六类准确率和定义不足召回率仍需标注数据评测。

实施记录：[S18](D:/AI_Project/aegis-agent/docs/S18_d2_problem_type.md)。架构图：[D2](D:/AI_Project/aegis-agent/docs/D2_architecture_diagram.md)。