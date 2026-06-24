# 教条 + eval harness 闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 eval 从「手动跑 claude 喂回合」升级为「DiceGm 自动闭环 + mock 玩家 + 自动 grade」的真 harness，顺带 RUN_LIVE 验证 gm-core 教条接入、纳 F2 终局观测。

**Architecture:** 复用 `DiceGm`（in-process MCP + staged 教条 + 真引擎）当 GM 子代理，mock 玩家按 scenario.playerTurns 逐条喂，`onCanonWrite` 回调（ADR-0020 现成缝）收工具调用痕迹含 game_end 时机，transcript 写成 grade 兼容格式（grade 不改）。harness 本身烧 LLM = RUN_LIVE，不进单测；可单测的纯逻辑抽进 `src/` 用 FakeDiceGm 测骨架。

**Tech Stack:** TypeScript、`@anthropic-ai/claude-agent-sdk`、`@modelcontextprotocol/sdk`、better-sqlite3、vitest。

## Global Constraints

- 测试框架 vitest；core 测 `cd packages/core && npm test`，orchestrator 测 `cd apps/orchestrator && npm test`；typecheck 同理（root `npm test`/`typecheck` 只跑 core）。
- 可测模块必须落 `src/` 下（orchestrator tsconfig `include:["src"]`、vitest 扫 src）；纯脚本 glue 留 `eval/` 脚本目录（npx tsx 跑，不进 typecheck/vitest）。
- 单向依赖 core→orchestrator 不破：orchestrator 只 `import ... from "@dicelore/core"`，core 不反向 import orchestrator。
- git 一律 `--no-pager`；scoped `git add <精确路径>`，别 `-A`（worktree npm lock 坑）。
- harness 不替 GM 收局（D4）；不进 CI（烧 LLM，opt-in）。

## File Structure

| 文件 | 责任 | 性质 |
|------|------|------|
| `packages/core/src/eval/scenario.ts`（新） | `Scenario` 类型 + `loadScenario` + `prepareSessionDb`（灌种子+建临时 db，run.ts/harness 共用） | 模块·进 typecheck+vitest |
| `packages/core/src/eval/scenario.test.ts`（新） | 测 loadScenario + prepareSessionDb | 测试 |
| `packages/core/src/index.ts`（改） | re-export `prepareSessionDb`/`loadScenario`/`Scenario` | 模块 |
| `packages/core/eval/run.ts`（改） | 改用 `prepareSessionDb`，保留 init 项目+.mcp.json+手动指引 | 脚本 |
| `apps/orchestrator/src/dice/openingPrompt.ts`（改） | 加 `buildBaselinePrompt(db)`（去 doctrine） | 模块 |
| `apps/orchestrator/src/dice/openingPrompt.test.ts`（改） | 测 baseline 不含 doctrine、opening 含 | 测试 |
| `apps/orchestrator/src/eval/transcript.ts`（新） | transcript 格式化纯函数：narration+canon→grade 兼容 jsonl | 模块·进 typecheck+vitest |
| `apps/orchestrator/src/eval/transcript.test.ts`（新） | 测格式化 | 测试 |
| `apps/orchestrator/src/eval/harness.ts`（新） | 闭环驱动：prepareSessionDb→createMcpServer→DiceGm→mock 玩家→transcript→grade | 脚本·opt-in·烧 LLM |
| `apps/orchestrator/src/eval/harness.test.ts`（新） | FakeDiceGm 测闭环骨架（不烧 LLM） | 测试 |

**依赖图 / 并发波次**：
- 波次1（并发）：Task 1（core scenario）、Task 2（baseline prompt）、Task 3（transcript）
- 波次2：Task 4（harness，依赖 1+2+3）
- 波次3：Task 5（真实跑 orc-hunt 两档，依赖 4，手动 opt-in）

---

### Task 1: 抽 prepareSessionDb 到 core/src/eval/scenario.ts

**Files:**
- Create: `packages/core/src/eval/scenario.ts`
- Create: `packages/core/src/eval/scenario.test.ts`
- Modify: `packages/core/src/index.ts`（加 re-export）
- Modify: `packages/core/eval/run.ts`（改用 prepareSessionDb）

