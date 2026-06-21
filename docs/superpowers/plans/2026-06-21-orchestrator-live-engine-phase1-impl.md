# 组件7 实时引擎面 Phase 1 实现计划（含单人明骰）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 orchestrator 从只读后端接成实时引擎面——真 Agent SDK 驱动 GM + in-process 挂 dicelore MCP + 三 hook + WS 流 + 细粒度呈现增量 + 动作进 + 单人明骰（闸控掷 + 宕机恢复），跑通一个 GM↔玩家回合闭环。

**Architecture:** core 加 `createMcpServer(db, deps)` 工厂（把 `main.ts` 的 registerTool 循环抽出，并在工具写规范态后调 `deps.onCanonWrite`、把 `deps.rollGate` 接到既有 `setRollGate`）。orchestrator 经抽象 `GmDriver` 驱动 GM（真实现包 `@anthropic-ai/claude-agent-sdk` 的 `query()`，in-process 挂 MCP via `mcpServers: { dicelore: { type:"sdk", name, instance } }`，hooks 接 SessionStart/UserPromptSubmit/Stop）；纯逻辑（turnLoop/notify/rollGate/SessionHost）用 `FakeGmDriver` 单测、不烧 LLM。

**Tech Stack:** TypeScript ESM（`moduleResolution: Bundler`，相对 import 带 `.js`）· `@anthropic-ai/claude-agent-sdk`（新增依赖）· `@modelcontextprotocol/sdk`（core 已用）· `ws`（WS server）· Hono + @hono/node-server（已用）· better-sqlite3（已用）· vitest · zod（已用）。

## Global Constraints

- **架构已定**：dicelore MCP 走 **in-process 挂载**（`McpSdkServerConfigWithInstance = { type:"sdk", name, instance: McpServer }`）。
- **core 仅 additive**：只新增 `createMcpServer` 工厂 + barrel 导出；**不改** `runTool` / 明骰 handler / store 等既有逻辑（onCanonWrite 在工厂的工具处理器外层包，不进 runTool）。`main.ts` stdio 路径行为保持不变。
- **GmDriver 接缝**：orchestrator 依赖抽象 `GmDriver`；真 Agent SDK 实现是**唯一不进单测**的件（opt-in 集成冒烟，`RUN_LIVE=1` 守卫）。所有纯逻辑用 `FakeGmDriver` 测，禁烧 LLM。
- **接缝按实例注入**：`onCanonWrite` / `rollGate` 经 `createMcpServer(db, deps)` 按 session 实例传入。**明骰单人**：gate 经工厂内 `setRollGate(deps.rollGate)` 接既有模块级 seam（同一时刻一个活跃 gate）；多 session/多人 per-instance gate = 未来（不在本期）。
- **anti-F1 不破**：明骰点数恒由 core `commitPendingRoll`（玩家点击后）算；`pendingRoll` 只下发 `exprDisplay`，真值不下发。
- **鉴权只读 env**：Agent SDK 沿用 `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`（SDK 原生读），GM 模型默认 `opus`、`DICELORE_GM_MODEL` 可覆盖。**密钥绝不写进代码/计划/提交**；附 `.env.example` 仅占位键名。
- **契约单一真相**：`packages/shared` 加 `pendingRoll`/`roll_staged`/`roll_committed`/`POST /roll`（[明骰设计 §6](../specs/2026-06-21-player-gated-roll-design.md)），前后端共用。
- **范围边界（不做）**：多人明骰协调、BG3 动效精修、token 级逐字 narration、Tauri、Web 多人鉴权。

## 设计依据

- [实时引擎面 Phase 1 设计](../specs/2026-06-21-orchestrator-live-engine-phase1-design.md)
- [明骰设计](../specs/2026-06-21-player-gated-roll-design.md)（resolve_*_open / pending_roll / commitPendingRoll / setRollGate）
- [玩家客户端-接口](../../wiki/04-子系统设计/玩家客户端-接口.md)（REST §2 / WS §4 / notify §5）
- core 现状：`packages/core/src/mcp/main.ts`（registerTool 循环 + stdio）、`mcp/runTool.ts`、`mcp/handlers/resolver.ts`（`resolve_*_open`：stage → `await getRollGate()(eventId)` → `commitPendingRoll` → 返回）、`mcp/rollGate.ts`（`setRollGate`/`getRollGate`/`RollGate=(eventId)=>Promise<void>`）、`store/pendingRoll.ts`（`getPendingRoll`/`stagePendingRoll`/`markRollCommitted`、`PendingRollRow`/`RollSpec`/`RollShape`）、`resolve/commitRoll.ts`（`commitPendingRoll(db,eventId,rng?):RollResult`）、`store/db.ts`（`openDb`/`initSchema`/`DB`）。

---

## 文件结构

```
packages/core/src/
  mcp/server.ts            ← 新增 createMcpServer(db, deps?): McpServer（抽 main.ts 循环 + onCanonWrite 外层包 + setRollGate 接线）
  mcp/server.test.ts       ← 新增
  mcp/main.ts              ← 改为调 createMcpServer(db, {}) + StdioServerTransport（行为不变）
  index.ts                 ← 追加导出 createMcpServer + 类型 CanonWriteEvent/McpServerDeps

packages/shared/src/
  presentation.ts          ← 加 PendingRollSchema + snapshot.pendingRoll 字段
  stream.ts                ← 加 roll_staged / roll_committed 两条消息
  rest.ts                  ← 加 RollRequest/RollResponse
  *.test.ts                ← 各自追加

apps/orchestrator/src/
  gm/GmDriver.ts           ← GmDriver 接口 + TurnInput/TurnEvent 类型
  gm/FakeGmDriver.ts       ← 脚本化 fake（测试用）
  gm/AgentSdkDriver.ts     ← 真实现（@anthropic-ai/claude-agent-sdk，opt-in 集成）
  live/notify.ts           ← CanonWriteEvent → presentation_delta / roll_committed 映射
  live/rollGate.ts         ← 单人 awaitPlayerRoll（staged→roll_staged + promise；resolveRoll(eventId) 解之）
  live/ws.ts               ← WsHub：每 session 连接集合 + 广播
  live/turnLoop.ts         ← runTurn(host, input)：消费 GmDriver 事件 → 广播 + turn-end hook
  session/SessionHost.ts   ← 每 session：db + MCP 实例 + GmDriver + gate + WsHub + 三 hook
  session/registry.ts      ← sessionId → SessionHost（懒建、多 session）
  recovery.ts              ← 启动扫描 pending_roll awaiting → 重弹卡 + 重驱
  server.ts                ← 扩展：WS 端点 + POST messages/choices/roll（复用现有只读 REST）
  .env.example             ← 占位键名（ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN / DICELORE_GM_MODEL）

apps/web/src/
  api/client.ts            ← 加 postMessage / postRoll
  live/useSession.ts       ← WS 客户端 hook：连 /ws，分发 narration/presentation_delta/choices/roll_staged/roll_committed
  play/RollCard.tsx        ← BG3 掷骰卡（消费 roll_staged → [掷骰] → postRoll → roll_committed）
  pages/PlayPage.tsx       ← 接 useSession：流式叙事 + 呈现台增量 + 掷骰卡
```

---

### Task 1: core `createMcpServer(db, deps)` 工厂 + onCanonWrite 接缝（additive）

把 `main.ts` 的 `new McpServer + registerTool 循环`抽进 `server.ts` 的工厂；工具处理器外层包：写规范态工具成功后调 `deps.onCanonWrite`；`deps.rollGate` 经 `setRollGate` 接既有明骰 handler。**不改 `runTool` 与明骰逻辑**。

**Files:**
- Create: `packages/core/src/mcp/server.ts`
- Create: `packages/core/src/mcp/server.test.ts`
- Modify: `packages/core/src/mcp/main.ts`

**Interfaces:**
- Consumes: `./tools.js`（`TOOLS`）、`./runTool.js`（`runTool(db, tool, args)`）、`./rollGate.js`（`setRollGate`, `RollGate`）、`../store/db.js`（`DB`）、`@modelcontextprotocol/sdk/server/mcp.js`（`McpServer`）。
- Produces:
  - `interface CanonWriteEvent { kind: "mutation"|"event"|"visibility"|"reveal"|"watcher_fired"|"choice_staged"|"game_end"; seq: number; toolName: string; output: unknown }`
  - `interface McpServerDeps { onCanonWrite?: (evt: CanonWriteEvent) => void; rollGate?: RollGate }`
  - `function createMcpServer(db: DB, deps?: McpServerDeps): McpServer`

- [ ] **Step 1: 先写失败测试 `packages/core/src/mcp/server.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { createMcpServer, type CanonWriteEvent } from "./server.js";

describe("createMcpServer onCanonWrite 接缝", () => {
  it("返回 McpServer 实例且不崩", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const server = createMcpServer(db, {});
    expect(server).toBeTruthy();
  });

  it("通过工具处理器写规范态后触发 onCanonWrite(kind/toolName/seq)", async () => {
    const db = openDb(":memory:");
    initSchema(db);
    const events: CanonWriteEvent[] = [];
    // registerTool 的处理器是私有的；用 runTool 间接验证 wrapper：见 Step 3 暴露的 wrapTool。
    const { wrapToolForTest } = await import("./server.js");
    const handler = wrapToolForTest(db, { onCanonWrite: (e) => events.push(e) });
    // 触发一个可见 event_append（规范态写）
    handler("event_append", { kind: "narrate", content: "你推门进去" });
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe("event");
    expect(events[0].toolName).toBe("event_append");
    expect(events[0].seq).toBeGreaterThan(0);
  });

  it("非规范态写工具不触发 onCanonWrite", async () => {
    const db = openDb(":memory:");
    initSchema(db);
    const events: CanonWriteEvent[] = [];
    const { wrapToolForTest } = await import("./server.js");
    const handler = wrapToolForTest(db, { onCanonWrite: (e) => events.push(e) });
    // sheet_get 一类只读工具(若不存在则改用任一只读工具名)：用一个不在 CANON_WRITE 集合的名字
    handler("rule_recall", { query: "x" });
    expect(events.length).toBe(0);
  });
});
```

