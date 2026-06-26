# NPC 一等抽象（A1）—— 设计

> 第二批头号债（主题A/A′）的剩余项。npc 视图（读侧①）已投影，但 **npc 专属类型化写工具未声明**，且无任何生产写路径能落 `kind='npc'` 行。本 spec 把 state 的 `npc` kind 升为运行时一等抽象：声明 npc 专属类型化写工具，走与叙事八工具同一套声明式生成范式（守 DT-9）。

## 0. 上游锚点（单向推导）

- 设计意图：[运行时数据层重构-叙事层 §4/§7](2026-06-21-运行时数据层重构-叙事层-design.md) L65（npc 视图＝A1）、L81（**写 `npc_update`——kind 由工具名携带，调 `npc_update` 即写 kind=npc，薄包装 `applyMutations`**）、D-4（player 独立于 npc＝能动性归属）、D-5（派系=npc 实体）。
- 范式锚点：[声明式工具生成层 §DT-9](2026-06-22-声明式工具生成层-design.md) L74（npc_update 踩同一守卫写路径）、L123（`UPDATE <state视图/kind表> SET attr ±/= :p WHERE entity=:e` → `applyMutations`）、L199（DT-9 数据层固定、团本在其上新建声明）。
- 现状实证：[backlog-core 主题A · A1](../../wiki/06-里程碑与问题/backlog-core.md) L62、路线图 L37（npc 视图已投影、专属业务工具未声明）。

## 1. 问题（一句话）

`npc` 视图（`SELECT … FROM state WHERE kind='npc'`）作为读侧**已投影**，但：

1. **无 npc 专属写工具**——GM 给 NPC 起/改属性只能走 kind 无关的裸 `sheet_update`，写出的行 `kind` 取 schema 默认 `'world'`，**永远进不了 npc 视图**。
2. **`kind` 列在生产路径上是死列**——`stateSet`/`applyMutations` 从不写 `kind`（`views.test.ts` L17 注释明示「stateSet 不接 kind 参数，直接 INSERT 造 npc 行」＝测试侧才能造 npc 行）。

所以 npc「一等」只在纸面：读侧视图就位、写侧无入口、kind 无人填。**A1 的真缺口 = 一条能落 `kind='npc'` 的声明式写路径 + 一组 npc 类型化工具。**

## 2. 目标 / 非目标

**目标**
- 声明 npc 专属类型化写工具（`npc_update` / `npc_register`），调用即落 `kind='npc'` 行，使 npc 视图可读到。
- 走与叙事八工具同一套声明式生成范式（ToolDecl → `toolgenToToolDef` → `extraTools` 注入），**不新增硬编码 MCP handler**（守 DT-9）。
- npc 写仍踩在正典写原语 `applyMutations` 守卫路径上（落 mutation event + 触发 watcher，与 `sheet_update` 同墙）。

**非目标（正交，明确不做）**
- **A6 NPC 双层值裁决侧**——双层值的*存储*靠 per-attr `visible`（已支持），裁决侧（`resolve_contest` 表演叫价 vs 真实底线）正交，留 resolver spec。本 spec 只做读写，不碰裁决。
- **npc 关系入 anchor 边表**——D-5 说「派系=npc 实体、关系挂持有者」；关系本身走 `relation` 视图（`rel_*` 行形态），**不在本 spec 引入 anchor 边表**（那是承重设计，见 §6 不可逆清单）。
- **player_update / world_update**——同形姊妹工具，本线只交付 npc（A1）；player/world 类型化写可后续按同范式平推（非本线 owns）。
- **删除裸 `sheet_update`**——上游 spec 说「替代品就位后删」，但删工具牵动 orchestrator/前端调用面，超出本线 owns，记 backlog 不在此删。

## 3. 范式复用：npc 写工具怎么声明

叙事八工具的范式：`ToolDecl[]`（name/desc/params/sql）→ `narrationStdlibTools()` 用 `toolgenToToolDef` 编译 → `createMcpServer(db, deps, extraTools)` 注入。npc 工具**完全复用**，新建 `mcp/stdlib/npc.ts` 与 `narration.ts` 平行。

### 3.1 工具集（brainstorm 收敛）

