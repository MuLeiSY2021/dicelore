---
name: fix-wiki-issues
description: 修 wiki / 修文档问题 / 对齐单源 / 修推导链。自主修复 Dicelore wiki 里的内容问题——推导链断节、单源违例、页职责漂移、设计-实现漂移、过期链接/计数（含 06 里 M1 维护类条目）。完成后落 spec。不提问。
---

# 修复 wiki 问题（fix-wiki-issues）

**主体流程见 [核心闭环 autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md)，本 skill 只定义差异。**

| 维度 | 本 skill 取值 |
|------|--------------|
| 问题从哪来 | wiki 的**内容问题**：推导链断节（上游改了下游没跟）/ 单源违例（一事多处权威）/ 每页一职责漂移 / 设计-实现漂移 / 过期链接·计数（含 `backlog-core.md` 里标 `docs` 的 M1 类条目） |
| 扫描范围 | `docs/wiki/`（多为文档改动 + 少量代码核对） |
| 专属关注点 | 守三硬规矩：**单向推导**（下游只引上游）/ **单源** / **每页一职责** |
| 验收口径 | 链接可达、计数一致、单源无重复的自查通过；若牵动代码核对则补 `npm test` |

要点：
- 区别于 `organize-wiki`（重排结构/层级）——本 skill 修的是**内容正确性**（链断/漂移/重复），不是目录结构。
- 多数 wiki 问题不动代码，第⑤步 worktree+subagent 可按量裁剪；但仍走「②落账→验收→沉淀」的闭环纪律。
- 修完把对应 backlog 条目关闭，必要时在 ADR/设计页留单源。
