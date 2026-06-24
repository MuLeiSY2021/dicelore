# 教条接入 + eval 入口（CC 经 play-mcp 连后端）实现 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 真 GM 接 gm-core skill + 建 play-mcp（CC 经它连真后端 play 接口 eval）+ F2 终局观测。

**Architecture:** CC 经新 stdio MCP（play-mcp）调后端 play HTTP，当玩家+评估者；后端 env `DICELORE_BASELINE` 切 baseline（去教条）；F2 从 presentation.ended 观测。不建 in-process harness。

**Tech Stack:** @modelcontextprotocol/sdk（stdio McpServer）、Hono（后端 HTTP）、vitest、@dicelore/core（prepareSessionDb/grade）。

## Global Constraints

- 单向依赖 core→orchestrator 不破；play-mcp 落 `apps/orchestrator/eval/`，import `@dicelore/core`。
- worktree 内 scoped `git add <精确路径>`，别 `-A`（npm lock 坑）；git `--no-pager`。
- orchestrator tsconfig `include:["src"]`——可测模块落 `src/` 下；play-mcp 落 `eval/`（非 src，不进 typecheck，作脚本，参照 `packages/core/eval/run.ts`）。
- TDD：先写失败测试再实现；每 Task 末 commit。
- 真后端 GM 烧 LLM（RUN_LIVE）不进单测，opt-in；可单测部分用 FakeDiceGm。

---

### Task 1: 抽 prepareSessionDb 共享场景准备（DONE）

已落地（commit 7e1a028）：`packages/core/src/eval/scenario.ts` 的 `loadScenario`/`prepareSessionDb` + core `index.ts` re-export + `run.ts` 改用。本 task 已完成，play-mcp `open_session` 复用它。

---

### Task 2: buildBaselinePrompt 去 doctrine（DONE）

已落地（commit f4ad485）：`apps/orchestrator/src/dice/openingPrompt.ts` 加 `buildBaselinePrompt`（仅 signpost+prologue）+ 测试（断言「形状表」教条独有词）。本 task 已完成，Task 3 接线用它。

---

### Task 3: baseline 接线（DiceSession/server/env 切教条）

**Files:**
- Modify: `apps/orchestrator/src/dice/DiceSession.ts`
- Modify: `apps/orchestrator/src/api/dice.ts`
- Modify: `apps/orchestrator/src/api/ws.ts`
- Modify: `apps/orchestrator/src/server.ts`
- Test: `apps/orchestrator/src/dice/DiceSession.test.ts`（新建）

**Interfaces:**
- Consumes: `buildBaselinePrompt`（Task 2）、`buildOpeningPrompt`（现有）。
- Produces: `DiceSessionDeps.baseline?: boolean`；`DiceSession` 据 it 选 openingPrompt + 切 skills 空。`LiveDeps.baseline?`/`WsUpgradeDeps.baseline?` 透传。`server.ts` 读 env `DICELORE_BASELINE=1`。

- [ ] **Step 1: 写失败测试 `DiceSession.test.ts`**

```ts
// apps/orchestrator/src/dice/DiceSession.test.ts
import { describe, it, expect } from "vitest";
import { openDb, initSchema } from "@dicelore/core";
import { DiceSession } from "./DiceSession.js";
import type { AgentInit } from "../pkg/agent.js";

const memDb = () => { const d = openDb(":memory:"); initSchema(d); return d; };

describe("DiceSession baseline", () => {
  it("baseline:true → openingPrompt 去教条(不含形状表)", () => {
    const s = new DiceSession("t1", { agentFactory: () => ({ async *runTurn() {} }) as any, db: memDb(), baseline: true });
    expect(s.openingPrompt).toContain("Dicelore GM");
    expect(s.openingPrompt).not.toContain("形状表");
  });
  it("baseline:true → handleMessage 给 agentFactory 的 skills=[];非 baseline 用 deps.skills", async () => {
    let captured: AgentInit | null = null;
    const fac = (init: AgentInit) => { captured = init; return { async *runTurn() { yield { type: "turn_end" }; } } as any; };
    const s = new DiceSession("t1b", { agentFactory: fac, db: memDb(), baseline: true, skills: [{ name: "x", srcDir: "/x" }] });
    await s.handleMessage("hi");
    expect((captured as AgentInit).skills).toEqual([]);
    const s2 = new DiceSession("t1c", { agentFactory: fac, db: memDb(), skills: [{ name: "x", srcDir: "/x" }] });
    await s2.handleMessage("hi");
    expect((captured as AgentInit).skills).toEqual([{ name: "x", srcDir: "/x" }]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/orchestrator && npx vitest run src/dice/DiceSession.test.ts`
