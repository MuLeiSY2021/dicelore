---
name: refactor-frontend
description: 整理前端 / 前端重构 / 前端架构优化。自主优化 Dicelore 前端（apps/web）架构——从前端 backlog 取项，梳理组件边界、渲染、路由、i18n、墨金视觉 token。完成后落 spec。不提问。
---

# 整理前端架构（refactor-frontend）

**主体流程见 [核心闭环 autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md)，本 skill 只定义差异。**

| 维度 | 本 skill 取值 |
|------|--------------|
| 问题从哪来 | `docs/wiki/06-里程碑与问题/backlog-前端.md` |
| 扫描范围 | `apps/web` |
| 专属关注点 | 组件边界 / 渲染路径 / 路由 / i18n（硬编码中文走 i18n）/ 墨金视觉 token 一致性 |
| 验收口径 | web 单测 + Playwright e2e，**必须**走 `/webapp-testing`（example-skills:webapp-testing） |

要点：
- 现状差距分析时对照 [玩家客户端视觉/接口设计页](../../../docs/wiki/04-子系统设计/)，别让组件实现与设计页漂移。
- 前端常有「等后端端点上线」的降级逻辑——重构别破坏对未上线契约的降级。
