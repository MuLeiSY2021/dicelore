# CLAUDE.md — Dicelore 工作流程契约

> 本文件**只定"怎么干活与文档怎么流转"**，不解释项目。
> **项目是什么 / 为什么 / 怎么设计** → 全部走 wiki：先读 [`docs/wiki/`](docs/wiki/)（业务→概念→架构→决策→里程碑与问题）。每个 session 起手先看 [`06-里程碑与问题`](docs/wiki/06-里程碑与问题/) 了解现状与欠账。

---

## 文档分工（四处，各一职责，单源不重复）

| 位置 | 职责 | 性质 |
|------|------|------|
| [`docs/wiki/`](docs/wiki/) | **唯一权威知识库**：业务(01)/概念(02)/架构(03)/设计(04)/决策ADR(05)/里程碑(06) | 长存·稳定 |
| [`docs/wiki/06-里程碑与问题/backlog-{前端,后端,core}.md`](docs/wiki/06-里程碑与问题/) | **分层问题池**：所有未解决「欠账」按层(前端/后端/core)×类型(fix/feat)归类、去重、聚类成主题 | 长存·直到解决 |
| [`docs/wiki/06-里程碑与问题/路线图.md`](docs/wiki/06-里程碑与问题/路线图.md) | **有序批次**：从三池挑出来排「先做哪批」(第一批/第二批…) | **AI 维护**·可重排 |
| [`docs/wiki/06-里程碑与问题/里程碑.md`](docs/wiki/06-里程碑与问题/里程碑.md) | 已达成节点时间线 | **人工维护·AI 不得自行改动**（仅在人明确指导下编辑） |
| [`docs/todo/`](docs/todo/) | **在途交接**：本 session 做不完 / 下一 part 的活，指回 backlog 条目 | 临时·解决即删 |
| [`docs/superpowers/{specs,plans}`](docs/superpowers/) | superpowers 流程的草稿产物（spec / plan） | 临时·用完即删 |

---

## 问题生命周期（核心流程）

```
① 提出 / 接收问题
      └──> 落对应 backlog 池 docs/wiki/06.../backlog-<层>.md（带字段：类型fix|feat·来源·是否随规模恶化·主题·下一步）
           ——散点子批量归类 + 编排路线图，用 /groom-backlog

② 着手解决
   ├─ 本 session 能完结 → 直接做
   ├─ 本 session 完不成 / 属下一 part → 写 docs/todo/ 交接（指回 backlog 条目）
   └─ 需设计或多步实现 → 走 superpowers（见下「执行模型」）

③ 解决完毕（以下都要做，缺一不可）
   1. 验证：代码过 `npm test` + `npm run typecheck`；**web 端改动用 `/webapp-testing` 测过**才算完成
   2. 沉淀进 wiki：决策→05-ADR / 设计→04 页 / 概念·架构→02·03 / 达成节点→06-里程碑（人工）
   3. 关闭 backlog 条目：标 `→ ADR-00xx` 或直接删；路线图勾掉该批（别留已解决的占位）
   4. 若来自 todo  → 删掉那份 docs/todo/ 文件
   5. 若来自 superpowers → 删掉那份 docs/superpowers/ spec/plan。**硬前提：必须先确认其知识已沉淀进 wiki（步骤 2）才能删——沉淀在前、删除在后，缺沉淀不得删。** 多步实现（plan 拆成 P1/P2…多份）只完成一部分时，**整套 spec/plan 留着别删**，直到全部落地 + 沉淀 wiki 才统一清场。
   6. **commit**（问题解决完即提交；若在默认分支 main 上先开分支）
```

> **删 superpowers 草稿的铁律**：plan/spec 是"知识的临时载体"，删它前必须确认知识已搬进 wiki（永久权威）。**没沉淀就删 = 丢知识**。顺序永远是「沉淀 wiki → 才清 superpowers」；半途的多份 plan 一律留到全套完成。

**口诀**：问题进 backlog 池（/groom-backlog 归类 + 排路线图）→ 在途进 todo / 草稿进 superpowers → 解决后**验证 → 沉淀进 wiki → 三处清场（backlog 条目 / todo / superpowers）→ commit**。**别让已完成的东西占位置；但没沉淀进 wiki 前，superpowers 草稿不许删。**

---

## 执行模型（来自 superpowers 的活）

需要设计或多步实现时，走 superpowers 流程，**写完 plan 后按 DAG 并发 subagent 执行**：

1. `brainstorming`（若需求/方案未定）→ 落 spec。
2. `writing-plans` → 落 plan（`docs/superpowers/plans/`）。
3. **plan → DAG**：把任务拆成依赖图，无依赖的并发派 subagent（`subagent-driven-development` / `dispatching-parallel-agents`），按波次推进。
4. 执行完 → 回到「问题生命周期 ③」：**先沉淀 wiki**，确认后才删 superpowers spec/plan + 关总账条目 + 删对应 todo。**多份 plan 只完成一部分时不删，全套落地 + 沉淀后统一清。**

> **并行隔离（硬性）**：多条线 / 多 agent 并行干活时，**每条线开自己的 git worktree**（`using-git-worktrees` / `EnterWorktree`），别都挤在主工作目录。否则各线的未提交改动在同一工作树里互相串味、提交得逐文件 scoped add 才不带错、对账极痛（教训：组件7 线与数据层线同目录交错跑过一次）。同一条 `subagent-driven-development` 链内的串行 subagent 共用一个工作树即可（它们不并发）；要隔离的是**并行的线 / 会话**。

---

## 本项目专属工作流 skill（`.claude/skills/`，已入 git）

把上面这套流程契约**固化成可直接 `/skill` 调用的流程**，免去每次复述散文。这 8 个是 **Dicelore 专属**、随仓库走（换机器/协作者共享）。起手挑对应的调：

| skill | 固化了本契约哪一步 | 何时调 |
|-------|-------------------|--------|
| `autonomous-delivery-loop` | 执行模型 a→g 全流程（核心，下面 4 个叶 skill 共用骨架） | 自主推进一批目标、不提问做到底 |
| `advance-milestone` | ①现状差距→②落 backlog→③DAG→④spec/plan→执行模型 | 推进里程碑 / 路线图下一批 |
| `fix-wiki-issues` | 同上，问题源 = wiki 内容问题 | 修 wiki 推导链断节/单源违例/页职责漂移/设计-实现漂移 |
| `refactor-frontend` | 执行模型（范围 `apps/web`） | 整理前端架构、优化 |
| `refactor-backend` | 执行模型（范围 `apps/orchestrator`） | 整理后端架构、优化 |
| `organize-wiki` | 三硬规矩 + wiki 维护 | 重排/扩张 wiki 结构层级（纯文档，不走闭环） |
| `groom-backlog` | 问题生命周期① + 去重聚类排序 | 散点子归类落三池 + 编排路线图 |
| `spec-to-wiki` | 问题生命周期③.2/.5（沉淀 + 清场） | superpowers spec/plan 知识搬进 wiki |

> 维护：新增/改流程契约时，同步改对应 skill 的 `SKILL.md`（单源——契约散文与 skill 别两处分叉）。

---

## 几条硬规矩（沿用 wiki [README](docs/wiki/README.md) 的「缜密」三规）

- **单向推导**：wiki 下游页只引用上游页（架构引业务，不反向）。要改上游才回头改下游。
- **单源**：一件事只在一处是权威。问题账只在 06；决策只在 ADR；设计只在对应页。别在多处复制，要么链接、要么沉淀。
- **CLAUDE.md 不解释项目**：任何"它是什么 / 为什么这么设计"的问题，答案在 wiki，不写进这里。