Expected: FAIL — `baseline` 不在 DiceSessionDeps / 类型报错。

- [ ] **Step 3: 改 `DiceSession.ts`**

`DiceSessionDeps` 加字段：
```ts
export interface DiceSessionDeps {
  db?: DB;
  agentFactory: AgentFactory;
  skills?: SkillRef[];
  model?: string;
  importFrom?: { catalog: CatalogDB; tuanbenId: string; ref: string };
  baseline?: boolean; // eval baseline 对照:去 doctrine + 强制 skills 空
}
```
import 加 `buildBaselinePrompt`：
```ts
import { buildOpeningPrompt, buildBaselinePrompt } from "./openingPrompt.js";
```
`openingPrompt` getter 改：
```ts
get openingPrompt(): string {
  return this.deps.baseline ? buildBaselinePrompt(this.db) : buildOpeningPrompt(this.db);
}
```
`buildInit()` 的 skills 改：
```ts
private buildInit(): AgentInit {
  return { mcpServer: this.mcpServer, openingPrompt: this.openingPrompt, skills: this.deps.baseline ? [] : (this.deps.skills ?? []), model: this.deps.model };
}
```

- [ ] **Step 4: 透传 baseline — `api/dice.ts`/`api/ws.ts`**

`api/dice.ts` `LiveDeps` 加 `baseline?: boolean`；`hostDeps` 加 `baseline: deps.baseline`：
```ts
const hostDeps = (id: string) => ({ db: deps.openSession?.(id), agentFactory: deps.agentFactory, skills: deps.skills, model: deps.model, baseline: deps.baseline });
```
`api/ws.ts` `WsUpgradeDeps` 加 `baseline?: boolean`；`getOrCreateHost` 调用处加 `baseline: deps.baseline`。

- [ ] **Step 5: `server.ts` 读 env 传 baseline**

```ts
const baseline = process.env.DICELORE_BASELINE === "1";
// createLiveApp / attachWsUpgrade 调用都加 baseline
app.route("/", createLiveApp({ agentFactory, skills: diceSkills, openSession, catalog, listSessions: () => listSessionSummaries(dir), deleteSession: (id) => { ... }, baseline }));
attachWsUpgrade(server, { openSession, agentFactory, skills: diceSkills, baseline });
```

- [ ] **Step 6: 跑测试 + typecheck + 全测**

Run: `cd apps/orchestrator && npx vitest run src/dice/DiceSession.test.ts && npm run typecheck && npm test`
Expected: 全绿。

- [ ] **Step 7: commit**

```bash
git add apps/orchestrator/src/dice/DiceSession.ts apps/orchestrator/src/dice/DiceSession.test.ts apps/orchestrator/src/api/dice.ts apps/orchestrator/src/api/ws.ts apps/orchestrator/src/server.ts
git commit -m "feat(dice): baseline 接线(DiceSessionDeps.baseline + env DICELORE_BASELINE 切教条/skills)"
```

---

### Task 4: play-mcp stdio MCP（包后端 play HTTP）

**Files:**
- Create: `apps/orchestrator/eval/play-mcp.ts`
- Create: `apps/orchestrator/eval/play-mcp.test.ts`

**Interfaces:**
- Consumes: `prepareSessionDb`（@dicelore/core，Task 1）、后端 play HTTP（`DICELORE_PLAY_URL`）、`@modelcontextprotocol/sdk`。
- Produces: `play-mcp.ts` 导出工具 handler 纯函数（`doOpenSession`/`doSendMessage`/`doGetPresentation`/…）+ `main()`（起 stdio McpServer）。

