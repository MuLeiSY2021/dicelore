// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// lore 侧 eval 机械断言地板（客观、确定性、零 LLM）。对称于 dice 侧 src/eval/assertions.ts。
//
// dice 断言判「GM 跑一局」的机械违规（漏掷骰 / narrate 泄漏 / 时序绕过）；
// lore 断言判「作者构建一个团本」的机械可验证管道：构建工具序列跑完 commit→import 后，
//   运行库里作者声明的各域（lore/rule/pool/state/front/plotline/foreshadow/anchor/watcher）真到位吗？
// 这是「作者↔构建 GM」交互里**不依赖 LLM 语义**的那一半——构建工具可用性 + draft→CSV/md→import 映射正确性。
// 「构建 GM 是否把作者意图翻成对的工具调用」属语义判断，归真 LLM 评测（eval/loreGrader.md），不在此。
import type { DB } from "../store/db.js";
import type { LoreExpects } from "./loreScenario.js";
import type { LoreRunResult } from "./loreScenario.js";

// 运行库各域计数（import 物化后）。直接 COUNT 表行——确定性。
export interface RunDbCounts {
  lore: number; rules: number; pools: number; stateCells: number;
  fronts: number; plotlines: number; foreshadows: number; anchors: number; watchers: number;
}

function count(db: DB, table: string): number {
  return (db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as { n: number }).n;
}

export function runDbCounts(db: DB): RunDbCounts {
  return {
    lore: count(db, "lore"),
    rules: count(db, "rule"),
    pools: count(db, "pool"),
    stateCells: count(db, "state"),
    fronts: count(db, "front"),
    plotlines: count(db, "plotline"),
    foreshadows: count(db, "foreshadow"),
    anchors: count(db, "anchor"),
    watchers: count(db, "watcher"),
  };
}

// 一条域地板的判定结果。
export interface DomainFloor { domain: string; expected: number; actual: number; pass: boolean }

export interface LoreGradeReport {
  scenario: string;
  // 构建指令执行是否全部无错（任一 envelope.isError → 有错）。
  buildCallsOk: boolean;
  buildErrors: { tool: string; message: string }[];
  committed: boolean;             // 场景是否产出了 commit（importResult 才有意义）。
  counts: RunDbCounts | null;     // 未 commit → null。
  // 域计数地板：各域实际行数 ≥ 期望。仅对 expects 里声明的域施加。
  domainFloors: DomainFloor[];
  // 精确点检：指定 id 的 front / plotline 是否在运行库存在。
  hasFront: { id: string; present: boolean }[];
  hasPlotline: { id: string; present: boolean }[];
  // validate 期望（若声明）：场景里 validate 工具调用的 report.ok 是否为期望值。
  validate: { expected: boolean; actual: boolean | null; pass: boolean } | null;
  // 总判：构建无错 ∧ 所有域地板 pass ∧ 所有点检 present ∧ validate（若声明）pass。
  pass: boolean;
}

// 从 LoreRunResult 抽出 validate 工具的 report.ok（场景里若调过 dicelore_build_validate）。
function validateOkFromCalls(run: LoreRunResult): boolean | null {
  for (const { call, envelope } of run.callResults) {
    if (call.tool === "validate" && !envelope.isError) {
      const sc = envelope.structuredContent as { ok?: boolean } | undefined;
      if (sc && typeof sc.ok === "boolean") return sc.ok;
    }
  }
  return null;
}

// 机械评分（零 LLM）：跑完一条 lore 场景后，按 expects 判各域地板 + 点检 + validate。
export function gradeLoreRun(run: LoreRunResult): LoreGradeReport {
  const expects: LoreExpects = run.scenario.expects ?? {};

  const buildErrors = run.callResults
    .filter((r) => r.envelope.isError)
    .map((r) => ({
      tool: r.call.tool,
      message: (() => {
        try {
          const o = JSON.parse(r.envelope.content?.[0]?.text ?? "{}") as { error?: { message?: string } };
          return o.error?.message ?? "(unknown)";
        } catch { return r.envelope.content?.[0]?.text ?? "(unknown)"; }
      })(),
    }));
  const buildCallsOk = buildErrors.length === 0;

  const committed = run.commitId != null && run.importResult != null;
  const counts = committed ? runDbCounts(run.runDb) : null;

  // 域计数地板：仅对 expects 里显式声明的域施加（缺省=不适用，不判）。
  const domainFloors: DomainFloor[] = [];
  const domainKeys: (keyof RunDbCounts)[] = [
    "lore", "rules", "pools", "stateCells", "fronts", "plotlines", "foreshadows", "anchors", "watchers",
  ];
  for (const key of domainKeys) {
    const expected = expects[key];
    if (expected === undefined) continue;
    const actual = counts ? counts[key] : 0;
    domainFloors.push({ domain: key, expected, actual, pass: actual >= expected });
  }

  // 精确点检：指定 id 的 front / plotline 是否在运行库存在。
  const hasFront = (expects.hasFront ?? []).map((id) => ({
    id,
    present: counts != null && (run.runDb.prepare("SELECT 1 FROM front WHERE id=?").get(id) != null),
  }));
  const hasPlotline = (expects.hasPlotline ?? []).map((id) => ({
    id,
    present: counts != null && (run.runDb.prepare("SELECT 1 FROM plotline WHERE id=?").get(id) != null),
  }));

  // validate 期望。
  let validate: LoreGradeReport["validate"] = null;
  if (expects.validatePasses !== undefined) {
    const actual = validateOkFromCalls(run);
    validate = { expected: expects.validatePasses, actual, pass: actual === expects.validatePasses };
  }

  const pass =
    buildCallsOk &&
    domainFloors.every((f) => f.pass) &&
    hasFront.every((h) => h.present) &&
    hasPlotline.every((h) => h.present) &&
    (validate ? validate.pass : true);

  return {
    scenario: run.scenario.id,
    buildCallsOk,
    buildErrors,
    committed,
    counts,
    domainFloors,
    hasFront,
    hasPlotline,
    validate,
    pass,
  };
}
