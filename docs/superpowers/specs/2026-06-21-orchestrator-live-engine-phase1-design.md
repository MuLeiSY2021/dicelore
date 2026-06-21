# 组件7 实时引擎面 Phase 1 设计（orchestrator live engine）

> **状态**：🟢 brainstorming 定稿（2026-06-21）。
> **一句话**：把 orchestrator 从「只读后端」接成「实时引擎面」——真 Agent SDK 驱动 GM + in-process 挂 dicelore MCP + 三 hook + WS 流 + 细粒度呈现增量 + 动作进 + **单人明骰（闸控掷 + 宕机恢复）**，跑通一个 GM↔玩家回合闭环。
> **上游权威**：[ADR-0018](../../wiki/05-决策记录-ADR/README.md)（组件7 立项 / Agent SDK headless host / 编排契约）、[玩家客户端.md](../../wiki/04-子系统设计/玩家客户端.md)（三层 / 三流 / 通知缝）、[玩家客户端-接口.md](../../wiki/04-子系统设计/玩家客户端-接口.md)（REST §2 / WS §4 / notify §5）、[v1 竖切实现计划](2026-06-21-player-client-v1-impl.md)（已落的非阻塞部分 = 本设计的地基）、交接 [orchestrator-live-engine todo](../../todo/2026-06-21-orchestrator-live-engine.md)。
> **前提（已在 main）**：组件2 MCP 工具面（20 个 `dicelore_*`，stdio bin `packages/core/src/mcp/main.ts`）；组件4 三 hook（`packages/core/src/adapter/hooks/`）；core 公共 barrel（`buildPresentationModel` + 明骰原语 `commitPendingRoll`/`setRollGate`/`getRollGate`）。
> **架构前置决策（已拍）**：dicelore MCP 走 **in-process 挂载**（非 stdio 子进程）——理由见 §8。

---

## 1. 范围

**做**：一个回合的实时闭环 **+ 单人明骰**。

- core additive：`createMcpServer(db, deps)` 工厂 + `runTool` 写后回调接缝 + 经工厂把 orchestrator 的 roll-gate 接到既有 `setRollGate`（core 明骰 handler 已就绪，见 §3.3）。
- orchestrator：Agent SDK headless host 驱动 GM（经 `GmDriver` 抽象）+ in-process 挂 dicelore MCP + 三 hook + WS 流（narration / presentation_delta / choices / **roll_staged / roll_committed** / 回合事件）+ 动作进（`POST …/messages`、`POST …/choices`、**`POST …/roll`**）。
- **单人明骰**：`resolve_*_open` 阻塞经 `awaitPlayerRoll` gate（单人）接通 + `POST /roll` 解阻塞 + `pendingRoll`/`roll_staged`/`roll_committed` 契约（`packages/shared`）+ **宕机恢复重驱** + 最小可用 BG3 掷骰卡（按钮触发，动效精修延后）。
- shared additive：`pendingRoll` 快照字段、`roll_staged`/`roll_committed` 流消息、`POST /roll` 请求/响应（[明骰设计 §6](2026-06-21-player-gated-roll-design.md)）。

**不做（明确排除）**：

- **多人明骰**「谁来点这一掷」协调（[明骰设计 §11](2026-06-21-player-gated-roll-design.md)「先单人」）。**单人 gate 用既有模块级 `setRollGate`**；多 session/多人下的 per-instance gate 迁移 = 未来硬化（§8 注）。
- token 级逐字打字机 narration（见 §4 决策 A）。
- BG3 骰子动效美术精修；Tauri 壳；Web 多人鉴权 / 会话路由；世界/卡池浏览；元动作（rewind/branch/swipe）。

---

## 2. 模块结构

### 2.1 core additive（不改工具行为，纯新增）

```
packages/core/src/mcp/server.ts   ← 新增工厂
  export function createMcpServer(db: DB, deps?: McpServerDeps): McpServer
    把 main.ts 的「new McpServer + registerTool 循环」抽进来；接收 deps（见 §3.1）。
    若 deps.rollGate 提供 → 内部 setRollGate(deps.rollGate)（接通既有明骰 handler，§3.3）。
  main.ts 改为：createMcpServer(db, {}) + 接 StdioServerTransport（stdio 路径行为不变）。

packages/core/src/mcp/runTool.ts  ← 扩展
  runTool 在规范态写【成功后】调 deps.onCanonWrite?.(evt)（按实例传入，非模块全局）。
```

> core 明骰原语**已就绪**（无需新写，本期只「接 gate」不改）：`stagePendingRoll`/`getPendingRoll`/`markRollCommitted`（`store/pendingRoll.ts`）、`commitPendingRoll`（`resolve/commitRoll.ts`）、`setRollGate`/`getRollGate`/`RollGate=(eventId)=>Promise<void>`（`mcp/rollGate.ts`）、`resolve_*_open` handler（`mcp/handlers/resolver.ts`：`stage → await getRollGate()(eventId) → commitPendingRoll → 返回`）。

