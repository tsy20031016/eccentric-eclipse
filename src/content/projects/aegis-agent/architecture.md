---
title: "系统架构"
description: "系统架构"
status: "active"
---

## 架构目标

架构将模型的规划能力与具有副作用的执行能力分离。模型提出计划或工具参数；策略层负责授权与风险判断；受控执行层调用工具；验证和审计组件检查并记录结果。模型输出本身不应被视为授权，也不应直接绕过策略层触达外部系统。

## 逻辑组件

1. 交互与接入域
英文：Experience & Access

2. 理解与决策域
英文：Understanding & Decision

3. Agent 执行核心
英文：Agent Runtime

4. 能力与数据服务域
英文：Capabilities & Data Services

5. 可观测与质量域
英文：Observability & Quality

6. 学习与优化域
英文：Learning & Optimization

7. 共享基础平台
英文：Shared Foundation