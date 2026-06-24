# 教条接入收尾 + eval harness 自动闭环

> **本 spec 职责**：定路线图第一批「教条 + harness 闭环」的实现设计。
> **上游**：[路线图第一批](../../wiki/06-里程碑与问题/路线图.md) + [backlog-core 主题F](../../wiki/06-里程碑与问题/backlog-core.md) + [backlog-后端 G-后端-gmcore](../../wiki/06-里程碑与问题/backlog-后端.md) + [ADR-0018](../../wiki/05-决策记录-ADR/README.md)/[ADR-0020](../../wiki/05-决策记录-ADR/README.md)。
> **状态**：设计已定，待 plan。

## 1. 背景与目标

第一批是 meta 闸：不建真 eval harness，所有「GM 行为/措辞」类结论不可信（主题F）。两件事是一条线——harness 要跑真 GM，真 GM 现靠 `openingPrompt` 内联教条 stopgap 兜底，须先正式接教条再建 harness。

**目标**：
1. 真 GM 接 gm-core skill（去 stopgap 依赖、RUN_LIVE 验证）。
2. 真 eval harness 自动闭环（子代理 GM + mock 玩家 + 自动 grade），替代 `run.ts` 的手动指引。
3. F2 终局观测纳入 harness（game_end 谁敲、何时敲）。

## 2. 现状（已核对，不重复调研）

### 教条接入（代码已落，缺 RUN_LIVE）
- `server.ts:34` `gmCoreSkill()` → `diceSkills` → `DiceGm`。
- `DiceGm.runTurn`：skills 非空时 `stageSkills` 拷副本到 tmp cwd → `settingSources:["project"]` + `cwd:staged` + `allowedTools:["mcp__dicelore","Skill","Read"]` + in-process MCP（`type:"sdk"`）。
- `openingPrompt.ts`：`gmCoreSkill()` 返回 SkillRef；`gmCoreDoctrine()` 读 SKILL.md 内联进 openingPrompt 作「保证投递」兜底。
- gm-core SKILL.md 教条完整（Agenda/Moves/闸/形状表），自标「措辞 eval-pending 等 harness」。
- **缺**：RUN_LIVE 实测（教条是否真被 GM 加载、行为对不对）。

### eval 工具链（已备，缺自动闭环）
- `run.ts`：准备场景（灌种子 + init 项目 + 重写 `.mcp.json` 指本地 tsx）+ 打印手动指引（手动 `claude` / headless `claude -p` 喂 playerTurns）。
- `tool.ts`/`batch.ts`：faithful 真引擎工具链（直接 `runTool`+`TOOLS`，不嵌套 claude/MCP）。
- `grade.ts` + `grader.md`：评分 + 定性对标。
- 4 scenarios（orc-hunt / explore-bargain / gacha-draw / dragon-severity）+ 1 seed。
- **缺**：自动 GM 驱动 + mock 玩家 + 自动 grade 闭环。

## 3. 设计决断（自问自答）

**D1 路线与落点**：复用 `DiceGm`，harness 落 `apps/orchestrator/eval/`。
- `DiceGm` + Agent 适配缝本就是为这个抽象设计：in-process MCP + staged 教条 + 真引擎 = 最 faithful。headless `claude -p` 路线要解析终端输出、串 `--resume`、跑 stdio 子进程，更脏更脆。
- 落 orchestrator 不破 ADR-0018 单向依赖：harness = `core.createMcpServer` + `core.eval.{scenarios,grade}` + `orchestrator.DiceGm`，全 core→orchestrator 单向。依赖倒置（harness 放 core 经 AgentFactory 注入）是过度设计——harness 本就是 orchestrator 侧「驱动 DiceGm 跑 eval」的工具。

**D2 mock 玩家**：固定 `playerTurns` 脚本（scenario 已有）。
- 重点在「mock」（确定性、不抢戏、可复现），不在「智能」。LLM 玩家引入「玩家好坏」噪音污染 GM 评测，YAGNI 留未来。

**D3 baseline 对照**：两档——`doctrine`（staged skill + 内联兜底）vs `baseline`（openingPrompt 去 doctrine，纯 signpost+prologue）。
- 现状坑：`buildOpeningPrompt` 无条件内联教条，run.ts 现 `--baseline` 仍带教条、不是纯裸。harness 须让 baseline 真去掉 doctrine，才能分离「教条有无」。

**D4 F2 终局观测**：harness **不替 GM 收局**（run.ts 现「driver 知道回合预算后人为收尾」正是 F2 污染源，必去）。mock 玩家跑完即停，transcript 记 `game_end` 调用 + 收局时机（第几回合 / 未收局）。观测「真 GM 到底收不收局、谁敲」。