> 注：测试用 `wrapToolForTest`（Step 3 导出的小工具）直接验证「调用工具→onCanonWrite 映射」，避免去驱动 MCP 协议层。`event_append`/`rule_recall` 取自 `TOOLS`；若实际工具名不同，按 `packages/core/src/mcp/tools.ts` 的真实名替换（实现时 grep `name:` 确认）。

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -w @dicelore/core -- server`
Expected: FAIL —— `./server.js` 模块缺失。

- [ ] **Step 3: 写实现 `packages/core/src/mcp/server.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DB } from "../store/db.js";
import { TOOLS } from "./tools.js";
import { runTool } from "./runTool.js";
import { setRollGate, type RollGate } from "./rollGate.js";

export interface CanonWriteEvent {
  kind: "mutation" | "event" | "visibility" | "reveal" | "watcher_fired" | "choice_staged" | "game_end";
  seq: number;        // 写后的 store head seq
  toolName: string;   // 触发的工具(去 dicelore_ 前缀的内部名)
  output: unknown;    // 工具出参
}
export interface McpServerDeps {
  onCanonWrite?: (evt: CanonWriteEvent) => void;
  rollGate?: RollGate;
}

// 工具名 → CanonWriteEvent.kind；不在表中的工具不发 onCanonWrite。
const CANON_KIND: Record<string, CanonWriteEvent["kind"]> = {
  sheet_update: "mutation",
  event_append: "event",
  sheet_show: "visibility",
  world_show: "visibility",
  reveal_once: "reveal",
  watcher_fired: "watcher_fired",
  resolve_choice: "choice_staged",
  game_end: "game_end",
};

function maxSeq(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM event").get() as { s: number | null };
  return r.s ?? 0;
}

// 把「调用一个工具 + 写后 onCanonWrite」封成一个函数(供工厂注册 + 单测复用)。
export function wrapToolForTest(db: DB, deps: McpServerDeps) {
  const byName = new Map(TOOLS.map((t) => [t.name, t]));
  return (name: string, args: unknown): unknown => {
    const t = byName.get(name);
    if (!t) throw new Error(`未知工具: ${name}`);
    const out = runTool(db, t, args);
    const kind = CANON_KIND[name];
    if (kind && deps.onCanonWrite) {
      deps.onCanonWrite({ kind, seq: maxSeq(db), toolName: name, output: out });
    }
    return out;
  };
}

export function createMcpServer(db: DB, deps: McpServerDeps = {}): McpServer {
  if (deps.rollGate) setRollGate(deps.rollGate); // 单人明骰：接既有模块级 gate seam
  const server = new McpServer({ name: "dicelore", version: "0.0.0" });
  const invoke = wrapToolForTest(db, deps);
  for (const t of TOOLS) {
    server.registerTool(
      `dicelore_${t.name}`,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema.shape,
        outputSchema: t.outputSchema.shape,
        annotations: t.annotations,
      },
      (args: unknown) => invoke(t.name, args) as any,
    );
  }
  return server;
}
```

> 注：`CANON_KIND` 的键必须与 `tools.ts` 的真实工具名一致——实现时 `grep "name:" packages/core/src/mcp/tools.ts` 核对（如 `event_append` 是否叫别的）。`resolve_*_open`/`resolve_*_hidden` 的 verdict 写也应发 `kind:"event"`：若需要，给表补 `resolve_outcome_hidden`/`resolve_contest_hidden`/`resolve_outcome_open`/`resolve_contest_open` → `"event"`（明骰 verdict 经此转 roll_committed，见 orchestrator notify）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npm run test -w @dicelore/core -- server`
Expected: 3 用例 PASS。

- [ ] **Step 5: 改 `main.ts` 复用工厂（行为不变）**

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openSession } from "../session/resolve.js";
import { createMcpServer } from "./server.js";

async function main() {
  const { db } = openSession();
  const server = createMcpServer(db, {}); // stdio 路径无 onCanonWrite/rollGate
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error("dicelore mcp 启动失败:", e);
  process.exit(1);
});
```

- [ ] **Step 6: 跑全 core 测试确认无回归**

Run: `npm run test -w @dicelore/core && npm run typecheck -w @dicelore/core`
Expected: 全绿（含明骰既有测试），typecheck exit 0。

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/mcp/server.ts packages/core/src/mcp/server.test.ts packages/core/src/mcp/main.ts
git commit -m "feat(core): createMcpServer 工厂 + onCanonWrite 接缝(additive,不改 runTool/明骰)"
```

---

### Task 2: core barrel 导出 createMcpServer + 类型

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/index.test.ts`（追加）

**Interfaces:**
- Consumes: Task 1 的 `createMcpServer`/`CanonWriteEvent`/`McpServerDeps`。
- Produces: `@dicelore/core` 导出 `createMcpServer` + 两类型（orchestrator import）。

- [ ] **Step 1: 追加失败测试到 `packages/core/src/index.test.ts`**

```ts
import { createMcpServer } from "./index.js";

it("barrel 导出 createMcpServer，可建 in-process server", () => {
  const { openDb, initSchema } = require("./index.js");
  const db = openDb(":memory:");
  initSchema(db);
  expect(createMcpServer(db, {})).toBeTruthy();
});
```

> 若现有 `index.test.ts` 是 ESM-only（无 `require`），改用顶部 `import { openDb, initSchema, createMcpServer } from "./index.js";` 并在用例内直接用。

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -w @dicelore/core -- index`
Expected: FAIL —— `createMcpServer` 未从 barrel 导出。

- [ ] **Step 3: 追加导出到 `packages/core/src/index.ts`**

```ts
export {
  createMcpServer,
  type CanonWriteEvent,
  type McpServerDeps,
} from "./mcp/server.js";
```

- [ ] **Step 4: 跑测试 + typecheck**

Run: `npm run test -w @dicelore/core -- index && npm run typecheck -w @dicelore/core`
Expected: PASS，exit 0。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): barrel 导出 createMcpServer + CanonWriteEvent/McpServerDeps"
```

---

### Task 3: shared 明骰契约（pendingRoll / roll_staged / roll_committed / POST /roll）

按 [明骰设计 §6](../specs/2026-06-21-player-gated-roll-design.md) additive 扩 `packages/shared`。

**Files:**
- Modify: `packages/shared/src/presentation.ts`、`packages/shared/src/stream.ts`、`packages/shared/src/rest.ts`
- Test: `packages/shared/src/presentation.test.ts`（追加）、`packages/shared/src/stream.test.ts`（追加）

**Interfaces:**
- Produces（从 barrel 出）：
  - `PendingRoll`（`{eventId,shape,label,yourSide:{name,exprDisplay},dc?,bands?}`）+ `PresentationSnapshot.pendingRoll: PendingRoll | null`
  - StreamMessage 增 `roll_staged{pendingRoll}` / `roll_committed{eventId,rolls,total,dc?,outcome}`
  - `RollRequest{eventId}` / `RollResponse{turnId}`

- [ ] **Step 1: 先写失败测试（追加到 `presentation.test.ts`）**

```ts
import { PendingRollSchema, PresentationSnapshotSchema, CLIENT_PROTOCOL } from "./index.js";

it("PendingRoll 形状：只含规格无结果", () => {
  const pr = PendingRollSchema.parse({
    eventId: 12, shape: "contest", label: "说服守卫",
    yourSide: { name: "张三", exprDisplay: "1d20+{说服}" }, dc: 15,
  });
  expect(pr.eventId).toBe(12);
});

it("快照 pendingRoll 可为 null", () => {
  const snap = PresentationSnapshotSchema.parse({
    protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0,
    sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null,
  });
  expect(snap.pendingRoll).toBeNull();
});
```

追加到 `stream.test.ts`：

```ts
import { StreamMessageSchema, CLIENT_PROTOCOL } from "./index.js";