| 工具 | 语义 | 声明 SQL（pattern） | 落库路径 |
|------|------|--------------------|---------|
| `npc_update` | 给某 NPC 批量改/起属性（扣好感、起 HP、赋身份） | `UPDATE state SET <attr> = <attr> ±/= :p WHERE entity = :npc`（mutate 模式） | `applyMutations`（落 event/触发 watcher） |
| `npc_register` | 显式登记一个 NPC（起名+首属性，确保 kind=npc 落地） | 同 mutate（`UPDATE state SET 简介 = :desc WHERE entity = :npc`） | `applyMutations` |

**收敛理由**：
- **粒度＝薄**。npc 的运行时操作本质就是「按 kind 写 state 行」，与 `sheet_update` 同形，差别只在 **kind 由工具名携带**（上游 L81 原话）。无须 `npc_open/advance/close` 状态机——NPC 不是叙事脚手架（front/plotline/foreshadow 才有 open→close 生命周期），NPC 是**实体**，其「状态」就是属性集合，没有独立 status 机。
- **`npc_register` 是否单列**？收敛为**单列**——`npc_update` 语义是「改已有 NPC」，`npc_register` 语义是「这是个新 NPC」，两者 SQL 同形但**语义边界对 GM 有提示价值**（教 GM 先 register 再 update，npc 视图才有干净的「登记过的 NPC」集合）。代价仅一条声明，零框架成本。可逆——若后续觉得冗余，删一条声明即可。

### 3.2 为什么不是 INSERT/setStatus 模式

- `INSERT` 模式：`matchWrite.INSERT_RE` + `NARRATIVE_TABLES` 白名单**只认 `front|plotline|foreshadow`**，`state` 被拒。且 INSERT 走 `frontUpsert` 这类叙事表 upsert，与 state 行无关。
- `setStatus` 模式：同样限叙事表，且 NPC 无 status 机。
- **`mutate` 模式是唯一不限表的写模式**（`matchMutate` 不查 `NARRATIVE_TABLES`），且编译目标正是 `applyMutations`——**与上游 L123 钦定的 npc 写路径精确吻合**。故 npc 工具全用 mutate 模式。

## 4. 拱心石：mutate 怎么落 `kind='npc'`（DT-9 边界的关键裁断）

**问题**：mutate 模式编译为 `applyMutations(db, entity, muts)`，而 `applyMutations`→`stateSet` **从不写 kind**（→ 默认 `'world'`）。声明 `npc_update` 后，写出的行仍是 `kind='world'`，进不了 npc 视图。**纯加声明不够。**

**裁断（守 DT-9 的解法）**：DT-9 契约的准确措辞是「不新增**硬编码 MCP handler**；新工具＝新声明」（toolgen spec L74/L199）。区分两类改动：

| 改动 | 是否破 DT-9 | 本 spec 取舍 |
|------|:--:|------|
| 新增一个 npc 专属 MCP handler 函数（如 `npcUpdateHandler`） | **破**（正是 DT-9 禁的硬编码 handler） | ❌ 不做 |
| 给**正典写原语** `applyMutations`/`stateSet` 增可选 `kind` 参数（store 地基层） | **不破**——`applyMutations` 是「内部正典写函数、非 AI 直调工具」（spec L74 原话），是地基不是 handler；threading kind 是 store 原语能力补齐 | ✅ 做 |
| 给 mutate plan + writeTool 让 `kind` 能从声明里传到 `applyMutations` | **不破**——这是声明式引擎**表达力补齐**（让 mutate 能携带 kind），属 toolgen 引擎能力，不是 per-tool handler | ✅ 做（见下「天花板」） |

**承重墙仍不破**：npc 写不裸跑 SQL，仍经 `applyMutations`（落 event + 触发 watcher + 事务），与 `sheet_update` 同一守卫路径。

### 4.1 撞到的天花板（必须如实上报）

让 mutate 模式声明能携带 `kind='npc'`，**纯加 `stdlib/npc.ts` 声明做不到**——`matchWrite`/`writeTool` 的 mutate 路径目前不解析、不透传 kind。最小改动二选一：