**D5 RUN_LIVE**：harness 本身烧真 LLM（真 DiceGm + 真 Claude）= **就是 RUN_LIVE**。跑通即验证教条接入（staged skill 真被加载、GM 真按教条行为）。不另设 live smoke。不进单测，opt-in。

**D6 评分闭环**：一键 `npx tsx eval/harness.ts <scenario> [--baseline]`：跑完自动调 `grade.ts` 出报告到 `reports/`。`findings.md` 结论性人工提炼，不自动化。

## 4. 架构与数据流

```
apps/orchestrator/eval/harness.ts  (新)
  ├─ 1. 场景准备(复用 run.ts 抽出的 prepareScenario):灌种子 → 建临时 db
  ├─ 2. core.createMcpServer(db, { onCanonWrite: evt => transcript.push(evt), rollGate: immediateCommit })
  │     ↑ ADR-0020 现成缝:onCanonWrite 收工具调用痕迹(含 game_end 时机)
  ├─ 3. DiceGm(AgentInit{
  │       mcpServer,
  │       openingPrompt: baseline ? buildBaselinePrompt(db) : buildOpeningPrompt(db),
  │       skills: baseline ? [] : [gmCoreSkill()].filter(Boolean)
  │     })
  ├─ 4. mock 玩家: for turn of scenario.playerTurns → gm.runTurn({text:turn})
  │     → 收 narration/turn_end/error → transcript
  ├─ 5. transcript(回合散文 + onCanonWrite 工具痕迹 + game_end 时机) → jsonl
  └─ 6. 调 core.eval.grade(db, transcript, scenario) → reports/<scenario>-<mode>.md
```

**关键复用**：工具调用观测走 `onCanonWrite` 回调（ADR-0020 现成缝），不改 `DiceGm` 事件类型——GM 每调 `sheet_update`/`resolve_*`/`narrate`/`game_end` 写规范态，回调落 transcript。F2 的 `game_end` 时机、grade 的「掷骰绕过率」都从这取。

## 5. 改动清单

1. **新** `apps/orchestrator/eval/harness.ts` — 自动闭环驱动（D1-D6）。
2. **抽** `packages/core/eval/run.ts` 的场景准备逻辑为可复用 `prepareScenario(scenarioId, opts)`（harness 与 run.ts 共用）；run.ts 保留作手动调试入口。
3. **改** `apps/orchestrator/src/dice/openingPrompt.ts`：新增 `buildBaselinePrompt(db)`（去 doctrine，仅 signpost+prologue）；`buildOpeningPrompt` 不变。
4. **改** `packages/core/eval/grade.ts`：接受 harness 产出的 transcript 格式（若现 `--transcript <cc-jsonl>` 格式不兼容，加 harness 格式适配）。
5. **不改** `DiceGm`（onCanonWrite 缝已够）。

## 6. 测试策略

- harness 本身不进单测（烧 LLM）。
- **可单测部分**（用 `FakeDiceGm` 不烧 LLM 跑通闭环骨架）：
  - `prepareScenario` 场景准备正确性
  - transcript 格式化（onCanonWrite 事件 → jsonl 结构）
  - `buildBaselinePrompt` 不含 doctrine、`buildOpeningPrompt` 含
  - grade 输入解析（harness transcript → grade 可读）
- **真 LLM 验证**（opt-in，不进 CI）：跑一次 orc-hunt 两档（doctrine / baseline）对照，出首份 report，喂 grader.md 定性。

## 7. 边界 / 不做

- 不做 LLM mock 玩家（D2，YAGNI）。
- 不做 inline-only 三档对照（先两档够 F1；staged 渐进披露 vs 纯内联的分离留未来）。
- 不改 `DiceGm` 事件类型（onCanonWrite 缝已够；若后续发现 narration token 流也要观测再议）。
- harness 不替 GM 收局（D4）。
- 不自动化 findings.md 提炼（D6）。

## 8. 依赖与下游

- **依赖**：ADR-0020（onCanonWrite 缝）、ADR-0018（Agent 适配缝）、已落地的教条接入 + eval 工具链。
- **下游**：本批建好后，三池所有 ⚠️（待真harness）项可重新评定；gm-core SKILL.md「措辞 eval-pending」可进 eval-loop 调措辞；F2（E1/E2 终局）可测真 GM 收不收局。
- **沉淀**：完成后 → ADR（若 onCanonWrite 作 harness 观测缝有新决策）+ 04 设计页（eval harness）+ 关 backlog F1/F2/G-后端-gmcore。
