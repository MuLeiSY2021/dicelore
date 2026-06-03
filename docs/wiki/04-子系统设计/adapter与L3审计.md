# adapter 与 L3 审计（组件4）

> **本页职责**：定"adapter（Claude Code 接线层）+ 承重 hook + L3 审计"的详细设计——`.claude/` 目录结构、`settings.json`、**hook 脚本（Node 写、跨端；被动 rule 召回 / timer 到期 / L3 审计）**、裁判 subagent、`narrate` 降级实现。这是把 core 装进 Claude Code 的安装层。
> **上游依赖**：[跨agent与适配层](../03-架构/跨agent与适配层.md) 全页（定位重述后：hook 承重、绑 Claude Code）；[总体架构 §4.1 narrate](../03-架构/总体架构.md)、[§5 塑形层](../03-架构/总体架构.md)。
> **状态**：🔴 待填（骨架，2026-06-02）。

---

## 1. adapter 职责边界（待填）

承接 [跨agent §1](../03-架构/跨agent与适配层.md)：注册 MCP / 放置 skill / **配 hook（承重）**。adapter 只接线、不持有教条；v1 只认 Claude Code（[跨agent §4](../03-架构/跨agent与适配层.md)）。

## 2. Claude Code 安装：`.claude/` 结构 + `settings.json`（待填）

承接 [跨agent §4](../03-架构/跨agent与适配层.md)：`.claude/skills/` 放教条、`settings.json` 注册 MCP + 配 hook；由 `anko init` 一键写好（[技术选型 §6.1](../03-架构/技术选型.md)）。`.claude/` 目录结构待定。

## 3. hook 脚本（v1 承重；Node、跨端）（待填）

承接 [跨agent §3](../03-架构/跨agent与适配层.md)，三类承重活：
- **被动 rule 召回**（[内层 §4.4](内层能力库.md)）
- **timer 到期注入**（[内层 §4.2](内层能力库.md)）
- **L3 审计**：掷骰绕过率（抗 F1）、后果-叙事一致性（抗 F2，**回合末 Stop hook** 比对本轮——一个 agent 回合——的 verdict/mutation vs narrate）

> 跨端约束：hook 用 **Node 写、不用 bash**；路径平台感知（[技术选型 §6.1](../03-架构/技术选型.md)）。

## 4. 裁判 subagent 设计（待填）

承接 [跨agent §3](../03-架构/跨agent与适配层.md)：二次纠偏的裁判 subagent，属承重 hook 栈的一环（Claude Code subagent）。

## 5. `narrate` 降级实现（待填）

承接 [总体架构 §4.1](../03-架构/总体架构.md)：把 `narrate` 降级为"直接 talk + 自动捕获写 event"的形态（若某模式不便显式工具调用）。

---

## 本页**不**负责定的

- 工具 / skill 内容本身（schema、教条）→ [MCP 工具面](MCP工具面.md) / [Skills 包](Skills包.md)
- 未来玩家**前端 / GUI**（呈现层，与 adapter 正交）→ 未来（[跨agent §6 轴二](../03-架构/跨agent与适配层.md)）
- 多人论坛安价的远程部署（Streamable HTTP）→ 未来