**Interfaces:**
- Produces: `loadScenario(id: string): Scenario`、`prepareSessionDb(id, opts?): Promise<PreparedSession>`、`Scenario`/`PreparedSession` 类型，经 core index.ts re-export。

- [ ] **Step 1: 写失败测试 `scenario.test.ts`**

```ts
// packages/core/src/eval/scenario.test.ts
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadScenario, prepareSessionDb } from "./scenario.js";
import { openDb } from "../store/db.js";

describe("eval scenario", () => {
  it("loadScenario 读 orc-hunt", () => {
    const s = loadScenario("orc-hunt");
    expect(s.id).toBe("orc-hunt");
    expect(s.playerTurns.length).toBeGreaterThan(0);
  });

  it("prepareSessionDb 建库并返回 db/scenario", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dl-eval-test-"));
    const prepared = await prepareSessionDb("orc-hunt", { sessionsDir: dir });
    expect(prepared.scenario.id).toBe("orc-hunt");
    expect(prepared.dbPath).toBeTruthy();
    expect(prepared.sessionsDir).toBe(dir);
    const db = openDb(prepared.dbPath);
    expect(db).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/core && npx vitest run src/eval/scenario.test.ts`
Expected: FAIL — `Cannot find module './scenario.js'`

- [ ] **Step 3: 写 `scenario.ts`**

