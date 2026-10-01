---
title: "系统架构"
description: "系统架构"
status: "active"
subtitle: "七大系统架构域与模块职责"
section: foundation
order: 30
---

## 架构目标

架构将模型的规划能力与具有副作用的执行能力分离。模型提出计划或工具参数；策略层负责授权与风险判断；受控执行层调用工具；验证和审计组件检查并记录结果。模型输出本身不应被视为授权，也不应直接绕过策略层触达外部系统。

## 逻辑组件

交互与接入域 英文：Experience & Access
理解与决策域 英文：Understanding & Decision
Agent 执行核心 英文：Agent Runtime
能力与数据服务域 英文：Capabilities & Data Services
可观测与质量域 英文：Observability & Quality
学习与优化域 英文：Learning & Optimization
共享基础平台 英文：Shared Foundation

## 交互与接入域 — Experience & Access

对应 frontend/、app/main.py、app/schemas.py、app/input/。负责交互、HTTP 契约、输入识别与标准化，以及可信身份的接入。
边界：识别“用户给了什么”；任务意图、业务权限交给后续模块。

## 理解、决策与规划域 — Understanding, Decision & Planning

建议补上 Planning，因为现有代码已经包括任务结构、验证计划、时间约束和执行形态。
对应 intent_certainty/、problem_type/、information_closure/、task_structure/，以及 verification/、temporal/、execution_shape/ 中的规划职责。QueryCompiler 负责串联这些分析并产出 QueryIR。
边界：回答“要做什么、缺什么、能否做、准备怎么做”，产出计划或明确的未决状态。

## Agent 执行核心 — Agent Runtime

对应 AgentService、LangGraph、QueryOrchestrator、QueryExecutor 和执行门。负责状态推进、模型与工具调用、循环保护、执行前复检和结果返回。
边界：负责推动流程，分析算法和权限规则保留在各自服务中。现有 app/orchestration/、app/query_compiler/ 同时包含多种职责，需要按类或功能归属，不能整包机械划分。

## 能力与数据服务域 — Capabilities & Data Services

对应 tools/、rag/、memory/。提供工具注册与调用、知识检索、长期记忆和数据访问。
边界：长期记忆属于数据服务；会话历史恢复、checkpointer 的使用属于 Runtime。

## 可观测与质量域 — Observability & Quality

对应 observability/、evaluation/、测试与质量检查流程。负责记录运行事实、评估结果、发现回归。
边界：D6 的“本次任务应该如何验证”属于规划；验证动作由 Runtime 调度；跨运行的质量评测属于本域。

## 学习与优化域 — Learning & Optimization

对应 learning/。从历史运行与评测产物中提取统计规律，预测策略表现并生成优化建议。
保留现有设计：建议不自动生效。后续若要应用优化，需要明确的发布、验证和回滚机制。

## 共享基础与治理域 — Shared Foundation & Governance

建议补上 Governance，突出 Aegis 已有的权限、风险和审批能力。
对应 config.py、llm.py，以及 authorization/、risk/ 中的主体、策略和裁决服务。
边界：本域提供治理规则与服务；理解规划域在计划前调用，Runtime 在真正执行前再次调用。





## Remind：

最重要的优化是把“模块归属”和“调用位置”分开。 权限服务可以归属共享治理，同时参与计划前裁决与执行前复检；不需要因此复制到两个域。类似地，验证计划、验证执行、质量评测也应分别归属。

展示架构时，建议把 1 → 2 → 3 → 4 作为请求处理主链，5、6、7 作为贯穿或反馈支撑。七块之间存在回路和横向依赖，不宜画成严格的七层堆叠。

当前最适合先更新架构文档和模块职责说明，保留现有目录。尤其 现有架构文档 虽然注明了 S25，总览图中仍有“未来 Query Compiler 接线”的旧表达，应优先统一。目录迁移可以作为之后单独确认的阶段。






