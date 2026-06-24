# 工作流 skill 套件 + 06 路线图重构 — 设计

> **本 spec 职责**：定义一套项目专属 skill（放 `.claude/skills/`），把 CLAUDE.md 的工作流契约固化成可调用的流程；同时把 06 的扁平「问题总账」升级为「AI 维护的路线图 + 分层 backlog 三池」。
> **状态**：草稿，待实现。完成后知识沉淀进 wiki（06 README / CLAUDE.md 契约段），本 spec 即删。

---

## 1. 背景与目标

当前 CLAUDE.md 用散文描述了完整工作流（问题生命周期、执行模型、硬规矩），但每次都要人脑复述、容易漏步。目标是把高频工作流固化成 8 个可 `/skill` 调用的流程，并顺带修一处结构债：**`问题总账.md` 是单一扁平账，混杂前端/后端/core 三个层面的问题，缺少「下一批先做什么」的有序编排**。

两件事一起做：
- **A. 8 个工作流 skill**（一核多叶 + 文档流转）。
- **B. 06 重构**：扁平问题总账 → **路线图（AI 维护，有序批次）+ 三个分层 backlog 池（前端/后端/core，无序广度）**。

### 层定义（三池据此分类）
| 层 | 对应代码 | 关注 |
|----|----------|------|
| 前端 | `apps/web` | 组件 / 渲染 / 路由 / i18n / 视觉 |
| 后端 | `apps/orchestrator` | HTTP/WS 接口 / 会话生命周期 / 进程编排 |
| core | `packages/core`（+ `packages/shared`） | 引擎 / 数据层 / MCP 工具面 / gm-core / 团本构建 / eval harness |

---

## 2. Skill 清单（8 个，一核多叶）

```
.claude/skills/
├── autonomous-delivery-loop/   ★核心闭环（被引用，也可单独跑）
├── advance-milestone/          推进里程碑   → require 核心
├── fix-wiki-issues/            修复 wiki 问题 → require 核心
├── refactor-frontend/          整理前端架构  → require 核心
├── refactor-backend/           整理后端架构  → require 核心
├── organize-wiki/              整理 wiki 结构层级（纯文档重构，不走闭环）
├── groom-backlog/              点子归类 + 路线图编排（轻量，落 06）
└── spec-to-wiki/               spec 沉淀进 wiki + 清 superpowers（轻量）
```

依赖关系：4 个叶 skill 正文 `require` 核心 skill，只写**差异点**（问题从哪来 / 扫描范围 / 专属关注点 / 验收口径）。3 个文档流转 skill 独立、不发 subagent。

### 命名与文件格式约定
- 目录 slug 用英文 kebab-case；每个 skill 一个 `SKILL.md`，YAML frontmatter：`name`（= slug）、`description`（**中文富触发词**，覆盖用户会说的话，如「推进里程碑/推一批/落feat」）。
- 正文用中文，结构：`## 何时用` → `## 流程`（带 checklist / DAG）→ `## 硬约束`。
- 叶 skill 引用核心：正文写「**主体流程见 `autonomous-delivery-loop`，本 skill 只定义差异**」，并用相对路径 `[核心闭环](../autonomous-delivery-loop/SKILL.md)` 指过去。

---

## 3. 核心 skill：`autonomous-delivery-loop`

承载 CLAUDE.md「执行模型」+「问题生命周期」的通用 a→g 自主骨架。**默认不向用户提问**（叶 skill 可覆盖此默认）。

**输入**：一批已锚定的目标（来自路线图某批 / 某层 backlog / 某组 wiki 问题）。
**流程（a→g）**：
1. **现状↔目标差距分析**：读相关 wiki（必读 06）+ 代码，列出 gap。
2. **落 06**：把 gap 写进对应 backlog 池（带字段 `层·类型(fix/feat)·来源·是否随规模恶化·主题·下一步`）；必要时编进路线图当前批。
3. **规划 DAG**：分析涉及哪些包（前端/后端/core），把任务拆成依赖图，标出可并发的波次。
4. **调 superpowers 落 spec/plan，不提问**：需设计 → `brainstorming`（自答，不向用户提问）落 spec；→ `writing-plans` 落 plan。纯机械改名按 [机械改名用正则] 经验跳过 heavy SDD。
5. **切 worktree + 发 subagent**：从 main 切 worktree（`using-git-worktrees`，每条并行线一个 worktree）；按 DAG 波次派 subagent（`subagent-driven-development` / `dispatching-parallel-agents`）批量实现。
6. **回收 + 设计测试**：subagent 回收后，**另起 subagent 从业务角度设计测试方案**（不是只跑现有测试，而是按这批 feat 的业务语义补测）。
7. **验收**：`npm test` + `npm run typecheck`；web 改动走 `/webapp-testing`。
   - **有问题 → 回步骤 2**（gap 重新入账，再来一轮）。
   - **通过 → 收尾**：沉淀 wiki（决策→ADR / 设计→04 / 概念架构→02·03）→ 三处清场（关 backlog 条目/路线图勾掉该批 / 删 todo / 沉淀确认后删 superpowers 草稿）→ 合回 main（先 merge worktree 分支）。