### 2.2 orchestrator（apps/orchestrator/src/）

```
gm/GmDriver.ts        GmDriver 接口 + TurnEvent / TurnInput 类型（§3.2）
gm/AgentSdkDriver.ts  真实现：包 @anthropic-ai/claude-agent-sdk（新增依赖），鉴权见 §6
gm/FakeGmDriver.ts    脚本化 fake（测试用，发预设事件序列）
session/SessionHost.ts  每 session 一个：持 db + MCP 实例 + GmDriver + 三 hook 接线 + WS 广播器 + roll-gate
session/registry.ts     sessionId → SessionHost（多 session in-process，懒建）
live/turnLoop.ts        纯逻辑：消费 GmDriver 事件序列 → 调 hook / 广播 WS（注入 fake 可单测）
live/notify.ts          onCanonWrite 事件 → presentation_delta / roll_committed 映射（接口 §4/§5）
live/rollGate.ts        awaitPlayerRoll（单人）：staged 时读 pending_roll 规格→推 roll_staged + 返回 promise；POST /roll 解之
live/ws.ts              WS 连接管理 + 按 session 广播（接口 §3/§4）
recovery.ts             启动扫描 pending_roll status=awaiting → 重弹卡 + 重驱 GM（§4b 恢复路）
server.ts               扩展：挂 WS 端点 + POST messages/choices/roll（复用现有只读 REST + buildSnapshot）
presentation.ts         复用（buildSnapshot，首屏/重连全量）
```

apps/web（明骰最小 UI）：`play/RollCard.tsx`（消费 `roll_staged` → 亮 DC/区间/exprDisplay + [掷骰]按钮 → `POST /roll` → `roll_committed` 回显；动效精修延后）；`api/client.ts` 加 `postRoll(sessionId, eventId)`。

---

## 3. 接缝与接口

### 3.1 core `McpServerDeps`（按实例注入，多 session 安全）

```ts
export interface CanonWriteEvent {
  kind: "mutation" | "event" | "visibility" | "reveal" | "watcher_fired" | "choice_staged" | "game_end";
  seq: number;            // 写后的 store seq
  toolName: string;       // 触发的 dicelore_* 工具
  output: unknown;        // 工具出参（event_id / fired_watchers / mutation 账本等，MCP 最知道改了啥）
}
export interface McpServerDeps {
  onCanonWrite?: (evt: CanonWriteEvent) => void;  // runTool 写规范态成功后同步调
  rollGate?: RollGate;  // 单人明骰 gate；工厂内部 setRollGate(deps.rollGate) 接通既有 handler（§3.3）
}
```

> **为何按实例传入 onCanonWrite**：企业多 session 在**同一进程内**并发，模块级单例会串台。工厂按 session 绑定 `db` + `deps`，每个 `SessionHost` 的 MCP 实例持自己的回调 → 隔离。
> **明骰 gate 的现实妥协**：core 既有 `setRollGate` 是**模块级**；本期单人，工厂内 `setRollGate(deps.rollGate)` 够用（同一时刻一个活跃 gate）。**多 session/多人下需把 gate 迁成 per-instance**（动 `resolver.ts` 用注入 gate 而非 `getRollGate()`）——列为未来硬化，不在本期（[明骰设计 §11](2026-06-21-player-gated-roll-design.md)「先单人」）。

### 3.3 明骰 gate 接线（单人）

orchestrator `live/rollGate.ts` 实现 `RollGate = (eventId) => Promise<void>`：

1. 被 core handler `await gate(eventId)` 调用时：读 `getPendingRoll(db, eventId)` 取规格 → 映射成 `pendingRoll`（[明骰 §6](2026-06-21-player-gated-roll-design.md)：`shape`/`label`/`yourSide.exprDisplay`/`dc`/`bands`，**无结果**）→ WS 推 `roll_staged{pendingRoll}` → 返回一个 promise，其 resolver 按 `eventId` 存入 SessionHost 的待掷表。
2. `POST /sessions/{id}/roll {eventId}` → 查待掷表取 resolver → resolve（gate 解开）→ core handler 续跑 `commitPendingRoll` → 写 verdict event → `onCanonWrite(kind=event/verdict)` → `notify.ts` 映射 `roll_committed{rolls,total,dc?,outcome}` → WS 推。
3. **裸 CC 降级**：未设 gate（无前端）时 handler 直接立即掷（core 既有行为，`if (gate)` 判空），不卡死。

### 3.2 orchestrator `GmDriver`

