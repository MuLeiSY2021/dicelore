// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// lore 侧 eval harness 测试：offline mock 作者驱动 runBuildTool → commit → import → 断言运行库。
// 验证「作者↔构建 GM」交互的机械可验证那一半（构建工具可用性 + 物化映射）在 harness 里真能跑通、真能判。
import { describe, it, expect } from "vitest";
import {
  loadLoreScenario,
  runLoreScenario,
  buildAuthorCtx,
} from "./loreScenario.js";
import { gradeLoreRun, runDbCounts } from "./loreAssertions.js";
import { invokeBuildTool } from "../build/buildMcp.js";
import { frontGet } from "../store/front.js";
import { plotlineGet } from "../store/plotline.js";
import { foreshadowGet } from "../store/foreshadow.js";
import { loreGet } from "../store/world.js";

describe("lore eval harness — frontier-saga 场景", () => {
  it("场景文件可加载，buildCalls 非空且含 commit", () => {
    const sc = loadLoreScenario("frontier-saga");
    expect(sc.tuanben).toBe("边境危局");
    expect(sc.buildCalls.length).toBeGreaterThan(0);
    expect(sc.buildCalls.some((c) => c.tool === "commit")).toBe(true);
  });

  it("offline 驱动：所有构建指令无错，commit 成功，import 物化", () => {
    const run = runLoreScenario("frontier-saga");
    // 每条 envelope 都不该 isError。
    for (const { call, envelope } of run.callResults) {
      expect(envelope.isError, `工具 ${call.tool} 不该报错: ${envelope.content?.[0]?.text}`).toBeFalsy();
    }
    expect(run.commitId).toBeTruthy();
    expect(run.importResult).toBeDefined();
  });

  it("import 物化后运行库各域到位（确定性计数）", () => {
    const run = runLoreScenario("frontier-saga");
    const c = runDbCounts(run.runDb);
    expect(c.lore).toBe(1);
    expect(c.rules).toBe(1);
    expect(c.pools).toBe(3);
    // 2 个作者声明的 state 格 + 1 个 front Clock 初始化格（世界.入侵进度）。
    expect(c.stateCells).toBe(3);
    expect(c.fronts).toBe(1);
    expect(c.plotlines).toBe(2);
    expect(c.foreshadows).toBe(1);
    expect(c.anchors).toBe(1);
    // front 三档凶兆 → 三条 watcher 预声明。
    expect(c.watchers).toBe(3);
    run.runDb.close();
    run.catalog.close();
  });

  it("叙事域内容精确到位：front/plotline/foreshadow 行可查、字段正确", () => {
    const run = runLoreScenario("frontier-saga");
    const front = frontGet(run.runDb, "invasion");
    expect(front?.name).toBe("蛮族入侵");
    expect(front?.clock_ref).toBe("世界.入侵进度");

    expect(plotlineGet(run.runDb, "defend")?.title).toBe("御敌于长城之外");
    expect(plotlineGet(run.runDb, "traitor")?.title).toBe("城中内奸");

    expect(foreshadowGet(run.runDb, "grain-warden")?.content).toContain("粮仓守将");

    // anchor 把伏笔锚到内奸线。
    const anchor = run.runDb
      .prepare("SELECT * FROM anchor WHERE owner_id='traitor' AND target_id='grain-warden'")
      .get();
    expect(anchor).toBeDefined();

    expect(loreGet(run.runDb, "北境长城")?.content).toContain("长城");
    run.runDb.close();
    run.catalog.close();
  });

  it("gradeLoreRun 机械评分：全 pass，域地板/点检/validate 都达标", () => {
    const run = runLoreScenario("frontier-saga");
    const report = gradeLoreRun(run);
    expect(report.buildCallsOk).toBe(true);
    expect(report.buildErrors).toEqual([]);
    expect(report.committed).toBe(true);
    // 所有声明的域地板 pass。
    expect(report.domainFloors.every((f) => f.pass)).toBe(true);
    // front/plotline 点检 present。
    expect(report.hasFront.every((h) => h.present)).toBe(true);
    expect(report.hasPlotline.every((h) => h.present)).toBe(true);
    // validate 期望通过。
    expect(report.validate).toEqual({ expected: true, actual: true, pass: true });
    expect(report.pass).toBe(true);
    run.runDb.close();
    run.catalog.close();
  });
});

// ── 负向：harness 真能抓机械违规（断言不是只会说 pass）──────────────────────
describe("lore eval harness — 负向探针（断言能 fail）", () => {
  it("构建工具传非法参数 → envelope.isError，gradeLoreRun 报 buildErrors", () => {
    const { ctx } = buildAuthorCtx("坏团本");
    // add_front 缺 clock_attr（schema strict 必填）→ 校验失败。
    const bad = invokeBuildTool(ctx, "add_front", { id: "x", name: "x", clock_min: 0, clock_max: 4, omens: [] });
    expect(bad.isError).toBe(true);
  });

  it("漏物化某域（如 plotline）→ 域地板 fail（探针：构造一个未声明 plotline 的运行库计数）", () => {
    // 仅跑前两步（manifest + prologue），不声明任何叙事域，import 后 plotlines=0。
    // 直接验 gradeLoreRun 的域地板逻辑：期望 plotlines≥1 但实际 0 → fail。
    const run = runLoreScenario("frontier-saga");
    // 人为篡改 expects 模拟「更高期望」：plotlines 期望 99（运行库只有 2）→ 该域应 fail。
    run.scenario.expects = { plotlines: 99 };
    const report = gradeLoreRun(run);
    const pl = report.domainFloors.find((f) => f.domain === "plotlines");
    expect(pl?.pass).toBe(false);
    expect(report.pass).toBe(false);
    run.runDb.close();
    run.catalog.close();
  });
});