- **方案 A（声明里嵌 kind 字面量）**：扩 mutate 模式识别 `UPDATE state SET kind='npc', <attr>…`——但 `kind='npc'` 是常量赋值不是 `:param`，`ASSIGN_DIRECT_RE` 不认常量右值。需扩写匹配器 + writeTool。**改 toolgen 引擎**。
- **方案 B（声明外带 kind 标注）**：给 `ToolDecl` 加可选 `kind?: StateKind` 字段，mutate 编译时透传给 `applyMutations(db, entity, muts, { kind })`，`applyMutations`/`stateSet` 增可选 kind 参数（默认行为不变）。**改 toolgen writeTool + store 原语**，但 `stdlib/npc.ts` 仍是纯声明，引擎改动是**一次性表达力补齐**（任何 kind 化写工具复用，player/world 平推免费）。

**采方案 B**。理由：A 把 kind 编进 SQL 字符串，污染「SQL 即正典原语映射」的干净性，且常量右值解析是特例；B 把 kind 作为声明的**结构化元数据**，与 `params` 同级，编译期透传，语义清晰、可复用、默认零影响。

**这是否破 DT-9？——不破，但撞到了「v1 mutate 模式不支持 kind 写」的 DSL 表达力天花板**，性质同 `front_advance` 撞 JOIN 天花板（spec §8 预言）。区别：front_advance 撞的是「跨表 JOIN」结构天花板（v1 不解，留 backlog）；npc kind 撞的是「mutate 写 kind 列」表达力缺口，**一次性补齐引擎即解，且 player/world 类型化写都受益**——属「graduation 通道」（toolgen spec L161：某 pattern 反复出现 → 提拔进框架核心）的正当扩展，不是 per-tool hack。

> **关键结论**：A1「框架 core handler 零改动」**守住**（无新 MCP handler，npc 工具全声明）；但**toolgen 引擎 + store 原语需一次性表达力补齐**（mutate 携带 kind）。这不是「新 handler」，是「让声明式引擎能表达 kind 化写」——是 DT-9 数据层固定地基的合理生长，不是绕过声明的硬编码。若编排者认为「引擎零改动」是更严的红线，则 A1 在 v1 不可达，须先开「toolgen mutate kind 扩展」节点（见 §6）。

## 5. 验收口径

1. `npc_register`/`npc_update` 经 `npcStdlibTools()` 编译为 ToolDef，经 server 端到端调用后，**npc 视图（`kind='npc'`）能读到写入的行**。
2. npc 工具**不在硬编码 `TOOLS` 中**（全来自声明，同 dogfooding L63-69 验证）。
3. npc 写经 `applyMutations`——落 mutation event + 可触发 watcher（承重墙不破）。
4. 既有 450 测试全绿 + tsc 全绿（默认 kind 行为不变，`sheet_update` 仍写 world）。

## 6. 浮现的决策清单

**内部可逆（本 spec 自裁，已定）**
- 工具集＝`npc_register` + `npc_update`（§3.1）。
- mutate 携带 kind 走方案 B（§4.1）。

**不可逆 / 越界（需编排者裁）**
- **D-NPC-1（引擎红线）**：「toolgen 引擎 + store 原语一次性补齐 mutate-kind」是否在 A1 可接受？若编排者坚持「连引擎/store 原语都零改动」，A1 v1 不可达，须前置「mutate-kind 扩展」节点。**本线判定：属 DT-9 允许的地基生长（非新 handler），已实现；请编排者复核红线口径。**
- **D-NPC-2（披露策略，不可逆/产品级）**：npc 属性对玩家可见性默认值——`stateSet` 默认 `visible=0`（暗）。NPC 的「公开身份 vs 暗藏底细」双层值靠 per-attr visible，但**默认暗还是默认明、哪些 attr 该默认公开**是披露策略，牵动 A6 裁决侧与玩家信息面。本 spec 沿用 `stateSet` 默认（暗），**不擅定披露策略**，标记待裁。
- **D-NPC-3（关系承重，不可逆/承重设计）**：npc 关系是否进 anchor 边表？本 spec 明确**不引入**（走 `relation` 视图行形态，§2 非目标）。若编排者要 npc 关系图谱（anchor owner/target 边），那是独立承重设计节点，不在 A1。
