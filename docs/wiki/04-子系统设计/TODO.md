# 04-子系统设计 TODO（草稿 / 进度追踪）

> 非正式页，追踪每页填充进度 + 已 locked 的设计决策（账本）。定稿进正式页。

## 内层能力库（组件1）— ✅ 已写定（2026-06-02），整页见 [内层能力库.md](内层能力库.md)

**已锁定**：

- [x] **内/外层切法 = C**：dice 引擎（纯函数）/ store CRUD / 裁决编排（吃 store+dice，可单测）三个原子层。
- [x] **sheet = `(entity, attr, value)` 三列**，每 cell 一标量；集合/关系靠 `attr` 的 `前缀:键` 约定（`库存:药水`、`声望:黑风寨`、`物品实例#1.耐久`）。值存文本，取数时 parseInt，非数值报错。
- [x] **world = `world_doc`(FTS 散文) + `world_pool`(row_json, weight, source)**；结构保真**不拍平**；按列过滤(json_extract)+加权抽样在 TS 裁决层；`source=author/ai` 当迁移钩子；register 可写 doc/pool。
- [x] **rule = `rule_doc`(FTS + version)**；被动整段读；结构小表（曲线/分档）拍平进散文 OK（不抽样、不过滤）。
- [x] **FTS5 = @node-rs/jieba 写入分词 + `unicode61` 影子列**；trigram 作零依赖保底（schema 不变可切换）。snippet 带空格无害（agent 整段读）。
- [x] **mutation 求值语义**：`算符 × 操作数` 2×2 派发（`+/-`×数值=标量算术 / ×词条=集合增减；`=`×数值=赋数 / ×词条=赋文本）；LHS 裸名归批次实体、RHS 引用强制显式；批量原子事务；账本标 `rolled|set`；引擎不 clamp。

- [x] **§1 骰子引擎（resolver 轮收口）**：分两层——**引擎 A**（纯、RNG 注入可单测）：`rollDice(count,sides,rng)` + `rangeMap(value,bands)`；**求值器 B**（内层、为引用碰 store）：`expr` 文法 `term(±term)*`、`{}` 界定引用，逐项调 A 求和、回账本。**砍** `dice_judge`（DC 折进 contest）/`dice_multi`（批量上移）/独立 `dice_contest`（=evalExpr×2+比大小）。**暴击** = `resolve_outcome` 档位表里定档，非引擎逻辑。

- [x] **event 域 schema（2026-06-02 锁定）**：
  - 一张统一 `event(seq[=FTS5 rowid], kind, content, data_json, tags, game_time?, created_at)`，`kind ∈ {narrate, verdict, mutation, note, timer_fired}`；`content` 走 FTS5(jieba) 只索引散文(narrate/note)、结构进 `data_json`(UNINDEXED)、`tags` 兜底召回。
  - **时间观拆分**：框架只拥有单调 `seq`（通用排序）；**"游戏时间/回合"是团本定义的 sheet 钟**（`世界.回合`/`世界.时间`），由团本 rule 推进、AI 用 `sheet_update` 改；**砍框架 turn 计数器**。
  - **L3 分组 = "叙述窗口"**（两个 narrate 标记间的 event，按 seq）——机械范围，非游戏时间；narrate 不推进游戏时间。
  - `event.game_time?` = 写入时对 sheet 钟拍的可选快照(文本)，仅供回看展示/召回，框架不解释。
  - 溢出后续优化（压缩 / RAG），v1 不做。
- [x] **timer 单独表**：`timer(id, created_seq, fire_condition, payload, status)`；`fire_condition` = 对 sheet 钟的条件(`{世界.回合}>=15`)或文本(AI/hook 判)；**hook 在回合开始比对触发**（[03 TODO B](../03-架构/TODO.md)）；fired 后落一条 `event(kind=timer_fired)`、status→fired。属 event 域、域内两表。

**已写定**（见 [内层能力库.md](内层能力库.md) §6）：

- [x] **session 解析**：人类可读名 + `ANKO_SESSION` env 定位；开库自建四域 schema；`session_meta` 记团本 id+版本 / created_at / display_name / `schema_version`；建库灌注团本（import 归团本页）；瘦 CLI 管理。