```ts
export interface TurnInput { text: string }
export type TurnEvent =
  | { type: "narration"; text: string }   // 一段散文（Phase 1 = narrate 工具调用粒度，见 §4-A）
  | { type: "turn_end" };                  // GM 本回合自然结束
export interface GmDriver {
  // 喂一回合输入，异步产出事件流。工具调用由 SDK 经 mcpServers 自行执行（不经此流转发），
  // 其规范态副作用走 core onCanonWrite 接缝捕获（§4）。
  runTurn(input: TurnInput): AsyncIterable<TurnEvent>;
}
```

---

## 4. 数据流（一个回合）

```
👤 POST /sessions/{id}/messages {text}
  → SessionHost.handleMessage(text)
  → turn-start hook（组件4，rule 召回）注入本轮
  → GmDriver.runTurn(input)  ── 异步事件流 ──┐
                                            │
  GM（经 Agent SDK）自己调 dicelore_* 工具（in-process MCP）
    → runTool 写 db 成功 → onCanonWrite(evt)
       → live/notify.ts 映射 → WS presentation_delta（人物卡/机械回显增量）
  TurnEvent: narration  → WS narration_commit（散文落定，§4-A）
  TurnEvent: turn_end   → turn-end hook（组件4：choice 物化 + L3 审计）
       → 若 staged choice → WS choices
       → WS turn_ended
       → 若 L3 block → 把 block reason 作下一轮注入重驱（沿用 adapter 既定行为）

👤 POST /sessions/{id}/choices {eventId, optionIndex}
  → 记录所选 → 作下一回合 runTurn 输入
```

**决策 A（narration 粒度）**：dicelore 散文经 `dicelore_narrate` 工具写 `kind=narrate` event（非 GM 自由文本）。Phase 1 按 **narrate 调用粒度**推 `narration_commit`（经 onCanonWrite 捕获 `kind=event` 且 narrate，或 driver 发 `narration` 事件）。**token 级逐字 `narration_delta` 推迟**——取决于 SDK 是否流式吐工具入参，未验证、不在 Phase 1 冒险。散文仍一段段实时到，只是无逐字动效。

**决策 B（呈现增量来源）**：呈现刷新走 core `onCanonWrite` 接缝（MCP 最知道改了啥），**不**从 GmDriver 转发工具调用——二者解耦、更可靠。首屏/重连仍用 `GET /presentation` 全量（已实现）。

### 4b. 明骰流（回合内阻塞，单人）

```
回合内，GM 调 resolve_*_open（in-process MCP handler）：
  core handler: stagePendingRoll → await getRollGate()(eventId)        ← 此调用【阻塞】
    → orchestrator gate(eventId): 读 getPendingRoll 规格 → WS roll_staged{pendingRoll} → 挂起 promise
  🖥️ RollCard 弹出（亮 DC/区间/exprDisplay，无结果）
  👤 点[掷骰] → POST /sessions/{id}/roll {eventId}
    → orchestrator 查待掷表 → resolve gate promise
  core handler 续跑: commitPendingRoll → 写 verdict event(含点数/DC/成败, visible=1)
    → onCanonWrite(verdict) → notify.ts → WS roll_committed{rolls,total,dc?,outcome}
    → 🖥️ 骰子动效(最小) + 成败高亮
  handler 返回结果给 GM（回合内）→ GM 据此续叙述 → 回合自然结束
```

**anti-F1 不变**：点数恒由 core 在 `commitPendingRoll`（玩家点击后）计算；`pendingRoll` 只下发 `exprDisplay`（如 `1d20+{说服}`），真值不下发。**裸 CC**：无 gate → handler 立即掷（§3.3-3）。

---

## 5. 错误处理

- **GmDriver 异常 / SDK 失败**：SessionHost 捕获 → WS `error{code,message}` → 回合可重试；不崩进程（per-session try/catch，企业多 session 下一个 session 故障不波及别的）。
- **onCanonWrite 回调抛错**：吞掉并记日志，**不阻断 runTool 主流程**（呈现增量是尽力而为；首屏全量是兜底对账基准，与接口 §5「fire-and-forget」一致）。
- **L3 block**：沿用 adapter `turnEnd` 既定——block reason 作下一轮注入重驱 GM，不静默吞。
- **WS 断线**：客户端重连 = `GET /presentation` + `GET /events?since=` 补齐再续流（接口 §3 既定，前端已有首屏拉取）。
- **明骰宕机恢复重驱**（[明骰 §5](2026-06-21-player-gated-roll-design.md)）：后端在 `await gate` 中崩溃 → 阻塞调用 + GM 回合丢失，但 `pending_roll`（status=awaiting）已落库。`recovery.ts` 启动扫描每 session 的 awaiting pending_roll → 前端重连重弹 RollCard → 玩家点击 → `commitPendingRoll`（幂等，已 committed 不重掷）→ 写 verdict → **把结果作输入重驱 GM**（恢复路退化成异步喂、非阻塞返回）。`pending_roll` + verdict event 是真相源，结果总能补达。