- [ ] **Step 1: 写失败测试 `play-mcp.test.ts`（起 FakeDiceGm 后端 + 调 handler）**

```ts
// apps/orchestrator/eval/play-mcp.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serve } from "@hono/node-server";
import { createLiveApp } from "../src/api/dice.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, initSchema } from "@dicelore/core";
import { doOpenSession, doStartGame, doSendMessage, doGetPresentation } from "./play-mcp.js";

let baseUrl: string; let server: ReturnType<typeof serve>; let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "dl-pmcp-"));
  const openSession = (id: string) => { const d = openDb(`${dir}/${id}.db`); initSchema(d); return d; };
  const app = createLiveApp({
    agentFactory: () => ({ async *runTurn() { yield { type: "narration", text: "门开了。" }; yield { type: "turn_end" }; } } as any),
    openSession,
  });
  server = serve({ fetch: app.fetch, port: 0 });
  baseUrl = `http://localhost:${(server.address() as any).port}`;
  process.env.DICELORE_PLAY_URL = baseUrl;
  process.env.DICELORE_SESSIONS_DIR = dir;
});
afterAll(() => server.close());

describe("play-mcp handlers", () => {
  it("open→start→send→presentation 闭环拿 GM 叙述", async () => {
    const sid = await doOpenSession("orc-hunt");
    expect(sid).toBeTruthy();
    await doStartGame(sid);
    await doSendMessage(sid, "去森林");
    const pres = await doGetPresentation(sid);
    expect(JSON.stringify(pres)).toContain("门开了。");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/orchestrator && npx vitest run eval/play-mcp.test.ts`
Expected: FAIL — `Cannot find module './play-mcp.js'`。

- [ ] **Step 3: 写 `play-mcp.ts`**

```ts
// apps/orchestrator/eval/play-mcp.ts
// CC 经此 stdio MCP 连真后端 play HTTP,当玩家+评估者。后端 URL/sessions_dir 来自 env。
// 工具 handler 抽成纯函数(可测);main() 起 stdio McpServer 注册工具。
import { prepareSessionDb } from "@dicelore/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const PLAY_URL = () => process.env.DICELORE_PLAY_URL ?? "http://localhost:8787";

async function jfetch(path: string, init?: RequestInit) {
  const r = await fetch(`${PLAY_URL()}${path}`, init);
  return r.json();
}

export async function doOpenSession(scenarioId: string): Promise<string> {
  const { sessionName } = await prepareSessionDb(scenarioId, {}); // 灌种子到后端 sessions_dir
  return sessionName;
}
export async function doStartGame(sid: string) { return jfetch(`/sessions/${encodeURIComponent(sid)}/start`, { method: "POST" }); }
export async function doSendMessage(sid: string, text: string) {
  return jfetch(`/sessions/${encodeURIComponent(sid)}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
}
export async function doGetPresentation(sid: string) { return jfetch(`/sessions/${encodeURIComponent(sid)}/presentation`); }
export async function doChoose(sid: string, eventId: number, optionIndex: number) {
  return jfetch(`/sessions/${encodeURIComponent(sid)}/choices`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, optionIndex }) });
}
export async function doRoll(sid: string, eventId: number) {
  return jfetch(`/sessions/${encodeURIComponent(sid)}/roll`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId }) });
}

async function main() {
  const server = new McpServer({ name: "dicelore-play", version: "0.1.0" });
  server.tool("list_scenarios", {}, async () => ({ content: [{ type: "text", text: "orc-hunt" }] }));
  server.tool("open_session", { scenarioId: String }, async ({ scenarioId }) => ({ content: [{ type: "text", text: await doOpenSession(scenarioId) }] }));
  server.tool("start_game", { sessionId: String }, async ({ sessionId }) => ({ content: [{ type: "text", text: JSON.stringify(await doStartGame(sessionId)) }] }));
  server.tool("send_message", { sessionId: String, text: String }, async ({ sessionId, text }) => ({ content: [{ type: "text", text: JSON.stringify(await doSendMessage(sessionId, text)) }] }));
  server.tool("get_presentation", { sessionId: String }, async ({ sessionId }) => ({ content: [{ type: "text", text: JSON.stringify(await doGetPresentation(sessionId)) }] }));
  server.tool("choose", { sessionId: String, eventId: Number, optionIndex: Number }, async ({ sessionId, eventId, optionIndex }) => ({ content: [{ type: "text", text: JSON.stringify(await doChoose(sessionId, eventId, optionIndex)) }] }));
  server.tool("roll", { sessionId: String, eventId: Number }, async ({ sessionId, eventId }) => ({ content: [{ type: "text", text: JSON.stringify(await doRoll(sessionId, eventId)) }] }));
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const invokedDirect = process.argv[1] && process.argv[1].endsWith("play-mcp.ts");
if (invokedDirect) await main();
```

- [ ] **Step 4: 跑测试 + typecheck + 全测**

Run: `cd apps/orchestrator && npx vitest run eval/play-mcp.test.ts && npm run typecheck && npm test`
Expected: 全绿（play-mcp.ts 不在 src，不进 typecheck，但 handler 纯函数被测）。

- [ ] **Step 5: commit**

```bash
git add apps/orchestrator/eval/play-mcp.ts apps/orchestrator/eval/play-mcp.test.ts
git commit -m "feat(eval): play-mcp stdio MCP(CC 经它连真后端 play HTTP 当玩家/评估者)"
```

---

### Task 5: RUN_LIVE 验证 + 验收沉淀

**Files:** 无代码（跑 + 文档）。

- [ ] **Step 1: 起真后端 + CC 连 play-mcp 跑 orc-hunt 两档**

```bash
# doctrine 档
DICELORE_SESSIONS_DIR=/tmp/dl-live-doctrine DICELORE_FAKE_GM=0 npx tsx apps/orchestrator/src/server.ts &
# baseline 档(另一端口)
PORT=8788 DICELORE_SESSIONS_DIR=/tmp/dl-live-baseline DICELORE_BASELINE=1 DICELORE_FAKE_GM=0 npx tsx apps/orchestrator/src/server.ts &
# CC 经 play-mcp(DICELORE_PLAY_URL 指 doctrine)跑 orc-hunt,CC 写 eval 报告到 reports/
```
Expected: CC 跑通一局，观察到 GM 行为（跳骰?软着陆?收局?），出首份 eval 报告。

- [ ] **Step 2: ⑦ 验收**

Run: `npm test`(root,跑 core) + `cd apps/orchestrator && npm test && npm run typecheck`
Expected: 全绿。

- [ ] **Step 3: 沉淀 wiki + 关 backlog + 清草稿 + 合 main**

- ADR：play-mcp 作 eval 入口、eval 用缝 B（连真后端）。
- 04 设计页：eval 经 MCP 连后端。
- 关 backlog：F1/F2/G-后端-gmcore 标关。
- 删 `docs/superpowers/specs|plans/2026-06-24-教条与eval-harness闭环-*`（知识已沉淀）。
- merge worktree 分支回 main。

---

## Self-Review

- **Spec 覆盖**：D1→Task 4 play-mcp；D2→Task 5 CC 自主（无脚本玩家代码）；D3→Task 2+3 baseline；D4→Task 5 F2 从 presentation.ended；D5→Task 5 RUN_LIVE；D6→Task 5 CC 写报告。全覆盖。
- **Placeholder**：`list_scenarios` 工具 handler 给最小返回（读 scenarios 目录留实现期补全，非阻塞——handler 纯函数已测）。
- **类型一致**：`DiceSessionDeps.baseline`/`LiveDeps.baseline`/`WsUpgradeDeps.baseline` 贯通；`doOpenSession` 返回 sessionName 与后端 sessionId 同义（prepareSessionDb 设 DICELORE_SESSION=sessionName）。
