---
name: advance-milestone
description: 推进里程碑 / 推一批 / 推进路线图 / 落 feat。自主推进 Dicelore 路线图的下一批工作——分析现状与里程碑的差距、产出 feat、跨包规划、调 superpowers、发 subagent 实现到合 main。完成后落 spec。不提问。
---

# 推进里程碑（advance-milestone）

**主体流程见 [核心闭环 autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md)，本 skill 只定义差异。**

| 维度 | 本 skill 取值 |
|------|--------------|
| 问题从哪来 | `docs/wiki/06-里程碑与问题/路线图.md` 的**下一批** + 三个 backlog 池 |
| 扫描范围 | 全项目（前端 + 后端 + core） |
| 专属关注点 | 现状↔`里程碑.md` 的差距；把差距转成 feat 落池/排批；跨包 DAG |
| 验收口径 | `npm test` + `npm run typecheck`；涉 web 则 `/webapp-testing` |

要点：
- 起手先读路线图第一批（若空，先按优先级从三池编一批）。`里程碑.md` 是过去时、人工维护，**只读不改**——达成节点等人工记。
- core 层的 feat 没有专属 refactor skill，统一经本 skill 推进。
- 收尾沉淀时，达成的大节点提示用户去更新 `里程碑.md`（AI 不自行改）。