```ts
// packages/core/src/eval/scenario.ts
// eval 场景共享逻辑:Scenario 类型 + loadScenario + prepareSessionDb(灌种子+建临时 db)。
// run.ts(手动调试)与 orchestrator harness(自动闭环)共用。
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "../store/db.js";

const here = dirname(fileURLToPath(import.meta.url));
// scenarios 在 packages/core/eval/scenarios/(src/eval → ../../eval/scenarios)
const scenariosDir = join(here, "..", "..", "eval", "scenarios");

export interface ScenarioSeed {
  tone?: string;
  rules?: { name: string; content: string }[];
  sheets?: { entity: string; attr: string; value: string; show?: boolean }[];
}
export interface Scenario {
  id: string;
  title: string;
  focus: string[];
  reference: { file: string; beat: string; note: string };
  seed: ScenarioSeed;
  playerTurns: string[];
}
export interface PreparedSession {
  db: DB;
  dbPath: string;
  scenario: Scenario;
  sessionsDir: string;
  sessionName: string;
}

export function loadScenario(scenarioId: string): Scenario {
  return JSON.parse(readFileSync(join(scenariosDir, `${scenarioId}.json`), "utf8")) as Scenario;
}

// 灌种子 + 建临时 db。env 须在 import core 前(setSession 读它定位库),故内部 dynamic import。
export async function prepareSessionDb(
  scenarioId: string,
  opts: { baseline?: boolean; sessionsDir?: string } = {},
): Promise<PreparedSession> {
  const scenario = loadScenario(scenarioId);
  const sessionsDir = opts.sessionsDir ?? mkdtempSync(join(tmpdir(), "dl-eval-"));
  const sessionName = `eval-${scenario.id}${opts.baseline ? "-baseline" : ""}`;
  process.env.DICELORE_SESSIONS_DIR = sessionsDir;
  process.env.DICELORE_SESSION = sessionName;
  const { openSession, metaSet } = await import("../session/resolve.js");
  const { ruleUpsert } = await import("../store/rule.js");
  const { stateSet } = await import("../store/state.js");
  const { sheetShow } = await import("../store/visibility.js");
  const { db, path: dbPath } = openSession();
  if (scenario.seed.tone) metaSet(db, "tone", scenario.seed.tone);
  for (const r of scenario.seed.rules ?? []) ruleUpsert(db, { name: r.name, content: r.content });
  for (const s of scenario.seed.sheets ?? []) {
    stateSet(db, s.entity, s.attr, s.value);
    if (s.show) sheetShow(db, s.entity);
  }
  return { db, dbPath, scenario, sessionsDir, sessionName };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd packages/core && npx vitest run src/eval/scenario.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: core `index.ts` re-export**

在 `packages/core/src/index.ts` 找到 eval 相关导出处（assertions 附近或 createMcpServer 同区），加：

```ts
export { loadScenario, prepareSessionDb, type Scenario, type PreparedSession } from "./eval/scenario.js";
```

- [ ] **Step 6: run.ts 改用 prepareSessionDb**

把 `packages/core/eval/run.ts` 顶部的「解析 argv + 设 env + import core + openSession + 灌种子」段（原 line 16-56）替换为调用 `prepareSessionDb`，保留后面 init 项目 + 重写 .mcp.json + baseline 删 skills + 打印指引。新顶部：

```ts
// eval/run.ts — 准备一个 eval 场景的可跑会话:灌种子 + dicelore init 项目。
// 用法:npx tsx eval/run.ts <scenario-id> --sessions-dir <dir> [--baseline]
import { writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scenarioId = process.argv[2];
if (!scenarioId) {
  console.error("用法: npx tsx eval/run.ts <scenario-id> --sessions-dir <dir> [--baseline]");
  process.exit(1);
}
const sdIdx = process.argv.indexOf("--sessions-dir");
const sessionsDir = sdIdx > 0 ? process.argv[sdIdx + 1] : mkdtempSync(join(tmpdir(), "dl-eval-"));
const baseline = process.argv.includes("--baseline");

const { prepareSessionDb } = await import("../src/eval/scenario.js");
const { runInit } = await import("../src/adapter/init.js");

const prepared = await prepareSessionDb(scenarioId, { baseline, sessionsDir });
const { dbPath, scenario, sessionName } = prepared;

// init 临时项目
const projectDir = mkdtempSync(join(tmpdir(), "dl-eval-proj-"));
runInit({ projectDir, session: sessionName });

// init 产的 .mcp.json 指向未发布 CLI → 重写指本地 tsx + 注入 env。
const mcpJsonPath = join(projectDir, ".mcp.json");
const coreMain = join(here, "..", "src", "mcp", "main.ts");
writeFileSync(mcpJsonPath, JSON.stringify({
  mcpServers: {
    dicelore: {
      type: "stdio",
      command: "node",
      args: ["--import", "tsx", coreMain],
      env: { DICELORE_SESSION: sessionName, DICELORE_SESSIONS_DIR: sessionsDir },
    },
  },
}, null, 2) + "\n");

if (baseline) {
  rmSync(join(projectDir, ".claude", "skills"), { recursive: true, force: true });
  if (existsSync(join(projectDir, "CLAUDE.md"))) rmSync(join(projectDir, "CLAUDE.md"));
}

console.log(`=== eval 场景已就绪: ${scenario.title} ${baseline ? "[baseline 无skill]" : "[with gm-core]"} ===`);
console.log(`库:       ${dbPath}`);
console.log(`项目:     ${projectDir}`);
console.log(`语料参考: ${scenario.reference.file} — ${scenario.reference.beat}`);
console.log(`重点:     ${scenario.focus.join(" / ")}`);
console.log(`\n玩家输入序列(喂给 GM):`);
scenario.playerTurns.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
console.log(`\n下一步:`);
console.log(`  ① 在项目里跑 GM(择一):`);
console.log(`     - 手动: cd ${projectDir} && DICELORE_SESSIONS_DIR=${sessionsDir} DICELORE_SESSION=${sessionName} claude`);
console.log(`     - headless: claude -p 串回合,env 同上`);
console.log(`  ② 评分: npx tsx eval/grade.ts ${dbPath} --transcript <cc-transcript.jsonl> --scenario ${scenario.id}`);
console.log(`  ③ 定性对标: 喂 grader(eval/grader.md)`);
console.log(`  或改用自动闭环: cd apps/orchestrator && npx tsx src/eval/harness.ts ${scenario.id}${baseline ? " --baseline" : ""}`);
```

- [ ] **Step 7: 冒烟 run.ts + 跑 core 全测 + commit**

Run: `cd packages/core && npx tsx eval/run.ts orc-hunt --sessions-dir /tmp/dl-smoke-$$ && echo OK`
Expected: 打印场景就绪 + 玩家输入序列，无报错。

Run: `cd packages/core && npm test && npm run typecheck`
Expected: 全绿、tsc 0。

```bash
git add packages/core/src/eval/scenario.ts packages/core/src/eval/scenario.test.ts packages/core/src/index.ts packages/core/eval/run.ts
git commit -m "feat(eval): 抽 prepareSessionDb 共享场景准备逻辑(run.ts/harness 共用)"
```

---

### Task 2: buildBaselinePrompt（去 doctrine 的 baseline 系统提示）

**Files:**
- Modify: `apps/orchestrator/src/dice/openingPrompt.ts`
- Modify: `apps/orchestrator/src/dice/openingPrompt.test.ts`

**Interfaces:**
- Produces: `buildBaselinePrompt(db: DB): string`（仅 signpost+prologue，不含 gm-core 教条）。

- [ ] **Step 1: 在现有 `describe("buildOpeningPrompt")` 块末尾追加失败测试**

在 `apps/orchestrator/src/dice/openingPrompt.test.ts` 顶部 import 改为：
```ts
import { buildOpeningPrompt, buildBaselinePrompt } from "./openingPrompt.js";
```
在 describe 块内（末尾 `});` 前）追加：
```ts
  it("buildBaselinePrompt 不含教条(纯 signpost+prologue)", () => {
    const db = openDb(":memory:"); initSchema(db);
    metaSet(db, "prologue", "夜色如墨。");
    const p = buildBaselinePrompt(db);
    expect(p).toContain("Dicelore GM");      // signpost 仍在
    expect(p).toContain("夜色如墨。");        // prologue 仍在
    expect(p).not.toContain("诚实仲裁者");    // 教条去掉
    db.close();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/orchestrator && npx vitest run src/dice/openingPrompt.test.ts`
Expected: FAIL — `buildBaselinePrompt is not a function`

- [ ] **Step 3: 在 `openingPrompt.ts` 加 `buildBaselinePrompt`**

在 `buildOpeningPrompt` 函数后追加：
```ts
// baseline 系统提示:signpost + prologue,**不含 gm-core 教条**(用于 harness baseline 对照,
// 分离"教条有无")。与 buildOpeningPrompt 的区别仅是去掉 doctrine 段。
export function buildBaselinePrompt(db: DB): string {
  const signpost = buildSessionContext(db);
  const prologue = metaGet(db, "prologue");
  return prologue ? `${signpost}\n\n---\n\n# 团本开场\n\n${prologue}` : signpost;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/orchestrator && npx vitest run src/dice/openingPrompt.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: typecheck + commit**

Run: `cd apps/orchestrator && npm run typecheck`
Expected: tsc 0。

```bash
git add apps/orchestrator/src/dice/openingPrompt.ts apps/orchestrator/src/dice/openingPrompt.test.ts
git commit -m "feat(dice): buildBaselinePrompt 去 doctrine(harness baseline 对照用)"
```

---

### Task 3: transcript 格式化纯函数（grade 兼容）

**Files:**
- Create: `apps/orchestrator/src/eval/transcript.ts`
- Create: `apps/orchestrator/src/eval/transcript.test.ts`

**Interfaces:**
- Produces: `narrationLine(turn, text)`、`canonLine(turn, evt)`、`turnEndLine(turn)`、`errorLine(turn, msg)` —— 各返回一行 jsonl 字符串。narration 行伪装成 `{message:{role:"assistant",content:[{type:"text",text}]}}` 让 `grade.ts` 的 `assistantText()` 直接吃；其余行 grade 跳过。

- [ ] **Step 1: 写失败测试 `transcript.test.ts`**

```ts
// apps/orchestrator/src/eval/transcript.test.ts
import { describe, it, expect } from "vitest";
import { narrationLine, canonLine, turnEndLine, errorLine } from "./transcript.js";
import type { CanonWriteEvent } from "@dicelore/core";

describe("transcript lines", () => {
  it("narrationLine 伪装成 cc-transcript assistant 行(grade 可吃)", () => {
    const line = narrationLine(0, "门吱呀一声开了。");
    const o = JSON.parse(line);
    expect(o.message.role).toBe("assistant");
    expect(o.message.content[0].type).toBe("text");
    expect(o.message.content[0].text).toBe("门吱呀一声开了。");
    expect(o.turn).toBe(0);
  });

  it("canonLine 带 canon 字段(grade 跳过,F2/工具痕迹用)", () => {
    const evt: CanonWriteEvent = { kind: "game_end", seq: 9, toolName: "game_end", output: { ok: true } };
    const line = canonLine(3, evt);
    const o = JSON.parse(line);
    expect(o.type).toBe("canon");
    expect(o.canon.kind).toBe("game_end");
    expect(o.canon.seq).toBe(9);
  });

  it("turnEndLine / errorLine 不含 message(grade 跳过)", () => {
    expect(JSON.parse(turnEndLine(0)).type).toBe("turn_end");
    expect(JSON.parse(errorLine(0, "boom")).type).toBe("error");
    expect(JSON.parse(errorLine(0, "boom")).message).toBe("boom");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/orchestrator && npx vitest run src/eval/transcript.test.ts`
Expected: FAIL — `Cannot find module './transcript.js'`

- [ ] **Step 3: 写 `transcript.ts`**

```ts
// apps/orchestrator/src/eval/transcript.ts
// harness transcript 格式化:narration 行伪装成 cc-transcript assistant 格式,
// 让 eval/grade.ts 的 assistantText() 直接吃(grade 不改);canon/turn_end/error 行
// grade 跳过,供 F2(game_end 时机)+ 工具痕迹观测。
import type { CanonWriteEvent } from "@dicelore/core";

// narration = GM 散文(DiceGm yield 的),写成 grade 可读的 assistant 行。
export function narrationLine(turn: number, text: string): string {
  return JSON.stringify({
    message: { role: "assistant", content: [{ type: "text", text }] },
    turn,
  });
}

export function canonLine(turn: number, evt: CanonWriteEvent): string {
  return JSON.stringify({ turn, type: "canon", canon: evt });
}

export function turnEndLine(turn: number): string {
  return JSON.stringify({ turn, type: "turn_end" });
}

export function errorLine(turn: number, message: string): string {
  return JSON.stringify({ turn, type: "error", message });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/orchestrator && npx vitest run src/eval/transcript.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: typecheck + commit**

Run: `cd apps/orchestrator && npm run typecheck`
Expected: tsc 0。

```bash
git add apps/orchestrator/src/eval/transcript.ts apps/orchestrator/src/eval/transcript.test.ts
git commit -m "feat(eval): transcript 格式化纯函数(grade 兼容)"
```

---

### Task 4: harness 自动闭环（DiceGm + mock 玩家 + grade）

**Files:**
- Create: `apps/orchestrator/src/eval/harness.ts`
- Create: `apps/orchestrator/src/eval/harness.test.ts`

**Interfaces:**
- Consumes: `prepareSessionDb`（Task 1）、`buildOpeningPrompt`/`buildBaselinePrompt`/`gmCoreSkill`（Task 2 + 现有）、`narrationLine`/`canonLine`/`turnEndLine`/`errorLine`（Task 3）、`createMcpServer`/`CanonWriteEvent`（core re-export）、`DiceGm`/`Agent`/`FakeDiceGm`（现有）。
- Produces: `runHarnessLoop(agent, playerTurns): Promise<HarnessEvents>`（可单测纯逻辑，用 FakeDiceGm）+ `main()`（烧 LLM，opt-in）。

- [ ] **Step 1: 写失败测试 `harness.test.ts`（FakeDiceGm，不烧 LLM）**

```ts
// apps/orchestrator/src/eval/harness.test.ts
import { describe, it, expect } from "vitest";
import { runHarnessLoop } from "./harness.js";
import { FakeDiceGm } from "../dice/FakeDiceGm.js";

describe("runHarnessLoop", () => {
  it("收每回合 narration + turn_end(FakeDiceGm 脚本)", async () => {
    const agent = new FakeDiceGm((input) => [
      { type: "narration", text: `你说:${input.text}` },
      { type: "turn_end" },
    ]);
    const res = await runHarnessLoop(agent, ["去森林", "攻击"]);
    expect(res.narrations).toHaveLength(2);
    expect(res.narrations[0]).toEqual({ turn: 0, text: "你说:去森林" });
    expect(res.narrations[1]).toEqual({ turn: 1, text: "你说:攻击" });
    expect(res.turnEnds).toEqual([0, 1]);
    expect(res.errors).toHaveLength(0);
  });

  it("收 error 事件", async () => {
    const agent = new FakeDiceGm(() => [{ type: "error", message: "boom" }]);
    const res = await runHarnessLoop(agent, ["x"]);
    expect(res.errors).toEqual([{ turn: 0, message: "boom" }]);
    expect(res.narrations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/orchestrator && npx vitest run src/eval/harness.test.ts`
Expected: FAIL — `Cannot find module './harness.js'`

- [ ] **Step 3: 写 `harness.ts`（可测 loop + 烧 LLM main）**

```ts
// apps/orchestrator/src/eval/harness.ts
// eval 自动闭环(D1-D6):复用 DiceGm(in-process MCP + staged 教条 + 真引擎)当 GM 子代理,
// mock 玩家按 scenario.playerTurns 逐条喂,onCanonWrite 收工具痕迹含 game_end 时机(F2),
// transcript 写 grade 兼容格式(grade 不改),跑完打印 grade 指引 + F2 观测。
// 烧 LLM(真 DiceGm)= RUN_LIVE;不进 CI。骨架测见 harness.test.ts(FakeDiceGm)。
//   npx tsx src/eval/harness.ts <scenario-id> [--baseline]
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSessionDb, createMcpServer, type CanonWriteEvent, type DB } from "@dicelore/core";
import type { Agent } from "../pkg/agent.js";
import { DiceGm } from "../dice/DiceGm.js";
import { gmCoreSkill, buildOpeningPrompt, buildBaselinePrompt } from "../dice/openingPrompt.js";
import { narrationLine, canonLine, turnEndLine, errorLine } from "./transcript.js";

const here = dirname(fileURLToPath(import.meta.url));

export interface HarnessEvents {
  narrations: { turn: number; text: string }[];
  errors: { turn: number; message: string }[];
  turnEnds: number[];
}

// 可单测的纯逻辑:给定 agent + 玩家输入序列,跑闭环收事件。canon 事件不在此(由
// createMcpServer 的 onCanonWrite 回调独立收,因回调不知 turn 归属)。
export async function runHarnessLoop(agent: Agent, playerTurns: string[]): Promise<HarnessEvents> {
  const narrations: { turn: number; text: string }[] = [];
  const errors: { turn: number; message: string }[] = [];
  const turnEnds: number[] = [];
  for (let i = 0; i < playerTurns.length; i++) {
    for await (const evt of agent.runTurn({ text: playerTurns[i] })) {
      if (evt.type === "narration") narrations.push({ turn: i, text: evt.text });
      else if (evt.type === "turn_end") turnEnds.push(i);
      else if (evt.type === "error") errors.push({ turn: i, message: evt.message });
    }
  }
  return { narrations, errors, turnEnds };
}

async function main() {
  const scenarioId = process.argv[2];
  if (!scenarioId) {
    console.error("用法: npx tsx src/eval/harness.ts <scenario-id> [--baseline]");
    process.exit(1);
  }
  const baseline = process.argv.includes("--baseline");

  const prepared = await prepareSessionDb(scenarioId, { baseline });
  const canonEvents: CanonWriteEvent[] = [];
  const mcpServer = createMcpServer(prepared.db, {
    onCanonWrite: (evt) => canonEvents.push(evt),
  });
  const skills = baseline
    ? []
    : [gmCoreSkill()].filter((s): s is NonNullable<typeof s> => s !== null);
  const openingPrompt = baseline ? buildBaselinePrompt(prepared.db) : buildOpeningPrompt(prepared.db);
  const agent = new DiceGm({ mcpServer, openingPrompt, skills });

  console.log(`=== harness: ${prepared.scenario.title} [${baseline ? "baseline 无教条" : "doctrine 带教条"}] ===`);
  const res = await runHarnessLoop(agent, prepared.scenario.playerTurns);

  const lines = [
    ...res.narrations.map((n) => narrationLine(n.turn, n.text)),
    ...res.errors.map((e) => errorLine(e.turn, e.message)),
    ...res.turnEnds.map((t) => turnEndLine(t)),
    ...canonEvents.map((e) => canonLine(e.seq, e)),
  ];
  const transcriptDir = join(here, "..", "..", "..", "packages", "core", "eval", "reports");
  const tag = baseline ? "baseline" : "doctrine";
  const transcriptPath = join(transcriptDir, `${scenarioId}-${tag}.transcript.jsonl`);
  mkdirSync(transcriptDir, { recursive: true });
  writeFileSync(transcriptPath, lines.join("\n") + "\n");

  // F2 终局观测(D4:harness 不替 GM 收局,只观测)
  const gameEnds = canonEvents.filter((e) => e.kind === "game_end");
  console.log(`transcript → ${transcriptPath}`);
  console.log(`\n评分: cd packages/core && npx tsx eval/grade.ts ${prepared.dbPath} --transcript ${transcriptPath} --scenario ${scenarioId}`);
  console.log(`\nF2 终局观测: game_end 调用 ${gameEnds.length} 次${gameEnds.length ? `(首次 seq=${gameEnds[0].seq})` : ";未收局"}`);
  console.log(`工具痕迹: 共 ${canonEvents.length} 次规范态写(mutation ${canonEvents.filter((e) => e.kind === "mutation").length} / event ${canonEvents.filter((e) => e.kind === "event").length} / ... )`);
}

// 直接跑时执行 main;被 import 时不跑(只导出 runHarnessLoop)。
const invokedDirect = fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirect) await main();
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/orchestrator && npx vitest run src/eval/harness.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: typecheck + 跑 orchestrator 全测 + commit**

Run: `cd apps/orchestrator && npm run typecheck && npm test`
Expected: tsc 0、全绿。

```bash
git add apps/orchestrator/src/eval/harness.ts apps/orchestrator/src/eval/harness.test.ts
git commit -m "feat(eval): harness 自动闭环(DiceGm+mock玩家+onCanonWrite观测+grade)"
```

---

### Task 5: 真实跑 orc-hunt 两档对照（opt-in，烧 LLM = RUN_LIVE）

**性质**：验证步骤，不产代码；烧真 LLM，不进 CI。无 LLM 配置可跳过（Task 4 骨架已单测保证闭环正确性）。

**Files:**
- 无代码改动；产物 `packages/core/eval/reports/orc-hunt-{doctrine,baseline}.transcript.jsonl`（若 reports/ 被 gitignore 则不提交，仅本地验证）。

- [ ] **Step 1: 确认 LLM env**

确认已设 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`（DiceGm 经 Agent SDK 读 env，[ADR-0020](../../wiki/05-决策记录-ADR/README.md)）；可选 `DICELORE_GM_MODEL`（默认 opus）。
Run: `echo $ANTHROPIC_BASE_URL`
Expected: 非空（如 Claude 兼容代理地址）。未设则停在此步，等配置后再继续。

- [ ] **Step 2: 跑 doctrine 档（带教条）**

Run: `cd apps/orchestrator && npx tsx src/eval/harness.ts orc-hunt`
Expected: 打印 `=== harness: ... [doctrine 带教条] ===`、逐回合 GM narration 流出、末尾 `transcript → ...orc-hunt-doctrine.transcript.jsonl` + F2 终局观测 + 工具痕迹统计。无 `error` 事件（若有，记录喂 findings）。

- [ ] **Step 3: 跑 baseline 档（无教条）**

Run: `cd apps/orchestrator && npx tsx src/eval/harness.ts orc-hunt --baseline`
Expected: 同上，tag=`baseline 无教条`，transcript → `...orc-hunt-baseline.transcript.jsonl`。

- [ ] **Step 4: 两档分别跑 grade**

Run:
```bash
cd packages/core
npx tsx eval/grade.ts <doctrine-dbPath> --transcript apps/../packages/core/eval/reports/orc-hunt-doctrine.transcript.jsonl --scenario orc-hunt
npx tsx eval/grade.ts <baseline-dbPath> --transcript packages/core/eval/reports/orc-hunt-baseline.transcript.jsonl --scenario orc-hunt
```
（`<*-dbPath>` 取 Step 2/3 打印的库路径）
Expected: 两份机械报告（toolStats / narration / panel / mechanical：narrateLeak、missingNarrate、verdictCount、gatedVsAuto）。对照看「带教条是否掷骰绕过率更低 / 软着陆更少 / 更接近真人 GM」。

- [ ] **Step 5: F2 + 定性对标 + 沉淀**

- 看 Step 2/3 的 F2 输出：doctrine 档 game_end 调用次数 / 收局 seq vs baseline 档。若 doctrine 真 GM 不收局（只死亡收或永不收）→ 印证 [E1/E2](../../wiki/06-里程碑与问题/backlog-core.md) 终局判据缺失。
- 把两份 grade report + 玩家视图 + transcript + orc-hunt.reference 桥段喂 `eval/grader.md` 定性对标。
- 把结论写进 `packages/core/eval/findings.md`（按主题卷，非全文搬运）。

Run（沉淀，若改了 wiki/backlog）:
```bash
git add packages/core/eval/findings.md docs/wiki/06-里程碑与问题/
git commit -m "docs(eval): orc-hunt 两档首跑结论 + 关 F1/F2/G-后端-gmcore"
```
（若 findings.md 无实质新结论、reports 被 gitignore，则本步无 commit，仅记录验证通过。）

---

## Self-Review

**1. Spec coverage**
- D1（复用 DiceGm、落 orchestrator）→ Task 4。
- D2（固定 playerTurns mock）→ Task 4 `runHarnessLoop` 吃 `scenario.playerTurns`。
- D3（doctrine/baseline 两档）→ Task 2 `buildBaselinePrompt` + Task 4 main 按 `--baseline` 切。
- D4（不替 GM 收局、F2 观测）→ Task 4 main 只观测 `canonEvents.kind==="game_end"`、Task 5 Step 5 对照。
- D5（harness=RUN_LIVE）→ Task 5。
- D6（一键跑+自动 grade 指引）→ Task 4 main 打印 grade 指引、Task 5 Step 4 跑 grade。
- 教条接入收尾（RUN_LIVE 验证 staged skill 真加载）→ Task 5 跑通即验证。
- **对 spec 改动清单的优化**：spec 第 4 项原说「改 grade.ts 接受 harness transcript 格式」；plan 改为 **不改 grade**——harness transcript 的 narration 行伪装成 cc-transcript assistant 格式（Task 3 `narrationLine`），`grade.ts` 现有 `assistantText()` 直接能吃。DRY、少改一处。spec 第 5 项「不改 DiceGm」保持。

**2. Placeholder scan**：无 TBD/TODO/「适当处理」。每步含真实代码或确切命令 + 预期。✓

**3. Type consistency**：
- `runHarnessLoop` 返回 `HarnessEvents{narrations,errors,turnEnds}` —— Task 4 impl 与 test 一致。
- `narrationLine/canonLine/turnEndLine/errorLine` 签名（Task 3）与 Task 4 main 调用一致；`canonLine(turn, evt)` 的 turn 传 `e.seq`（数字，兼容）。
- `prepareSessionDb` 返回 `PreparedSession{db,dbPath,scenario,sessionsDir,sessionName}`（Task 1）—— Task 4 main 用 `prepared.db/dbPath/scenario.playerTurns` 一致。
- `DiceGm` 构造吃 `AgentInit{mcpServer,openingPrompt,skills}` —— Task 4 main 传入一致；`skills` 经 `filter((s):s is NonNullable<typeof s>=>s!==null)` 收窄为 `SkillRef[]`，匹配 `AgentInit.skills: SkillRef[]`。✓

**执行选择**：plan 保存于 `docs/superpowers/plans/2026-06-24-教条与eval-harness闭环-plan.md`。按 autonomous-delivery-loop ⑤，波次1（Task 1/2/3）可并发派 subagent，波次2（Task 4）待 1+2+3 回收后派，Task 5 opt-in 手动。