## 工具面已定决策（待 [MCP工具面](MCP工具面.md) 页展开）

- [x] 全员 **`anko_` 前缀**（防多 server 撞名）。
- [x] 裁决族统一 **`anko_resolve_*`**：`resolve_choice` / `resolve_outcome` / `resolve_contest`。
- [x] **三个裁决工具都写"裁决记录" event**（记机械结果，喂 L3 比对 `narrate` 的叙述）。
- [x] **sheet 读拆两工具**：`anko_sheet_get`（单 cell）+ `anko_sheet_list`（前缀扫，取整卡/整库存）。不用 `_like`（泄漏 SQL）。
- [x] **mutation 用结构化数组** `[{attr, op, expr}]`；`expr` 统一命名（弃 operand），值表达式用 B（字符串 DSL + `{}` 引用），随 op 多态，交内层求值器。
- [x] **mcp 用法教条 → [Skills包](Skills包.md)**：一个"工具选择决策树"skill（三条掷的路怎么选；F3 的 L2 二层保险）。
- [ ] 是否为保 L1 再分出掷骰名（纯塑形取舍）。
- [ ] `anko_event_timer_set` 命名是否对齐 `event_` 前缀（小项）。

## resolver 模型（行动层核心，2026-06-02 锁定；resolver 概念待升格 → 见 [03 TODO](../03-架构/TODO.md) C）

**核心**：resolver = 把未定局面产出一个"叙述者无法伪造"的结果，并推动剧情（落 event / 可能写 sheet）。骰子引擎只是其下的逻辑机制；**玩家选择 = "选择者=玩家" 的 resolver**。

**2 轴穷尽表**（团特有的只是参数/数据，不长新工具）：

| 选择者＼结果形状 | **label** | **verdict** | **number** | **content** |
|---|---|---|---|---|
| **玩家选** | `resolve_choice` | — | — | —（挑卡＝choice 变体） |
| **随机选** | `resolve_outcome`（档位） | `resolve_contest`（比表达式；**DC＝比常数**） | `sheet_update` 带骰（状态骰下沉） | `world_sample`（卡池） |

**统一澄清**：DC 不是独立 judge，是 contest 一边退化成常数；number 形状＝sheet_update 带骰（已下沉）；卡池抽＝world_sample 也是 resolver（随机选 content，结果空间来自 store）。

**三个 resolve 工具 I/O**（`anko_resolve_*`；引用在引擎内取真值；产出落 event 回 `event_id`）：
- `resolve_choice`：req `{prompt, options:[{label, consequence(必填)}]}` → resp `{locked_options, event_id, awaiting:"player_pick"}`
- `resolve_outcome`：req `{context, die, bands:[{label,min,max,consequence}]}` → resp `{roll, die, band, event_id}`
- `resolve_contest`：req `{context, a:{name,expr}, b:{name,expr}}` → resp `{a:{rolls,refs,total}, b:{...}, winner, event_id}`
- （number）`sheet_update`：req `{entity, mutations:[{attr, op, expr}]}` → resp `{entity, applied:[{kind:rolled|set, old, rolls, delta, new}], event_id}`

**皱褶**：`resolve_choice` 是"锁后果 + 落 event"在前，**玩家实际选哪个是玩家下一轮**（同步调用拿不到人输入）→ `awaiting:"player_pick"`；"怎么捕获玩家输入（聊天/转轮/投票）" ＝ 模式/adapter 层，本页不定。

**值表达式 `expr`（2026-06-02 锁定）**：表示用 **B＝字符串 DSL + `{}` 界定引用**（`"1d20 + {张三.力量}"`、`"500 + 6d100"`、`"60"`）；**统一命名 `expr`**（弃 operand），用于 `resolve_contest.{a,b}.expr` 与 `sheet_update` mutation 的 `{attr,op,expr}`。`sheet_update` 里 `expr` 随 op 多态（值表达式 / 成员字面量 `小刀[*N]` / 文本字面量），求值器按 op+内容派发；`resolve_contest.expr` 恒为值表达式；`resolve_outcome.die` 是单骰串、不卷入。

## 跨域 / 上游联动

- timer 到期触发、被动 rule 召回 = hook 系 → 见 [03 TODO](../03-架构/TODO.md) A/B。