it("roll_staged / roll_committed 可判别", () => {
  const staged = StreamMessageSchema.parse({
    protocol: CLIENT_PROTOCOL, type: "roll_staged",
    pendingRoll: { eventId: 12, shape: "outcome", label: "撬锁",
      yourSide: { name: "张三", exprDisplay: "1d100" }, bands: [{ label: "成功", min: 1, max: 60 }] },
  });
  expect(staged.type).toBe("roll_staged");
  const committed = StreamMessageSchema.parse({
    protocol: CLIENT_PROTOCOL, type: "roll_committed",
    eventId: 12, rolls: [18], total: 18, dc: 15, outcome: "success",
  });
  expect(committed.type).toBe("roll_committed");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -w @dicelore/shared`
Expected: FAIL —— `PendingRollSchema` 未定义 / 快照无 `pendingRoll` / 未知 stream type。

- [ ] **Step 3: 改 `presentation.ts`（加 PendingRoll + 快照字段）**

```ts
export const RollBandSchema = z.object({ label: z.string(), min: z.number(), max: z.number() });
export const PendingRollSchema = z.object({
  eventId: z.number(),
  shape: z.enum(["outcome", "contest"]),
  label: z.string(),
  yourSide: z.object({ name: z.string(), exprDisplay: z.string() }),
  dc: z.number().optional(),
  bands: z.array(RollBandSchema).optional(),
});
export type PendingRoll = z.infer<typeof PendingRollSchema>;
```

在 `PresentationSnapshotSchema` 的对象里追加字段：

```ts
  pendingRoll: PendingRollSchema.nullable(),
```

> 兼容性提示：给现有只读快照构造处（`apps/orchestrator/src/presentation.ts` 的 `buildSnapshot`）补 `pendingRoll: null`（Task 9 顺带处理，避免 schema 校验失败）。

- [ ] **Step 4: 改 `stream.ts`（加两条消息到判别联合）**

```ts
  z.object({ ...base, type: z.literal("roll_staged"), pendingRoll: PendingRollSchema }),
  z.object({ ...base, type: z.literal("roll_committed"),
    eventId: z.number(), rolls: z.array(z.number()), total: z.number(),
    dc: z.number().optional(), outcome: z.string() }),
```

并在 `stream.ts` 顶部 import：`import { PendingRollSchema } from "./presentation.js";`

- [ ] **Step 5: 改 `rest.ts`（加 POST /roll 形状）**

```ts
export const RollRequestSchema = z.object({ eventId: z.number() });
export const RollResponseSchema = z.object({ turnId: z.string() });
export type RollRequest = z.infer<typeof RollRequestSchema>;
export type RollResponse = z.infer<typeof RollResponseSchema>;
```

- [ ] **Step 6: 跑测试 + typecheck**

Run: `npm run test -w @dicelore/shared && npm run typecheck -w @dicelore/shared`
Expected: 全绿，exit 0。

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): 明骰契约(pendingRoll/roll_staged/roll_committed/POST roll)"
```

---

### Task 4: orchestrator GmDriver 接口 + FakeGmDriver

**Files:**
- Create: `apps/orchestrator/src/gm/GmDriver.ts`
- Create: `apps/orchestrator/src/gm/FakeGmDriver.ts`
- Test: `apps/orchestrator/src/gm/FakeGmDriver.test.ts`
- Modify: `apps/orchestrator/package.json`（加依赖 `@anthropic-ai/claude-agent-sdk`、`ws`、`@types/ws`）

**Interfaces:**
- Produces:
  - `interface TurnInput { text: string }`
  - `type TurnEvent = { type: "narration"; text: string } | { type: "turn_end" } | { type: "error"; message: string }`
  - `interface GmDriver { runTurn(input: TurnInput): AsyncIterable<TurnEvent> }`
  - `class FakeGmDriver implements GmDriver`（构造接收脚本 `TurnEvent[]` 或 `(input)=>TurnEvent[]`）

- [ ] **Step 1: 写 `gm/GmDriver.ts`**

```ts
export interface TurnInput { text: string }
export type TurnEvent =
  | { type: "narration"; text: string }   // 一段散文(Phase 1 = narrate 工具调用粒度)
  | { type: "turn_end" }                   // GM 本回合自然结束
  | { type: "error"; message: string };    // 驱动/SDK 错误
export interface GmDriver {
  runTurn(input: TurnInput): AsyncIterable<TurnEvent>;
}
```

- [ ] **Step 2: 先写失败测试 `gm/FakeGmDriver.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { FakeGmDriver } from "./FakeGmDriver.js";
import type { TurnEvent } from "./GmDriver.js";

describe("FakeGmDriver", () => {
  it("按脚本异步吐出事件序列", async () => {
    const script: TurnEvent[] = [{ type: "narration", text: "你推门进去。" }, { type: "turn_end" }];
    const drv = new FakeGmDriver(script);
    const got: TurnEvent[] = [];
    for await (const e of drv.runTurn({ text: "我推门" })) got.push(e);
    expect(got).toEqual(script);
  });

  it("脚本可按输入定制(函数形式)", async () => {
    const drv = new FakeGmDriver((input) => [{ type: "narration", text: `收到:${input.text}` }, { type: "turn_end" }]);
    const got: TurnEvent[] = [];
    for await (const e of drv.runTurn({ text: "压价" })) got.push(e);
    expect(got[0]).toEqual({ type: "narration", text: "收到:压价" });
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npm run test -w @dicelore/orchestrator -- FakeGmDriver`
Expected: FAIL —— 模块缺失。

- [ ] **Step 4: 写 `gm/FakeGmDriver.ts`**

```ts
import type { GmDriver, TurnInput, TurnEvent } from "./GmDriver.js";

type Script = TurnEvent[] | ((input: TurnInput) => TurnEvent[]);

export class FakeGmDriver implements GmDriver {
  constructor(private script: Script) {}
  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const events = typeof this.script === "function" ? this.script(input) : this.script;
    for (const e of events) yield e;
  }
}
```

- [ ] **Step 5: 加依赖到 `apps/orchestrator/package.json`（dependencies / devDependencies）**

```json
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "ws": "^8.18.0",
```
devDependencies 加：
```json
    "@types/ws": "^8.5.0",
```

> 版本号实现时以 `npm view @anthropic-ai/claude-agent-sdk version` / `npm view ws version` 取最新可用；上面是占位下限，安装后以 lockfile 实际为准。

- [ ] **Step 6: 安装 + 跑测试**

Run: `npm install && npm run test -w @dicelore/orchestrator -- FakeGmDriver`
Expected: 2 用例 PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/orchestrator/src/gm/GmDriver.ts apps/orchestrator/src/gm/FakeGmDriver.ts apps/orchestrator/src/gm/FakeGmDriver.test.ts apps/orchestrator/package.json package-lock.json
git commit -m "feat(orchestrator): GmDriver 接口 + FakeGmDriver(脚本化,测试用)"
```

---

### Task 5: orchestrator `live/notify.ts`（CanonWriteEvent → 流消息）

把 core 的 `CanonWriteEvent` 映射成 `roll_committed`（明骰 verdict）或 `presentation_delta`（其它规范态写）。**Phase 1 策略**：`presentation_delta` 作「变更信号」（带 `seq` + 能从出参拿到的机械文本）；web 收到后再 `GET /presentation` 全量对账（接口 §5 允许 refetch），保证正确性。

**Files:**
- Create: `apps/orchestrator/src/live/notify.ts`
- Test: `apps/orchestrator/src/live/notify.test.ts`

**Interfaces:**
- Consumes: `@dicelore/core`（`CanonWriteEvent`）、`@dicelore/shared`（`StreamMessage`/`CLIENT_PROTOCOL`）。
- Produces: `mapCanonWrite(evt: CanonWriteEvent): StreamMessage | null`

- [ ] **Step 1: 先写失败测试 `live/notify.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { mapCanonWrite } from "./notify.js";
import type { CanonWriteEvent } from "@dicelore/core";

describe("mapCanonWrite", () => {
  it("resolve_*_open(明骰 verdict) → roll_committed", () => {
    const evt: CanonWriteEvent = {
      kind: "event", seq: 30, toolName: "resolve_contest_open",
      output: { awaiting: "player_roll", a: { name: "张三", total: 18, rolls: [18] }, b: { name: "DC", total: 15, rolls: [] }, winner: "a", event_id: 30 },
    };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("roll_committed");
    if (msg?.type === "roll_committed") {
      expect(msg.eventId).toBe(30);
      expect(msg.total).toBe(18);
      expect(msg.outcome).toBe("success");
    }
  });

  it("普通规范态写 → presentation_delta(带 seq)", () => {
    const evt: CanonWriteEvent = { kind: "mutation", seq: 12, toolName: "sheet_update", output: {} };
    const msg = mapCanonWrite(evt);
    expect(msg?.type).toBe("presentation_delta");
    if (msg?.type === "presentation_delta") expect(msg.delta.seq).toBe(12);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm run test -w @dicelore/orchestrator -- notify`
Expected: FAIL —— 模块缺失。

- [ ] **Step 3: 写 `live/notify.ts`**

```ts
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { CanonWriteEvent } from "@dicelore/core";

// resolve_*_open 出参 → roll_committed；其它规范态写 → presentation_delta(信号 + 可得机械文本)。
export function mapCanonWrite(evt: CanonWriteEvent): StreamMessage | null {
  if (evt.toolName === "resolve_outcome_open" || evt.toolName === "resolve_contest_open") {
    const o = evt.output as any;
    if (evt.toolName === "resolve_outcome_open") {
      return {
        protocol: CLIENT_PROTOCOL, type: "roll_committed",
        eventId: o.event_id, rolls: [o.roll], total: o.roll,
        outcome: o.band?.label ?? "",
      };
    }
    return {
      protocol: CLIENT_PROTOCOL, type: "roll_committed",
      eventId: o.event_id, rolls: [...(o.a?.rolls ?? []), ...(o.b?.rolls ?? [])],
      total: o.a?.total ?? 0, dc: o.b?.total,
      outcome: o.winner === "a" ? "success" : o.winner === "b" ? "fail" : "tie",
    };
  }
  // 其它：发增量信号(web 收到后 refetch /presentation 对账)
  const text = typeof (evt.output as any)?.content === "string" ? (evt.output as any).content : undefined;
  return {
    protocol: CLIENT_PROTOCOL, type: "presentation_delta",
    delta: { seq: evt.seq, changes: text ? { mechanics: [{ seq: evt.seq, kind: "mutation", text }] } : {} },
  };
}
```

> `outcome` 串语义("success"/"fail"/band-label)与明骰 §6 一致；前端只作展示/动效，不据其判真值。

- [ ] **Step 4: 跑测试 + typecheck**

Run: `npm run test -w @dicelore/orchestrator -- notify && npm run typecheck -w @dicelore/orchestrator`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add apps/orchestrator/src/live/notify.ts apps/orchestrator/src/live/notify.test.ts
git commit -m "feat(orchestrator): notify 映射(CanonWriteEvent→roll_committed/presentation_delta)"
```

---

### Task 6: orchestrator `live/ws.ts`（WsHub：每 session 连接集合 + 广播）

**Files:**
- Create: `apps/orchestrator/src/live/ws.ts`
- Test: `apps/orchestrator/src/live/ws.test.ts`

**Interfaces:**
- Produces:
  - `interface WsLike { send(data: string): void; readyState: number }`
  - `class WsHub { add(sessionId, ws): void; remove(sessionId, ws): void; broadcast(sessionId, msg: StreamMessage): void }`

- [ ] **Step 1: 先写失败测试 `live/ws.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { WsHub } from "./ws.js";
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";

function fakeWs() { const sent: string[] = []; return { sent, send: (d: string) => sent.push(d), readyState: 1 }; }
const msg: StreamMessage = { protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId: "t1", seq: 5 };

describe("WsHub", () => {
  it("广播到该 session 的所有连接，序列化为 JSON", () => {
    const hub = new WsHub();
    const a = fakeWs(), b = fakeWs();
    hub.add("s1", a); hub.add("s1", b);
    hub.broadcast("s1", msg);
    expect(JSON.parse(a.sent[0]).type).toBe("turn_ended");
    expect(b.sent.length).toBe(1);
  });

  it("不串台到别的 session；remove 后不再收", () => {
    const hub = new WsHub();
    const a = fakeWs(), other = fakeWs();
    hub.add("s1", a); hub.add("s2", other);
    hub.remove("s1", a);
    hub.broadcast("s1", msg);
    expect(a.sent.length).toBe(0);
    expect(other.sent.length).toBe(0);
  });

  it("跳过非 OPEN(readyState!=1)的连接", () => {
    const hub = new WsHub();
    const closed = { sent: [] as string[], send(d: string) { this.sent.push(d); }, readyState: 3 };
    hub.add("s1", closed);
    hub.broadcast("s1", msg);
    expect(closed.sent.length).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败 → Step 3 实现 `live/ws.ts`**

```ts
import type { StreamMessage } from "@dicelore/shared";

export interface WsLike { send(data: string): void; readyState: number }
const OPEN = 1;

export class WsHub {
  private bySession = new Map<string, Set<WsLike>>();
  add(sessionId: string, ws: WsLike): void {
    let set = this.bySession.get(sessionId);
    if (!set) { set = new Set(); this.bySession.set(sessionId, set); }
    set.add(ws);
  }
  remove(sessionId: string, ws: WsLike): void {
    this.bySession.get(sessionId)?.delete(ws);
  }
  broadcast(sessionId: string, msg: StreamMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.bySession.get(sessionId) ?? []) {
      if (ws.readyState === OPEN) ws.send(data);
    }
  }
}
```

- [ ] **Step 4: 跑测试 + typecheck → Step 5: Commit**

Run: `npm run test -w @dicelore/orchestrator -- ws && npm run typecheck -w @dicelore/orchestrator`
```bash
git add apps/orchestrator/src/live/ws.ts apps/orchestrator/src/live/ws.test.ts
git commit -m "feat(orchestrator): WsHub(每 session 连接集合 + JSON 广播)"
```

---

### Task 7: orchestrator `live/rollGate.ts`（单人明骰 gate）

实现 `RollGate = (eventId) => Promise<void>`：被 core handler `await` 时读 `getPendingRoll` 规格、经 WsHub 推 `roll_staged`、挂起 promise；`POST /roll` 调 `resolveRoll(eventId)` 解开。

**Files:**
- Create: `apps/orchestrator/src/live/rollGate.ts`
- Test: `apps/orchestrator/src/live/rollGate.test.ts`

**Interfaces:**
- Consumes: `@dicelore/core`（`getPendingRoll`, `type DB`, `type RollGate`）、`@dicelore/shared`（`PendingRoll`, `StreamMessage`, `CLIENT_PROTOCOL`）、Task 6 `WsHub`。
- Produces: `class PlayerRollGate { gate: RollGate; resolveRoll(eventId: number): boolean; pendingSpec(eventId): PendingRoll | null }`

> 注：`getPendingRoll` 须在 core barrel 导出。**若未导出**，本任务追加一步在 `packages/core/src/index.ts` 加 `export { getPendingRoll, type PendingRollRow } from "./store/pendingRoll.js";`（additive）+ 提交。

- [ ] **Step 1: 先写失败测试 `live/rollGate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "@dicelore/core";
import { stagePendingRoll } from "@dicelore/core"; // 若未导出，本任务补 barrel 导出
import { WsHub } from "./ws.js";
import { PlayerRollGate } from "./rollGate.js";

describe("PlayerRollGate(单人)", () => {
  it("gate 挂起 + roll_staged 弹卡；resolveRoll 解开 promise", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub();
    const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const eventId = stagePendingRoll(db, { shape: "contest", spec: { context: "说服", a: { name: "张三", expr: "1d20+5" }, b: { name: "DC", expr: "15" } } });

    const g = new PlayerRollGate(db, hub, "s1");
    let resolved = false;
    const p = g.gate(eventId).then(() => { resolved = true; });
    await Promise.resolve();
    expect(sent[0].type).toBe("roll_staged");
    expect(sent[0].pendingRoll.eventId).toBe(eventId);
    expect(resolved).toBe(false);

    expect(g.resolveRoll(eventId)).toBe(true);
    await p;
    expect(resolved).toBe(true);
  });

  it("resolveRoll 对未知 eventId 返回 false", () => {
    const db = openDb(":memory:"); initSchema(db);
    const g = new PlayerRollGate(db, new WsHub(), "s1");
    expect(g.resolveRoll(999)).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败 → Step 3 实现 `live/rollGate.ts`**

```ts
import { getPendingRoll, type DB, type RollGate } from "@dicelore/core";
import { CLIENT_PROTOCOL, type PendingRoll, type StreamMessage } from "@dicelore/shared";
import type { WsHub } from "./ws.js";

// core PendingRollRow.spec → 线上 PendingRoll(只含规格)。
function toPendingRoll(eventId: number, row: { shape: "outcome" | "contest"; spec: any }): PendingRoll {
  const s = row.spec;
  if (row.shape === "outcome") {
    return { eventId, shape: "outcome", label: s.context,
      yourSide: { name: "你", exprDisplay: s.die ?? "" },
      bands: (s.bands ?? []).map((b: any) => ({ label: b.label ?? "", min: b.min, max: b.max })) };
  }
  return { eventId, shape: "contest", label: s.context,
    yourSide: { name: s.a?.name ?? "你", exprDisplay: s.a?.expr ?? "" },
    dc: Number.isFinite(Number(s.b?.expr)) ? Number(s.b.expr) : undefined };
}

export class PlayerRollGate {
  private waiters = new Map<number, () => void>();
  constructor(private db: DB, private hub: WsHub, private sessionId: string) {}

  // 注入给 createMcpServer(deps.rollGate)。core handler 调 await gate(eventId)。
  gate: RollGate = (eventId: number) =>
    new Promise<void>((resolve) => {
      const row = getPendingRoll(this.db, eventId);
      if (row) {
        const msg: StreamMessage = { protocol: CLIENT_PROTOCOL, type: "roll_staged", pendingRoll: toPendingRoll(eventId, row as any) };
        this.hub.broadcast(this.sessionId, msg);
      }
      this.waiters.set(eventId, resolve);
    });

  // POST /roll 调用：解开对应 gate。core handler 续跑 commitPendingRoll。
  resolveRoll(eventId: number): boolean {
    const w = this.waiters.get(eventId);
    if (!w) return false;
    this.waiters.delete(eventId);
    w();
    return true;
  }

  pendingSpec(eventId: number): PendingRoll | null {
    const row = getPendingRoll(this.db, eventId);
    return row ? toPendingRoll(eventId, row as any) : null;
  }
}
```

- [ ] **Step 4: 跑测试 + typecheck → Step 5: Commit**

Run: `npm run test -w @dicelore/orchestrator -- rollGate && npm run typecheck -w @dicelore/orchestrator`
```bash
git add apps/orchestrator/src/live/rollGate.ts apps/orchestrator/src/live/rollGate.test.ts packages/core/src/index.ts
git commit -m "feat(orchestrator): 单人 PlayerRollGate(staged→roll_staged + resolveRoll 解阻塞)"
```

---

### Task 8: orchestrator `live/turnLoop.ts`（消费 GmDriver 事件 → 广播 + turn-end hook）

**Files:**
- Create: `apps/orchestrator/src/live/turnLoop.ts`
- Test: `apps/orchestrator/src/live/turnLoop.test.ts`

**Interfaces:**
- Consumes: `GmDriver`/`TurnEvent`、`WsHub`、`@dicelore/shared`（`StreamMessage`/`CLIENT_PROTOCOL`）、`@dicelore/core`（`type DB`、`buildPresentationModel` 或既有 `runTurnEnd`——见注）。
- Produces: `async function runTurn(deps: { db: DB; driver: GmDriver; hub: WsHub; sessionId: string; turnId: string; runTurnEnd: (db: DB) => { choices?: { eventId: number; options: {index:number;label:string;consequence:string}[] } } }, input: TurnInput): Promise<void>`

> turn-end hook 复用组件4 `runTurnEnd`（`packages/core/src/adapter/turnEnd.ts`）。该函数现签名 `runTurnEnd(db, {transcriptHasText, stopHookActive})` 返回 `{block?}` 并物化 choice。本任务以**注入** `runTurnEnd` 依赖（便于测试），SessionHost(Task 9)传入真实包装：调用 core turnEnd 后从 db 读最新 `kind=choice` event 投影成 choices。为不改 core，choices 投影用 `buildPresentationModel(db).pendingChoice`（已有）映射。

- [ ] **Step 1: 先写失败测试 `live/turnLoop.test.ts`**（用 Fake 驱动 + fake hook，纯逻辑）

```ts
import { describe, it, expect } from "vitest";
import { runTurn } from "./turnLoop.js";
import { FakeGmDriver } from "../gm/FakeGmDriver.js";
import { WsHub } from "./ws.js";
import { openDb, initSchema } from "@dicelore/core";

function capture() { const msgs: any[] = []; const hub = new WsHub();
  hub.add("s1", { send: (d: string) => msgs.push(JSON.parse(d)), readyState: 1 }); return { hub, msgs }; }

describe("runTurn", () => {
  it("narration → narration_commit；末尾发 turn_ended", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const { hub, msgs } = capture();
    await runTurn({ db, driver: new FakeGmDriver([{ type: "narration", text: "你推门进去。" }, { type: "turn_end" }]),
      hub, sessionId: "s1", turnId: "t1", runTurnEnd: () => ({}) }, { text: "我推门" });
    const types = msgs.map((m) => m.type);
    expect(types).toContain("narration_commit");
    expect(types).toContain("turn_ended");
  });

  it("turn-end 产 choices → 发 choices 消息", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const { hub, msgs } = capture();
    await runTurn({ db, driver: new FakeGmDriver([{ type: "turn_end" }]), hub, sessionId: "s1", turnId: "t1",
      runTurnEnd: () => ({ choices: { eventId: 9, options: [{ index: 0, label: "推门", consequence: "惊动" }] } }) }, { text: "x" });
    const choices = msgs.find((m) => m.type === "choices");
    expect(choices?.choices.eventId).toBe(9);
  });

  it("error 事件 → 发 error 消息", async () => {
    const db = openDb(":memory:"); initSchema(db);
    const { hub, msgs } = capture();
    await runTurn({ db, driver: new FakeGmDriver([{ type: "error", message: "boom" }]), hub, sessionId: "s1", turnId: "t1",
      runTurnEnd: () => ({}) }, { text: "x" });
    expect(msgs.find((m) => m.type === "error")?.message).toBe("boom");
  });
});
```

- [ ] **Step 2: 跑测试确认失败 → Step 3 实现 `live/turnLoop.ts`**

```ts
import type { DB } from "@dicelore/core";
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { GmDriver, TurnInput } from "../gm/GmDriver.js";
import type { WsHub } from "./ws.js";

export interface TurnEndResult {
  choices?: { eventId: number; options: { index: number; label: string; consequence: string }[] };
}
export interface RunTurnDeps {
  db: DB;
  driver: GmDriver;
  hub: WsHub;
  sessionId: string;
  turnId: string;
  runTurnEnd: (db: DB) => TurnEndResult;
}

export async function runTurn(deps: RunTurnDeps, input: TurnInput): Promise<void> {
  const { hub, sessionId, turnId } = deps;
  const send = (m: StreamMessage) => hub.broadcast(sessionId, m);
  send({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId });

  let seq = 0;
  try {
    for await (const ev of deps.driver.runTurn(input)) {
      if (ev.type === "narration") {
        seq += 1;
        send({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq, text: ev.text });
      } else if (ev.type === "error") {
        send({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_error", message: ev.message });
        return;
      } else if (ev.type === "turn_end") {
        break;
      }
    }
  } catch (e) {
    send({ protocol: CLIENT_PROTOCOL, type: "error", code: "driver_error", message: e instanceof Error ? e.message : String(e) });
    return;
  }

  // 回合末：turn-end hook(choice 物化 + L3)；产出 choices 则推。
  const res = deps.runTurnEnd(deps.db);
  if (res.choices) {
    send({ protocol: CLIENT_PROTOCOL, type: "choices", choices: res.choices });
  }
  send({ protocol: CLIENT_PROTOCOL, type: "turn_ended", turnId, seq });
}
```

> 呈现增量(`presentation_delta`)由 createMcpServer 的 `onCanonWrite` 在工具执行时**异步**经 SessionHost→hub 发出(Task 9 接线)，不在 turnLoop 内同步发——故 turnLoop 只管 narration/choices/turn 生命周期/error。

- [ ] **Step 4: 跑测试 + typecheck → Step 5: Commit**

Run: `npm run test -w @dicelore/orchestrator -- turnLoop && npm run typecheck -w @dicelore/orchestrator`
```bash
git add apps/orchestrator/src/live/turnLoop.ts apps/orchestrator/src/live/turnLoop.test.ts
git commit -m "feat(orchestrator): turnLoop(narration_commit/choices/turn_ended/error 广播)"
```

---

### Task 9: orchestrator `session/SessionHost` + `registry` + buildSnapshot 补 pendingRoll

把 db + `createMcpServer(deps)` + GmDriver + `PlayerRollGate` + WsHub + turn-end hook 接成每 session 的宿主；registry 懒建。并补 `buildSnapshot` 的 `pendingRoll` 字段（Task 3 契约要求）。

**Files:**
- Create: `apps/orchestrator/src/session/SessionHost.ts`
- Create: `apps/orchestrator/src/session/registry.ts`
- Modify: `apps/orchestrator/src/presentation.ts`（buildSnapshot 加 `pendingRoll`）
- Test: `apps/orchestrator/src/session/SessionHost.test.ts`、`apps/orchestrator/src/presentation.test.ts`（追加）

**Interfaces:**
- Consumes: `@dicelore/core`（`createMcpServer`/`openDb`/`initSchema`/`DB`/`buildPresentationModel`）、组件4 `runTurnEnd`（`packages/core/src/adapter/turnEnd.ts`——经 barrel 或深 import；若未导出则本任务 additive 加 barrel 导出）、Task 4/6/7/8。
- Produces:
  - `class SessionHost { db; hub; gate: PlayerRollGate; mcpServer; handleMessage(text): Promise<{turnId}>; handleRoll(eventId): boolean; attachWs(ws); detachWs(ws) }`，构造 `new SessionHost(sessionId, db, driverFactory)`。
  - `registry`: `getOrCreateHost(sessionId, deps): SessionHost`、`getHost(sessionId): SessionHost | undefined`

- [ ] **Step 1: buildSnapshot 加 pendingRoll —— 先追加失败测试到 `presentation.test.ts`**

```ts
it("snapshot 含 pendingRoll(默认 null)", () => {
  const db = openDb(":memory:"); initSchema(db);
  const snap = buildSnapshot(db, "s1");
  expect(snap.pendingRoll).toBeNull();
});
```

实现：`buildSnapshot` 返回对象加 `pendingRoll: pendingRollOf(db)`，其中 `pendingRollOf` 读 `getPendingRoll`/最新 awaiting 槽（无则 null）。最小实现先 `pendingRoll: null`（明骰 awaiting 的真实投影由 gate 的 roll_staged 推，首屏快照 Phase 1 置 null 可接受）；**为通过 Task 3 schema，必须有该字段**。

- [ ] **Step 2: 先写失败测试 `session/SessionHost.test.ts`（FakeGmDriver + 内存 db，不烧 LLM）**

```ts
import { describe, it, expect } from "vitest";
import { SessionHost } from "./SessionHost.js";
import { FakeGmDriver } from "../gm/FakeGmDriver.js";

describe("SessionHost", () => {
  it("handleMessage 跑一回合：WS 收到 turn_started…turn_ended", async () => {
    const host = new SessionHost("s1", { driverFactory: () => new FakeGmDriver([{ type: "narration", text: "门开了。" }, { type: "turn_end" }]) });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const { turnId } = await host.handleMessage("我推门");
    const types = sent.map((m) => m.type);
    expect(turnId).toBeTruthy();
    expect(types[0]).toBe("turn_started");
    expect(types).toContain("narration_commit");
    expect(types.at(-1)).toBe("turn_ended");
  });

  it("onCanonWrite 经 hub 推 presentation_delta", async () => {
    // 驱动里不直接触发工具；改为直接调 host 暴露的 onCanonWrite(供测试) 验证接线
    const host = new SessionHost("s1", { driverFactory: () => new FakeGmDriver([{ type: "turn_end" }]) });
    const sent: any[] = [];
    host.attachWs({ send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    host.onCanonWrite({ kind: "mutation", seq: 7, toolName: "sheet_update", output: {} });
    expect(sent.find((m) => m.type === "presentation_delta")?.delta.seq).toBe(7);
  });
});
```

- [ ] **Step 3: 跑测试确认失败 → Step 4 实现 `session/SessionHost.ts`**

```ts
import { openDb, initSchema, createMcpServer, type DB } from "@dicelore/core";
import { buildPresentationModel } from "@dicelore/core";
import { runTurnEnd } from "@dicelore/core"; // 若未从 barrel 导出，本任务 additive 加
import type { CanonWriteEvent } from "@dicelore/core";
import { WsHub, type WsLike } from "../live/ws.js";
import { PlayerRollGate } from "../live/rollGate.js";
import { mapCanonWrite } from "../live/notify.js";
import { runTurn, type TurnEndResult } from "../live/turnLoop.js";
import type { GmDriver } from "../gm/GmDriver.js";

let turnCounter = 0; // 进程内自增；测试稳定(不依赖随机/时间)
function nextTurnId(sessionId: string): string { turnCounter += 1; return `${sessionId}-t${turnCounter}`; }

export interface SessionHostDeps {
  db?: DB;                              // 省略则内存库(测试)
  driverFactory: () => GmDriver;        // 每回合产一个 driver(真实现包 Agent SDK)
}

export class SessionHost {
  readonly db: DB;
  readonly hub = new WsHub();
  readonly gate: PlayerRollGate;
  readonly mcpServer;
  constructor(public sessionId: string, private deps: SessionHostDeps) {
    this.db = deps.db ?? (() => { const d = openDb(":memory:"); initSchema(d); return d; })();
    this.gate = new PlayerRollGate(this.db, this.hub, sessionId);
    // in-process MCP，按实例注入 onCanonWrite + rollGate
    this.mcpServer = createMcpServer(this.db, {
      onCanonWrite: (e) => this.onCanonWrite(e),
      rollGate: this.gate.gate,
    });
  }

  onCanonWrite(evt: CanonWriteEvent): void {
    const msg = mapCanonWrite(evt);
    if (msg) this.hub.broadcast(this.sessionId, msg);
  }

  attachWs(ws: WsLike): void { this.hub.add(this.sessionId, ws); }
  detachWs(ws: WsLike): void { this.hub.remove(this.sessionId, ws); }

  async handleMessage(text: string): Promise<{ turnId: string }> {
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.driverFactory();
    await runTurn({ db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId,
      runTurnEnd: (db) => this.runTurnEnd(db) }, { text });
    return { turnId };
  }

  handleRoll(eventId: number): boolean { return this.gate.resolveRoll(eventId); }

  private runTurnEnd(db: DB): TurnEndResult {
    runTurnEnd(db, { transcriptHasText: true, stopHookActive: false }); // 物化 choice + L3
    const pc = buildPresentationModel(db, { turnStartSeq: 0 }).pendingChoice;
    if (!pc) return {};
    return { choices: { eventId: pc.seq, options: pc.options.map((o, index) => ({ index, label: o.label, consequence: o.consequence })) } };
  }
}
```

> `runTurnEnd` 若不在 core barrel：本任务在 `packages/core/src/index.ts` 加 `export { runTurnEnd } from "./adapter/turnEnd.js";`（additive）+ 一并提交。其入参 `{transcriptHasText, stopHookActive}` 取自既有签名（[turnEnd.ts](../../../packages/core/src/adapter/turnEnd.ts)）。

- [ ] **Step 5: 写 `session/registry.ts`**

```ts
import { SessionHost, type SessionHostDeps } from "./SessionHost.js";

const hosts = new Map<string, SessionHost>();

export function getOrCreateHost(sessionId: string, deps: SessionHostDeps): SessionHost {
  let h = hosts.get(sessionId);
  if (!h) { h = new SessionHost(sessionId, deps); hosts.set(sessionId, h); }
  return h;
}
export function getHost(sessionId: string): SessionHost | undefined { return hosts.get(sessionId); }
```

- [ ] **Step 6: 跑测试 + typecheck → Step 7: Commit**

Run: `npm run test -w @dicelore/orchestrator && npm run typecheck -w @dicelore/orchestrator`
```bash
git add apps/orchestrator/src/session apps/orchestrator/src/presentation.ts apps/orchestrator/src/presentation.test.ts packages/core/src/index.ts
git commit -m "feat(orchestrator): SessionHost(in-process MCP+gate+hub+turnEnd) + registry + 快照 pendingRoll"
```

---

### Task 10: orchestrator server 扩展（WS 端点 + POST messages/choices/roll）

把 SessionHost 接到 HTTP：动作进 + WS 升级。Hono 处理 REST；WS 用 `ws` 库挂到 `@hono/node-server` 的 http server。GM 驱动用**可注入 driverFactory**（默认 AgentSdkDriver，测试注入 Fake）。

**Files:**
- Modify: `apps/orchestrator/src/server.ts`
- Test: `apps/orchestrator/src/server.live.test.ts`

**Interfaces:**
- Consumes: `getOrCreateHost`/`getHost`、`@dicelore/shared`（`MessageRequestSchema`/`ChoiceRequestSchema`/`RollRequestSchema`）。
- Produces: `createLiveApp(deps: { driverFactory: () => GmDriver }): Hono`（复用现有只读路由 + 新增写路由）；`startServer(port)` 用 `ws` 挂 `/sessions/:id/ws`。

- [ ] **Step 1: 先写失败测试 `server.live.test.ts`（用 Hono `app.request`，注入 FakeGmDriver）**

```ts
import { describe, it, expect } from "vitest";
import { createLiveApp } from "./server.js";
import { FakeGmDriver } from "./gm/FakeGmDriver.js";

describe("orchestrator 动作进", () => {
  it("POST /sessions/:id/messages → 202 {turnId}", async () => {
    const app = createLiveApp({ driverFactory: () => new FakeGmDriver([{ type: "turn_end" }]) });
    const res = await app.request("/sessions/s1/messages", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "我推门" }),
    });
    expect(res.status).toBe(202);
    expect((await res.json()).turnId).toBeTruthy();
  });

  it("POST /sessions/:id/roll → 未有待掷返回 409", async () => {
    const app = createLiveApp({ driverFactory: () => new FakeGmDriver([{ type: "turn_end" }]) });
    // 先建 host
    await app.request("/sessions/s2/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x" }) });
    const res = await app.request("/sessions/s2/roll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: 999 }) });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: 跑测试确认失败 → Step 3 改 `server.ts`（在现有只读 REST 上加写路由 + WS）**

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { openDb, initSchema, type DB } from "@dicelore/core";
import { MessageRequestSchema, ChoiceRequestSchema, RollRequestSchema, type SessionInfo } from "@dicelore/shared";
import { buildSnapshot } from "./presentation.js";
import { getOrCreateHost, getHost } from "./session/registry.js";
import type { GmDriver } from "./gm/GmDriver.js";

export interface LiveDeps { driverFactory: () => GmDriver; openSession?: (id: string) => DB }

export function createLiveApp(deps: LiveDeps): Hono {
  const app = new Hono();
  const hostDeps = (id: string) => ({ db: deps.openSession?.(id), driverFactory: deps.driverFactory });

  // 只读(复用既有)
  app.get("/sessions/:id/presentation", (c) => {
    const id = c.req.param("id");
    const host = getOrCreateHost(id, hostDeps(id));
    return c.json(buildSnapshot(host.db, id));
  });
  app.get("/sessions/:id", (c) => {
    const id = c.req.param("id");
    const info: SessionInfo = { sessionId: id, ended: false, title: id };
    return c.json(info);
  });

  // 动作进
  app.post("/sessions/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = MessageRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    const { turnId } = await host.handleMessage(body.text);
    return c.json({ turnId }, 202);
  });
  app.post("/sessions/:id/choices", async (c) => {
    const id = c.req.param("id");
    const body = ChoiceRequestSchema.parse(await c.req.json());
    const host = getOrCreateHost(id, hostDeps(id));
    // 玩家所选作下一回合输入(以 label 喂回；Phase 1 最小)
    const { turnId } = await host.handleMessage(`[choice ${body.eventId}#${body.optionIndex}]`);
    return c.json({ turnId }, 202);
  });
  app.post("/sessions/:id/roll", async (c) => {
    const id = c.req.param("id");
    const body = RollRequestSchema.parse(await c.req.json());
    const host = getHost(id);
    if (!host || !host.handleRoll(body.eventId)) return c.json({ code: "no_pending_roll" }, 409);
    return c.json({ turnId: id }, 202);
  });

  return app;
}

export function startServer(port: number): void {
  // 真实现：driverFactory 用 AgentSdkDriver(Task 11)；此处接线见 Task 11 Step。
  throw new Error("startServer 在 Task 11 接 AgentSdkDriver 后启用");
}
```

> WS 端点：`startServer` 用 `serve({ fetch: app.fetch, port })` 拿到 http server，再 `new WebSocketServer({ server, path 匹配 /sessions/:id/ws })`，连接时解析 sessionId → `getOrCreateHost(id).attachWs(ws)`、`ws.on("close", () => host.detachWs(ws))`。该接线随 Task 11 的真实 startServer 一并落（无 LLM 的 WS 单测用 WsHub 已覆盖；端到端 WS 由 Task 13 webapp-testing 验）。

- [ ] **Step 4: 跑测试 + typecheck → Step 5: Commit**

Run: `npm run test -w @dicelore/orchestrator -- server.live && npm run typecheck -w @dicelore/orchestrator`
```bash
git add apps/orchestrator/src/server.ts apps/orchestrator/src/server.live.test.ts
git commit -m "feat(orchestrator): 动作进 REST(POST messages/choices/roll) + 注入 driverFactory"
```

---

### Task 11: orchestrator `AgentSdkDriver`（真 Agent SDK，opt-in 集成）+ startServer 接线

包 `@anthropic-ai/claude-agent-sdk` 的 `query()`：in-process 挂 dicelore MCP（`{ type:"sdk", name:"dicelore", instance: host.mcpServer }`）+ 三 hook + 鉴权 env。**不进单测**（烧 LLM）；带 `RUN_LIVE=1` 守卫的集成冒烟。

**Files:**
- Create: `apps/orchestrator/src/gm/AgentSdkDriver.ts`
- Create: `apps/orchestrator/src/gm/AgentSdkDriver.live.test.ts`（`RUN_LIVE` 守卫）
- Create: `apps/orchestrator/.env.example`
- Modify: `apps/orchestrator/src/server.ts`（`startServer` 真实现 + WS 挂载）

**Interfaces:**
- Consumes: `@anthropic-ai/claude-agent-sdk`（`query`）、SessionHost（提供 `mcpServer` 实例与 db 给 hooks）。
- Produces: `class AgentSdkDriver implements GmDriver`（构造接收 `{ mcpServer, model?, hooks? }`）。

- [ ] **Step 1: 写 `AgentSdkDriver.ts`**

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GmDriver, TurnInput, TurnEvent } from "./GmDriver.js";

export interface AgentSdkDriverDeps {
  mcpServer: McpServer;                       // SessionHost 的 in-process MCP
  model?: string;                             // 默认 env DICELORE_GM_MODEL ?? "opus"
  hooks?: Record<string, unknown>;            // SessionStart/UserPromptSubmit/Stop(组件4)
  systemPrompt?: string;                      // gm-core 教条(组件3);Phase 1 可选
}

export class AgentSdkDriver implements GmDriver {
  constructor(private deps: AgentSdkDriverDeps) {}
  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const model = this.deps.model ?? process.env.DICELORE_GM_MODEL ?? "opus";
    try {
      for await (const msg of query({
        prompt: input.text,
        options: {
          model,
          settingSources: [],                 // 不读本地 .claude；MCP/hook/prompt 全显式注入
          mcpServers: { dicelore: { type: "sdk", name: "dicelore", instance: this.deps.mcpServer } },
          hooks: this.deps.hooks as any,
          systemPrompt: this.deps.systemPrompt,
          allowedTools: ["mcp__dicelore"],    // 允许 dicelore 工具族(实际前缀 mcp__dicelore__*)
        } as any,
      })) {
        if (msg.type === "assistant") {
          // narrate 散文经工具写(onCanonWrite 已处理 presentation/roll)；
          // assistant 文本作 narration 兜底(Phase 1 粒度,见设计 §4-A)
          const text = (msg as any).message?.content
            ?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("") ?? "";
          if (text) yield { type: "narration", text };
        } else if (msg.type === "result") {
          break; // 回合结束
        }
      }
      yield { type: "turn_end" };
    } catch (e) {
      yield { type: "error", message: e instanceof Error ? e.message : String(e) };
    }
  }
}
```

> ⚠️ **实现期须按已 fetch 的 Agent SDK TS 参考核对**（`query`/`Options.mcpServers`(`{type:"sdk",name,instance}`)/`hooks`/`SDKMessage` 形状），并验证 `allowedTools` 的 MCP 工具名前缀（`mcp__dicelore__<tool>`）。`hooks` 的 `SessionStart`/`UserPromptSubmit`/`Stop` 回调内调组件4 hook 纯逻辑（`packages/core/src/adapter/hooks/*`）；turn-end 的 choice 物化/L3 也可走 SessionHost.runTurnEnd（二者择一，勿重复物化）。

- [ ] **Step 2: 写 `.env.example`（占位，无真值）**

```
# 沿用 Claude Code 现配(值从 ~/.claude/settings.json 取或自配 relay)
ANTHROPIC_BASE_URL=
ANTHROPIC_AUTH_TOKEN=
DICELORE_GM_MODEL=opus
DICELORE_SESSIONS_DIR=.
PORT=8787
```

- [ ] **Step 3: `startServer` 真实现 + WS 挂载（改 `server.ts`）**

```ts
export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  const openSession = (id: string) => { const db = openDb(`${dir}/${id}.db`); initSchema(db); return db; };
  // driverFactory 在 handleMessage 时按 host 取 mcpServer —— 故改为 host 自建 driver：
  // 简化:driverFactory 闭包捕获 host 不便;此处用 registry 的 host.mcpServer。
  const app = createLiveApp({
    openSession,
    driverFactory: () => { throw new Error("由 SessionHost 注入"); }, // 见注
  });
  const server = serve({ fetch: app.fetch, port });
  const wss = new WebSocketServer({ noServer: true });
  (server as any).on("upgrade", (req: any, socket: any, head: any) => {
    const m = /^\/sessions\/([^/]+)\/ws$/.exec(req.url ?? "");
    if (!m) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const host = getOrCreateHost(m[1], { openSession, driverFactory: () => { throw new Error("x"); } });
      host.attachWs(ws as any);
      ws.on("close", () => host.detachWs(ws as any));
    });
  });
  console.log(`[orchestrator] live :${port}`);
}
if (process.argv[1]?.endsWith("server.ts")) startServer(Number(process.env.PORT ?? 8787));
```

> 接线说明：`driverFactory` 需访问该 host 的 `mcpServer`，故 **SessionHost 改为内部自建 driver**——给 `SessionHostDeps.driverFactory` 传 `(host) => GmDriver`，SessionHost 在 `handleMessage` 调 `this.deps.driverFactory(this)` 并把 `this.mcpServer` 喂给 `AgentSdkDriver`。Task 9 的 `driverFactory: () => GmDriver` 据此微调为 `(host: SessionHost) => GmDriver`（测试里忽略 host 参数，仍传 FakeGmDriver）。**实现 Task 11 时同步改 Task 9 的签名 + 其测试**（FakeGmDriver 不依赖 host，兼容）。生产 `driverFactory = (host) => new AgentSdkDriver({ mcpServer: host.mcpServer, hooks: buildHooks(host.db) })`。

- [ ] **Step 4: 集成冒烟（opt-in，不进 CI）`AgentSdkDriver.live.test.ts`**

```ts
import { describe, it, expect } from "vitest";
const LIVE = process.env.RUN_LIVE === "1";
describe.skipIf(!LIVE)("AgentSdkDriver 真 SDK 冒烟", () => {
  it("跑一个真回合，至少产出 narration 或 turn_end", async () => {
    const { openDb, initSchema, createMcpServer } = await import("@dicelore/core");
    const { AgentSdkDriver } = await import("./AgentSdkDriver.js");
    const db = openDb(":memory:"); initSchema(db);
    const mcpServer = createMcpServer(db, {});
    const drv = new AgentSdkDriver({ mcpServer });
    const got: string[] = [];
    for await (const e of drv.runTurn({ text: "用一句话开场。" })) got.push(e.type);
    expect(got).toContain("turn_end");
  }, 120_000);
});
```

- [ ] **Step 5: typecheck（不跑 live）+ 手动冒烟（可选，带 env）**

Run: `npm run typecheck -w @dicelore/orchestrator`（live 测试 skip）
可选真跑：`RUN_LIVE=1 ANTHROPIC_BASE_URL=… ANTHROPIC_AUTH_TOKEN=… npm run test -w @dicelore/orchestrator -- AgentSdkDriver.live`

- [ ] **Step 6: Commit**

```bash
git add apps/orchestrator/src/gm/AgentSdkDriver.ts apps/orchestrator/src/gm/AgentSdkDriver.live.test.ts apps/orchestrator/.env.example apps/orchestrator/src/server.ts apps/orchestrator/src/session/SessionHost.ts
git commit -m "feat(orchestrator): AgentSdkDriver(in-process MCP+hooks) + startServer WS 挂载"
```

---

### Task 12: orchestrator `recovery.ts`（明骰宕机恢复重驱）

启动扫描每 session db 的 `pending_roll` status=`awaiting` → 经 hub 重弹 `roll_staged`（玩家重连重掷）。Phase 1 提供「扫描 + 重弹」纯函数；「重驱 GM」接 SessionHost.handleMessage（结果作输入）。

**Files:**
- Create: `apps/orchestrator/src/recovery.ts`
- Test: `apps/orchestrator/src/recovery.test.ts`

**Interfaces:**
- Consumes: `@dicelore/core`（`type DB`；扫描 `pending_roll` 用 `db.prepare`）、`PlayerRollGate.pendingSpec`、`WsHub`。
- Produces: `function restagePendingRolls(host: { db: DB; gate: PlayerRollGate; hub: WsHub; sessionId: string }): number`（返回重弹数）

- [ ] **Step 1: 先写失败测试 `recovery.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema, stagePendingRoll } from "@dicelore/core";
import { WsHub } from "./live/ws.js";
import { PlayerRollGate } from "./live/rollGate.js";
import { restagePendingRolls } from "./recovery.js";

describe("restagePendingRolls", () => {
  it("对 awaiting 的 pending_roll 重弹 roll_staged", () => {
    const db = openDb(":memory:"); initSchema(db);
    stagePendingRoll(db, { shape: "outcome", spec: { context: "撬锁", die: "1d100", bands: [{ label: "成功", min: 1, max: 60 }] } });
    const hub = new WsHub(); const sent: any[] = [];
    hub.add("s1", { send: (d: string) => sent.push(JSON.parse(d)), readyState: 1 });
    const gate = new PlayerRollGate(db, hub, "s1");
    const n = restagePendingRolls({ db, gate, hub, sessionId: "s1" });
    expect(n).toBe(1);
    expect(sent[0].type).toBe("roll_staged");
  });

  it("无 awaiting 时返回 0、不发消息", () => {
    const db = openDb(":memory:"); initSchema(db);
    const hub = new WsHub();
    const gate = new PlayerRollGate(db, hub, "s1");
    expect(restagePendingRolls({ db, gate, hub, sessionId: "s1" })).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败 → Step 3 实现 `recovery.ts`**

```ts
import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { DB } from "@dicelore/core";
import type { PlayerRollGate } from "./live/rollGate.js";
import type { WsHub } from "./live/ws.js";

export function restagePendingRolls(host: { db: DB; gate: PlayerRollGate; hub: WsHub; sessionId: string }): number {
  const rows = host.db.prepare("SELECT id FROM pending_roll WHERE status='awaiting'").all() as { id: number }[];
  let n = 0;
  for (const r of rows) {
    const spec = host.gate.pendingSpec(r.id);
    if (!spec) continue;
    const msg: StreamMessage = { protocol: CLIENT_PROTOCOL, type: "roll_staged", pendingRoll: spec };
    host.hub.broadcast(host.sessionId, msg);
    n += 1;
  }
  return n;
}
```

> `pending_roll` 表名/列名(`id`/`status`)以 [pendingRoll.ts](../../../packages/core/src/store/pendingRoll.ts) 实际为准——实现时核对(可能是 `eventId` 而非 `id`、或 `seq_staged`)。「重驱 GM」：恢复路玩家点击后，`POST /roll` 解 gate 若无活跃 waiter（进程已重启、handler 不在），则 SessionHost 改走 `commitPendingRoll` + 把结果作 `handleMessage` 输入重驱（[明骰 §5](../specs/2026-06-21-player-gated-roll-design.md)）——本步在 SessionHost.handleRoll 加 fallback：`resolveRoll` 返回 false 且存在 awaiting 槽时，commit + 重驱。

- [ ] **Step 4: 跑测试 + typecheck → Step 5: Commit**

Run: `npm run test -w @dicelore/orchestrator -- recovery && npm run typecheck -w @dicelore/orchestrator`
```bash
git add apps/orchestrator/src/recovery.ts apps/orchestrator/src/recovery.test.ts
git commit -m "feat(orchestrator): 明骰宕机恢复(restagePendingRolls 重弹 roll_staged)"
```

---

### Task 13: web 实时接线（WS 客户端 + RollCard + PlayPage）

PlayPage 接 WS：流式 narration / presentation_delta(触发 refetch) / choices / roll_staged(弹 RollCard) / roll_committed(动效+回显)。RollCard 点击 → `POST /roll`。

**Files:**
- Modify: `apps/web/src/api/client.ts`（加 `postMessage`/`postRoll`）
- Create: `apps/web/src/live/useSession.ts`
- Create: `apps/web/src/play/RollCard.tsx`、`apps/web/src/play/RollCard.test.tsx`
- Modify: `apps/web/src/pages/PlayPage.tsx`
- Test: `apps/web/src/live/useSession.test.tsx`

**Interfaces:**
- Consumes: `@dicelore/shared`（`StreamMessage`/`PendingRoll`/`PresentationSnapshot`）、Vite WS 代理。
- Produces: `useSession(sessionId)` → `{ snapshot, narration, pendingRoll, postMessage, roll }`；`<RollCard pendingRoll onRoll>`。

- [ ] **Step 1: client.ts 加 postMessage/postRoll（先补 vitest mock 测试）**

追加到 `apps/web/src/api/client.test.ts`：

```ts
import { postRoll } from "./client.js";
it("postRoll 命中 /sessions/:id/roll", async () => {
  const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t" }) });
  vi.stubGlobal("fetch", f);
  await postRoll("s1", 12);
  expect(f).toHaveBeenCalledWith("/sessions/s1/roll", expect.objectContaining({ method: "POST" }));
});
```

实现（client.ts 追加）：

```ts
export async function postMessage(sessionId: string, text: string): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/messages`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(`message ${res.status}`);
  return res.json();
}
export async function postRoll(sessionId: string, eventId: number): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/roll`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId }) });
  if (!res.ok) throw new Error(`roll ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: RollCard —— 先写失败测试 `play/RollCard.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { RollCard } from "./RollCard.js";
import type { PendingRoll } from "@dicelore/shared";

const pr: PendingRoll = { eventId: 12, shape: "contest", label: "说服守卫",
  yourSide: { name: "张三", exprDisplay: "1d20+{说服}" }, dc: 15 };

it("亮 DC/exprDisplay + 点[掷骰]回调 eventId", () => {
  const onRoll = vi.fn();
  render(<RollCard pendingRoll={pr} onRoll={onRoll} />);
  expect(screen.getByText(/1d20\+\{说服\}/)).toBeInTheDocument();
  expect(screen.getByText(/15/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /掷骰/ }));
  expect(onRoll).toHaveBeenCalledWith(12);
});
```

实现 `play/RollCard.tsx`（墨金 token，最小，无 BG3 动效）：

```tsx
import type { PendingRoll } from "@dicelore/shared";

export function RollCard({ pendingRoll, onRoll }: { pendingRoll: PendingRoll; onRoll: (eventId: number) => void }) {
  const p = pendingRoll;
  return (
    <div className="rollcard" style={{ border: "1px solid var(--acc)", borderRadius: 8, padding: 12, background: "var(--surface2)" }}>
      <div style={{ fontFamily: "var(--font-display)", color: "var(--acc-soft)" }}>{p.label}</div>
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
        {p.yourSide.name}：{p.yourSide.exprDisplay}{p.dc != null ? ` vs DC ${p.dc}` : ""}
      </div>
      {p.bands?.map((b) => (
        <div key={b.label} style={{ fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{b.label}：{b.min}–{b.max}</div>
      ))}
      <button onClick={() => onRoll(p.eventId)}
        style={{ marginTop: 8, padding: "8px 16px", background: "var(--acc)", color: "var(--acc-on)", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
        丢骰子 d{p.shape === "outcome" ? "100" : "20"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: useSession —— 先写失败测试 `live/useSession.test.tsx`**（mock WebSocket，验消息分发）

```tsx
import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { useSession } from "./useSession.js";
import { CLIENT_PROTOCOL } from "@dicelore/shared";

class FakeWS { onmessage: any; onopen: any; readyState = 1; sent: string[] = [];
  constructor(public url: string) { setTimeout(() => this.onopen?.(), 0); }
  send(d: string) { this.sent.push(d); } close() {}
  emit(msg: any) { this.onmessage?.({ data: JSON.stringify(msg) }); } }

it("收到 narration_commit 累积叙事；roll_staged 置 pendingRoll", async () => {
  const instances: FakeWS[] = [];
  vi.stubGlobal("WebSocket", class extends FakeWS { constructor(u: string) { super(u); instances.push(this); } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) }));
  const { result } = renderHook(() => useSession("s1"));
  await act(async () => { await Promise.resolve(); });
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 1, text: "门开了。" }); });
  expect(result.current.narration.join("")).toContain("门开了。");
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_staged",
    pendingRoll: { eventId: 5, shape: "outcome", label: "撬锁", yourSide: { name: "你", exprDisplay: "1d100" }, bands: [] } }); });
  expect(result.current.pendingRoll?.eventId).toBe(5);
});
```

实现 `live/useSession.ts`（连 WS、分发、presentation_delta→refetch、roll_committed→清 pendingRoll）：

```ts
import { useEffect, useRef, useState, useCallback } from "react";
import type { PresentationSnapshot, PendingRoll, StreamMessage } from "@dicelore/shared";
import { getPresentation, postMessage as apiPostMessage, postRoll as apiPostRoll } from "../api/client.js";

export function useSession(sessionId: string) {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);
  const [narration, setNarration] = useState<string[]>([]);
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const refetch = useCallback(() => { getPresentation(sessionId).then(setSnapshot).catch(() => {}); }, [sessionId]);

  useEffect(() => {
    refetch();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/sessions/${encodeURIComponent(sessionId)}/ws`);
    wsRef.current = ws;
    ws.onmessage = (e: MessageEvent) => {
      const msg = JSON.parse(e.data) as StreamMessage;
      switch (msg.type) {
        case "narration_commit": setNarration((n) => [...n, msg.text]); break;
        case "presentation_delta": refetch(); break;          // 拉全量对账(Phase 1)
        case "choices": refetch(); break;
        case "roll_staged": setPendingRoll(msg.pendingRoll); break;
        case "roll_committed": setPendingRoll(null); refetch(); break;
        default: break;
      }
    };
    return () => ws.close();
  }, [sessionId, refetch]);

  const postMessage = useCallback((text: string) => apiPostMessage(sessionId, text), [sessionId]);
  const roll = useCallback((eventId: number) => apiPostRoll(sessionId, eventId), [sessionId]);
  return { snapshot, narration, pendingRoll, postMessage, roll };
}
```

- [ ] **Step 4: 改 PlayPage 用 useSession（叙事流 + 呈现台 + 掷骰卡 + 输入框）**

PlayPage 用 `useSession("demo")`：中央区渲染 `narration` 段落 + 一个输入框（回车 `postMessage`）；`pendingRoll` 非空时打字区换成 `<RollCard pendingRoll onRoll={roll} />`；呈现台 `<PresentationStage snapshot={snapshot} />`（已存在）。保留既有 `aria-label="活动轨"/"呈现台"`（App.test 依赖）。

> 给 PlayPage.test.tsx 的 mock 从 `getPresentation` 扩展到 `vi.mock("../live/useSession.js")` 返回固定 `{snapshot, narration:[], pendingRoll:null, postMessage:vi.fn(), roll:vi.fn()}`，保留三栏断言。

- [ ] **Step 5: 跑 web 全测 + typecheck**

Run: `npm run test -w @dicelore/web && npm run typecheck -w @dicelore/web`
Expected: 全绿（含新 RollCard/useSession/client；App/PlayPage 既有用例仍过）。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): WS 实时接线(useSession) + BG3 掷骰卡 + PlayPage 流式叙事/呈现/掷骰"
```

---

## Self-Review

**Spec 覆盖**：设计 §2 模块（core 工厂/onCanonWrite=T1-2、orchestrator gm/live/session/recovery/server=T4-12、web=T13）· §3 接缝（McpServerDeps=T1、GmDriver=T4、明骰 gate=T7）· §4 数据流（turnLoop=T8、onCanonWrite→delta=T5+T9）· §4b 明骰流（T7 gate + T10 POST /roll + T9 SessionHost commit 接续 + T13 RollCard）· §5 错误（turnLoop error 广播=T8、宕机恢复=T12）· §6 鉴权（AgentSdkDriver env + .env.example=T11）· §7 测试（FakeGmDriver 全程不烧 LLM=T4,8,9,10；live opt-in=T11）。明骰契约（pendingRoll/roll_staged/roll_committed/POST roll）=T3。

**占位扫描**：无 TBD。多处「实现时核对真实名」注解（CANON_KIND 工具名、pending_roll 列名、Agent SDK API、runTurnEnd/getPendingRoll 是否在 barrel）——这些是**对既有 core 真实符号的核对指令**（非占位），因为本计划不改 core、须贴合其现状；每处都给了 grep/文件定位与 fallback（additive barrel 导出）。

**类型一致**：`CanonWriteEvent`/`McpServerDeps`（T1）↔ SessionHost 注入（T9）一致；`GmDriver`/`TurnEvent`（T4）↔ FakeGmDriver/AgentSdkDriver/turnLoop 一致；`PlayerRollGate.gate: RollGate`（T7）↔ `createMcpServer(deps.rollGate)`（T1）一致；`StreamMessage` 判别（T3）↔ notify（T5）/turnLoop（T8）/ws（T6）/useSession（T13）一致；`PendingRoll`（T3）↔ rollGate/recovery/RollCard 一致；`buildSnapshot` 加 `pendingRoll`（T9）满足 T3 schema。

**已知风险（执行时验证）**：① Agent SDK `query`/in-process mount/hooks 形状——已 fetch 参考，T11 标核对；② core 工具真实名与 `pending_roll` schema——T1/T12 标 grep 核对；③ `driverFactory` 需 host.mcpServer——T11 Step 3 显式回改 T9 签名为 `(host)=>GmDriver`。

## Execution Handoff

见对话——先画 DAG，再分批执行。