**硬约束**：
- 并行隔离：多条线各自 worktree，别挤主工作目录（[worktree npm lock 坑] 注意 scoped add）。
- 删 superpowers 草稿铁律：先沉淀 wiki 才删；多份 plan 半途不删。
- git 命令一律 `--no-pager`。
- 自验证后才声明完成（`verification-before-completion`）。

---

## 4. 四个叶 skill（差异点）

| skill | 问题从哪来 | 扫描范围 | 专属关注点 | 验收口径 |
|-------|-----------|----------|-----------|----------|
| `advance-milestone` | `06/路线图.md` 下一批 + 三池 | 全项目 | 现状↔里程碑差距、产出 feat、跨包 DAG | npm test + typecheck（+web 则 webapp-testing） |
| `fix-wiki-issues` | wiki 推导链断节 / 单源违例 / 页职责漂移（含 M1 类） | `docs/wiki` | 单向推导、单源、每页一职责；多为文档+少量代码核对 | 链接/计数/单源自查通过；涉代码改动则加 test |
| `refactor-frontend` | `06/backlog-前端.md` | `apps/web` | 组件边界 / 渲染 / 路由 / i18n / 墨金 token | web 单测 + Playwright e2e（webapp-testing） |
| `refactor-backend` | `06/backlog-后端.md` | `apps/orchestrator` | 包边界 / HTTP·WS 接口契约 / 会话生命周期 | npm test + typecheck |

> core 层 backlog 没有专属 refactor skill —— core 的 fix/feat 经 `advance-milestone` 编入路线图推进。

每个叶 skill 的 `SKILL.md` 极短：一句「主体见核心闭环」+ 上表对应行的差异说明 + frontmatter 富触发词。

---

## 5. 三个文档流转 skill（轻量，不发 subagent）

### `organize-wiki` — 整理 wiki 结构层级
重排/扩张 wiki 层级，使其守三硬规矩：单向推导（下游只引上游）、单源、每页一职责。流程：通读 `docs/wiki` → 找冗余/过期/交叉错位/层级失衡 → 重组（拆页/并页/调目录/补 README 索引）→ 修链接与计数。**不走闭环、不动代码**。完成后无需 spec（维护性）。

### `groom-backlog` — 点子归类 + 路线图编排（升级自 idea-to-backlog）
**输入**：用户抛来的一堆散点子。
**流程**：
1. 逐条判定 `{层: 前端|后端|core, 类型: fix|feat}`。
2. 落进对应 `backlog-<层>.md` 池：补全字段（来源/是否随规模恶化/主题/下一步）、与既有条目**去重聚类**（N 个症状常是 1 个决策）。
3. **编排路线图**：视优先级（反复出现 + 随规模恶化 = 最高）把条目编进/重排 `路线图.md` 的批次。
**硬约束**：路线图由 AI 维护、可重排；里程碑.md 人工维护、AI 不动。

### `spec-to-wiki` — spec 沉淀 + 清场
把 superpowers spec/plan 的知识搬进 wiki（决策→05-ADR / 设计→04 / 概念·架构→02·03 / 达成节点→06-里程碑由人工）。**铁律**：先确认知识已沉淀进 wiki，才删 superpowers 草稿；多份 plan 只完成一部分时整套留着不删。

---

## 6. 06 重构：路线图 + 三池

### 目标结构
```
06-里程碑与问题/
├── README.md          更新：索引指向路线图 + 三池（去掉「唯一问题总账」表述）
├── 里程碑.md          已达成节点时间线（过去时，人工维护，AI 不动）── 不变
├── 路线图.md     ★NEW 未来批次（AI 维护，有序）：第一批 / 第二批 …
├── backlog-前端.md ★NEW 前端 issue 池（每条 fix|feat）
├── backlog-后端.md ★NEW 后端 issue 池（每条 fix|feat）
└── backlog-core.md ★NEW core issue 池（每条 fix|feat）
   （问题总账.md 内容按层/主题拆解迁移进上述文件后删除）
```

### 两层语义
- **backlog 池**：散点子归类沉淀地，按 `层 × fix/feat` 分类、按**主题**聚类、去重。**广度、无序**。保留现总账的富度（主题/恶化标记/ADR 交叉引用/状态图例）。
- **路线图**：从三池挑条目排**有序批次**——「第一批：修 A/B bug + 提 C feat；第二批：…」。现总账末尾的「排序总结（先还哪个）」即路线图雏形。