---

## 6. 鉴权 / 模型 / 传输

- **鉴权沿用 Claude Code 现配**（`~/.claude/settings.json` 的 `env`）：`ANTHROPIC_BASE_URL`（自建中转 relay）+ `ANTHROPIC_AUTH_TOKEN`。Agent SDK 原生读这两个 env。
- **密钥纪律**：token 是密钥，**只从 env 读，绝不写进代码 / 本 spec / 任何提交物**。提供 `apps/orchestrator/.env.example`（仅占位键名、无真值）+ README 说明「值从 `~/.claude/settings.json` 取或自配 relay」。orchestrator 启动时校验这两个 env 存在，缺失则明确报错（不静默连官方端点）。
- **GM 模型**：默认 `opus[1m]`（与 settings `model` 一致），`DICELORE_GM_MODEL` env 可覆盖。
- **传输**：WS（接口 §3/§4 的 `…/ws`）。SSE 作未来可选，本期不做。

---

## 7. 测试策略

- **纯逻辑单测（不烧 LLM）**：`turnLoop` / `notify` / `SessionHost` / `live/rollGate` 用 **FakeGmDriver**（脚本化发 `narration`/`turn_end` + 用内存 db 直写模拟工具副作用触发 onCanonWrite），覆盖：narration 推送、写→`presentation_delta`、turn_end→choice 物化→`choices`、L3 block 重注入、错误→WS error、**明骰：gate 挂起→roll_staged、POST /roll→commit→roll_committed、裸 CC 无 gate 立即掷、宕机恢复扫描重驱**。
- **core 单测**：`createMcpServer` + `onCanonWrite` 用内存 db，断言工具写后回调被调、payload 正确；`deps.rollGate` 经工厂接到 `getRollGate`；`main.ts` stdio 路径回归不变。明骰原语（commitPendingRoll 等）已有自测，不重写。
- **集成冒烟（opt-in，不进 CI）**：真 Agent SDK + relay，跑一个含明骰的真回合；带 `RUN_LIVE=1` 守卫。
- **端到端**：webapp-testing（Playwright）连 orchestrator（FakeGmDriver 后端或注入脚本），验前端 narration/呈现台/choices/**RollCard 掷骰**实时渲染。

---

## 8. 架构决策记录：为何 in-process

企业多 session 并发下，stdio 子进程挂载 = 每 session 一个额外 Node 进程（内存/启动/FD 成本随 session 线性涨，几百 session 先到顶）。in-process：

- 单 session 开销低一个量级（无子进程，仅多一组对象 + db 句柄）；工具调用无 stdio IPC 跳。
- 横向扩展靠多 orchestrator 实例分片 session（webhook payload 带会话标识，接口 §5 已留路）；隔离放到实例级（per-session try/catch + 有界 N/实例）。
- 瓶颈是 LLM 推理（网络 I/O，秒级），同步 sqlite（微秒~毫秒）相对可忽略；重 FTS 真成瓶颈再丢 worker thread。
- 明骰的 `setRollGate` 注入在 in-process 下零 hack（本期单人即用，多 session per-instance 化为未来）。

代价：需 core `createMcpServer(db)` 工厂（§2.1，additive 小活，本设计含）；同进程共享 fate（用 per-session 错误边界 + 实例级隔离兜）。

---

## 9. 落档清单（本设计批准后）

- `docs/wiki/04-子系统设计/玩家客户端.md` §9.1 实现进度 → 追加 Phase 1 落地后状态。
- `docs/wiki/04-子系统设计/MCP工具面.md` → `createMcpServer(db, deps)` 工厂 + `onCanonWrite` 接缝（与组件2 协调，标 additive）。
- 视情况新增 ADR（in-process 挂载裁定 / onCanonWrite 接缝）。
- `docs/todo/` → 下一期交接更新（多人明骰协调 / 骰子动效精修 / per-instance gate 硬化 / Tauri / 多人鉴权）。

---

## 10. 本设计**不**负责定的

- 接口具体字段名 / schema → [玩家客户端-接口](../../wiki/04-子系统设计/玩家客户端-接口.md) + `packages/shared`（已定形）。
- 明骰的 core 原语 / 工具 / dice 机制 → [明骰设计](2026-06-21-player-gated-roll-design.md)（本期只「接 gate + 契约 + UI + 恢复」，不改 core 明骰）；多人「谁掷」协调 = 未来。
- 实现任务拆分 + 上游排序 → 紧接其后的 writing-plans 实现计划。
- 前端 narration/呈现台/choices 的视觉细节 → [玩家客户端-视觉](../../wiki/04-子系统设计/玩家客户端-视觉.md)。
