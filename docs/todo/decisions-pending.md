# 决策账本（2026-06-26 扫描 · parallel-roadmap-delivery）

> 起手扫路线图剩余项 + 三池产出。可逆的自决记默认值；不可逆的攒批问用户。
> 维护：随波次推进回填；实现中浮现的新决策追加到 §浮现。

---

## 可逆（已自决，记默认值供回溯，无需用户）

- **[工作流：本地变体 vs GitHub PR]** 取**本地变体**：subagent 在 worktree 只编辑+自测、**不碰 git**；编排者做全部 git（建分支/提交/本地 ff 合并），**不 push、不开 PR**。理由：CLAUDE.md 明令「不 push；push 由人单独指令、提交后 ff 合并回 main」，**用户指令优先于 skill** 的 PR 模型。skill 的「CI 绿」闸由编排者本地跑 `test:all`+`typecheck:all` 替代。
- **[worktree node_modules]** symlink 主仓库 node_modules（root + 相关包）进 worktree，**不 npm install**。理由：避免重写 package-lock（教训 `[worktree npm lock 坑]`）+ 省装包时间。
- **[O1 同构 shared/logger 是否新建]** **不新建**。理由（实证）：core 已有 `packages/core/src/log.ts`（pino，node-only）、后端已接入；前端 `apps/web` **0 处裸 console** 且 web 不依赖 core——「同构、浏览器+node 通用」的前提不成立（无前端 console 要迁）。O-后端 ~80% 已接入，O2 仅剩 `mcp/main.ts` 1~2 处裸 console 待迁（cli.ts 面向终端**保留**）。⚠️ 路线图第三批 O1/O2/O-前端 的描述已对实现漂移——**待沉淀**：fix-wiki / organize-wiki 修正这段（设计-实现漂移）。
- **[wave-1 节点选择]** 取「决策-free + 文件不重叠 + 可逆」三线：core-eval 深化 / 前端散点 fix+清理 / 后端 RT-4+logger 收尾。理由：先验证本地并发流水线，meaty 但无产品决策。
- **[FE-start-contract 谁改]** 暂**不入 wave-1**。理由：缝 B `startGame` 契约（后端 `{turnId}` vs 前端 `{sessionId,started}`）跨前后端两文件、需协调，留 wave-2 由单线一并改（倾向后端统一回 turnId）。

## 不可逆（攒着，到对应批 checkpoint 一次问用户——当前**未阻塞近期波次**，故暂不打扰）

- [ ] **ADR-0026（终局机制）草案 PO 复核**：GM 自调 game_end + 软判据 + 玩家主动结束 + 终局后三去向。gates E1/E2/FE-end-lock（第四批）。
- [ ] **ADR-0027（多端整合包发版架构）草案 PO 复核**：server docker-compose 自托管 + 客户端整合包（安卓/Mac/Win/Linux，安卓/Win 优先）+ key 后端托管。gates FE-CLI-doc、SEC2、移动端壳（第三/五批）。
- [ ] **SEC2 key 托管落地形态**（统一后端托管已裁，但整合包内 sidecar 形态细节依赖 ADR-0027）。第五批发版闸。
- [ ] **S1/S2 承重绑定 ADR**（port 契约 + L3 跨 agent 表达 + 解绑触发条件）。第五批发版闸，纯架构决策不代断。

> 这批不可逆项**均落在第四/五批**，不阻塞 wave-1/2/3（第一批收尾 + 第二批剩余 + 第三批横切）。按「最小打扰」原则，**推进到逼近被 gate 的项时再攒一批 AskUserQuestion**，当前不打扰用户。

## 浮现（subagent 干活时回报；可逆即自决回填、不可逆攒下批）

- **[漂移A · logger]**（可逆，已自决+已沉 wiki）：core 已有 `log.ts`（pino node-only）、后端已接入、前端 0 console 不依赖 core → O1「同构 shared/logger」前提不成立。O-前端 moot、O1 宜降级。已落 backlog-core O2 + 路线图第三批注记，待 fix-wiki/organize-wiki 改措辞。
- **[漂移B · eval harness 路径]**（可逆，已沉 wiki）：真 harness 是 `packages/core/eval/{run,grade,batch,tool}.ts`（offline runTool），非 `src/eval/play-mcp.ts`；choose/roll/browse 是独立 dicelore-play MCP 包。已落 backlog-core F-harness-test + 路线图第一批注记。

---

## Wave 进度

- **Wave 1（2026-06-26）✅ 全合**：n1 eval 地板 / n2 前端 fix+清理 / n3 RT-4+logger。三线 ff 合入 main，四包测试全绿（core 450 / orch 83 / web 49 / shared 11）+ typecheck 0。worktree 已清。
- **Wave 2（就绪派发）**：n4 NPC一等抽象(A1) / n5 玩家主线 e2e / n6 RT-3+缝B契约。下游随 wave1 合并释放，三线文件基本不重叠（n4=core store/mcp、n5=web测试+FakeGm、n6=orch dice+web client）。
  - ⚠️ n5 与 n6 都触 `apps/web/src/api/client.ts`？否——n5 只动 client.test.ts，n6 动 client.ts，错开。n6 与 n5 都可能触 orchestrator dice：n5=FakeDiceGm.ts、n6=rollGate/recovery/api/dice.ts，文件不重叠。