### 迁移映射（现总账 → 目标）
| 现内容 | 去向 |
|--------|------|
| 主题F（eval harness 真实性 F1/F2） | backlog-core（主题：eval harness） |
| 主题A / A′（运行时叙事脚手架、数据层重构 A1–A6） | backlog-core（主题：叙事脚手架） |
| P3（裁决/披露/终局 B7/C1/E1/E2） | backlog-core（主题：裁决引擎） |
| 主题H（团本构建台 组件5/6） | backlog-后端（主题：团本构建） |
| 主题G 后端 gap（Play 会话生命周期 / 缺端点） | backlog-后端（主题：组件7 后端） |
| 主题G 前端 fast-follow（i18n / UI / 动效） | backlog-前端（主题：组件7 前端） |
| M1（wiki 整理） | backlog-core 标 `docs`（实际由 `organize-wiki` 处理） |
| P5 未来池 | 按层散入三池，统一标 `🔮 未来池`（不进路线图当前批） |
| P0 已清账 | 不迁（已闭，留里程碑由人工） |
| 末尾「排序总结」 | → 路线图.md 初始批次 |

### 迁移执行
**现在做**，起 subagent：派 subagent 通读 `问题总账.md`，按上表拆解生成三个 backlog 池 + 路线图初稿，**保真**（不丢字段、不丢 ADR 交叉引用、不丢恶化标记），人工/主线 review 后删 `问题总账.md`、更新 `06/README.md`。

---

## 7. 契约文档更新（单源同步）

重构后这些「权威表述」必须同步改，否则推导链断节：
- **CLAUDE.md**：
  - 「文档分工」表里 `问题总账.md` 行 → 改为「路线图 + 三池」；「问题生命周期」中所有「落问题总账」措辞 → 「落对应 backlog 池 / 编路线图」。
  - **新增一节「本项目专属工作流 skill」**：说清这 8 个 skill 是 Dicelore 专属、放 `.claude/skills/`、已入 git；给一张表「skill → 它固化了 CLAUDE.md 哪一步 → 何时调」，让人/AI 起手就知道有哪些流程可直接 `/skill` 调用，而非每次复述散文。
- **`06/README.md`**：子页表 + 「怎么用这一节」改为三池 + 路线图模型。
- **`wiki/README.md`**：06 行描述同步（如有「唯一问题账」措辞）。

这步属问题生命周期③.2「沉淀进 wiki」，是本轮收尾硬前提。

### Skill 入 git
- `.claude/skills/` **提交进仓库**（团队/换机器共享这套工作流）。
- `.claude/settings.local.json` 与 `.claude/worktrees/` **不提交**：新增/补 `.gitignore` 条目排除（仓库当前无 `.claude` 相关 ignore 条目）。
- 提交点：实现完、自检通过后，按问题生命周期⑥在分支上 commit；spec 本身也随首个 commit 入库。

---

## 8. 实现拆分（DAG / 波次）

```
波次1（并行，互不依赖）：
  ├─ T-mig：06 迁移（subagent 通读总账 → 三池 + 路线图初稿）   ［产出 06 新结构］
  └─ T-core：autonomous-delivery-loop/SKILL.md                ［叶 skill 的依赖］

波次2（依赖波次1）：
  ├─ T-leaf：4 个叶 skill（依赖 T-core 定稿；引用其相对路径）
  ├─ T-doc：3 个文档流转 skill（groom-backlog 依赖 T-mig 的三池结构）
  └─ T-contract：更新 CLAUDE.md / 06 README / wiki README（依赖 T-mig 定稿）

波次3：
  └─ T-verify：通读 8 个 SKILL.md 自洽性（交叉引用路径对、frontmatter 合法、触发词不撞车）+ 人工 review 06 迁移保真
```

并行线各开 worktree（若并发跑）；本套多为文档写作、可在主线串行 subagent 完成，**唯 T-mig 按用户要求起 subagent**。

---

## 9. 测试 / 验收

skill 本身是 markdown，无单测。验收口径：
1. **迁移保真**：三池 + 路线图覆盖原总账全部活跃条目（F/A/A′/B7/C1/E/G/H/P5），无丢字段、无丢 ADR 交叉引用；`问题总账.md` 已删、`06/README.md` 已更新。
2. **skill 自洽**：8 个 `SKILL.md` frontmatter 合法、`name`=slug、叶 skill 相对路径引用可达、触发词覆盖用户中文说法且不互相抢。
3. **契约同步**：CLAUDE.md / 两个 README 无「唯一问题总账」遗留措辞；CLAUDE.md 含「专属工作流 skill」表（8 行，skill→步骤→何时调）。
4. **入 git**：`.claude/skills/` 已 `git add`、`settings.local.json`+`worktrees/` 已被 `.gitignore` 排除（`git status` 验证）。
5. **冒烟**：`/groom-backlog` 给一个测试点子能正确归类落池；`/advance-milestone` 能读到路线图第一批。

---

## 10. 范围外（YAGNI）
- 不做 `refactor-core` skill（core 走 advance-milestone）。
- 不做 skill 的自动化测试框架（markdown 流程文档）。
- 不动 `里程碑.md`（人工维护）。
- 不引入路线图的工具化看板（纯 markdown 有序列表足够）。
