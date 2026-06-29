// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import type { LogRow } from "../store/event/record.js";
import { narrateLeak, missingNarrate, toolStats, rollFloor, closureFloor } from "./assertions.js";

let seqCounter = 0;
function ev(kind: LogRow["kind"], content: string, data?: unknown, extra?: Partial<LogRow>): LogRow {
  return {
    seq: ++seqCounter, content, kind,
    data_json: data ? JSON.stringify(data) : null,
    tags: null, visible: 1, game_time: null, is_moment: 0, created_at: "",
    ...extra,
  };
}

describe("narrateLeak（正文复述 narrate = 浪费 token）", () => {
  it("正文逐字复述 narrate → leak=true、overlap 高", () => {
    const prose = "雨下了三天，没停的意思。你坐在断锚酒馆最里的桌子。";
    const r = narrateLeak({ assistantText: prose, narrateTexts: [prose] });
    expect(r.leak).toBe(true);
    expect(r.overlap).toBeGreaterThan(0.8);
  });

  it("正文为空（散文只进 narrate）→ leak=false", () => {
    const r = narrateLeak({ assistantText: "", narrateTexts: ["雨下了三天，没停的意思。你坐在断锚酒馆。"] });
    expect(r.leak).toBe(false);
    expect(r.assistantProse).toBe(0);
  });

  it("正文只有简短工具编排话（不复述剧情）→ leak=false", () => {
    const r = narrateLeak({
      assistantText: "好的，我来裁决这次说服。",
      narrateTexts: ["雨下了三天，没停的意思。你坐在断锚酒馆最里的那张桌子，后背贴着潮冷石墙。"],
    });
    expect(r.leak).toBe(false);
  });
});

describe("missingNarrate（漏 narrate）", () => {
  it("正文有实质剧情但本轮无 narrate event → true", () => {
    expect(missingNarrate({ assistantText: "你推开门，一股血腥味扑面而来，三个哥布林围着篝火。", narrateCount: 0 })).toBe(true);
  });
  it("有 narrate event → false", () => {
    expect(missingNarrate({ assistantText: "你推开门……", narrateCount: 1 })).toBe(false);
  });
  it("正文空白 + 无 narrate（纯工具轮）→ false（不算漏）", () => {
    expect(missingNarrate({ assistantText: "  ", narrateCount: 0 })).toBe(false);
  });
});

describe("toolStats（工具使用画像，供报告 + grader）", () => {
  it("按 kind 计数 + 明暗骰区分（verdict.data_json.gated）", () => {
    const events: LogRow[] = [
      ev("narrate", "x"),
      ev("verdict", "命中", { gated: true }),   // 明骰
      ev("verdict", "暗检定", { gated: false }), // 暗骰
      ev("choice", "怎么走", { options: [] }),
      ev("mutation", "掉血"),
    ];
    const s = toolStats(events);
    expect(s.narrate).toBe(1);
    expect(s.choice).toBe(1);
    expect(s.mutation).toBe(1);
    expect(s.verdictGated).toBe(1);   // 明骰
    expect(s.verdictAuto).toBe(1);    // 暗骰
  });
});

// ── F1 机械地板：掷骰绕过检测 ──
// 场景 expects.minVerdicts 声明「该场景必须出现 ≥N 次裁决(verdict)」。GM 不掷骰、纯散文编成败 = 绕过。
// 这是确定性机械判定：数 verdict event + 看是否有 narrate 抢在所有 verdict 之前(绕过签名)。
describe("rollFloor（F1 掷骰绕过：该检定处真发起了 roll 而非散文编结果）", () => {
  it("期望掷骰但全程零 verdict → fail（纯散文绕过）", () => {
    const events: LogRow[] = [
      ev("narrate", "你扑上去，一口咬断了它的脖子，鲜血四溅，猎物当场毙命。"),
    ];
    const r = rollFloor(events, { minVerdicts: 1 });
    expect(r.floor).toBe("fail");
    expect(r.verdictCount).toBe(0);
    expect(r.reason).toMatch(/绕过|未掷|无.*verdict/);
  });

  it("期望掷骰且有 verdict（明骰）→ pass", () => {
    const events: LogRow[] = [
      ev("verdict", "命中检定", { gated: true, band: { label: "命中" } }),
      ev("narrate", "你的利爪撕开它的喉咙。"),
    ];
    const r = rollFloor(events, { minVerdicts: 1 });
    expect(r.floor).toBe("pass");
    expect(r.verdictCount).toBe(1);
  });

  it("verdict 数量不足 minVerdicts → fail", () => {
    const events: LogRow[] = [
      ev("verdict", "第一次检定", { gated: true }),
      ev("narrate", "第一击命中。"),
      ev("narrate", "第二击你直接砍翻了它。"), // 第二个动作没掷
    ];
    const r = rollFloor(events, { minVerdicts: 2 });
    expect(r.floor).toBe("fail");
    expect(r.verdictCount).toBe(1);
  });

  it("narrate 抢在所有 verdict 之前出带成败的结果 → narrateBeforeVerdict=true（绕过签名）", () => {
    const events: LogRow[] = [
      ev("narrate", "你一剑刺穿了它的心脏，它倒下了。"), // 先编了结果
      ev("verdict", "事后补的检定", { gated: true }),     // 才补掷
    ];
    const r = rollFloor(events, { minVerdicts: 1 });
    expect(r.narrateBeforeVerdict).toBe(true);
    // verdict 存在故 verdictCount 满足，但时序可疑被标记
    expect(r.verdictCount).toBe(1);
    expect(r.floor).toBe("fail"); // 时序绕过同样算地板违规
  });

  it("verdict 早于其后的结果 narrate → narrateBeforeVerdict=false、pass", () => {
    const events: LogRow[] = [
      ev("verdict", "命中检定", { gated: true }),
      ev("narrate", "命中了，它哀嚎着退后。"),
    ];
    const r = rollFloor(events, { minVerdicts: 1 });
    expect(r.narrateBeforeVerdict).toBe(false);
    expect(r.floor).toBe("pass");
  });

  it("场景不期望掷骰（minVerdicts=0）→ 永远 pass（不强加地板）", () => {
    const events: LogRow[] = [ev("narrate", "你走在雨夜的小镇上，灯火昏黄。")];
    const r = rollFloor(events, { minVerdicts: 0 });
    expect(r.floor).toBe("pass");
  });
});

// ── F2 弱机械地板：软着陆 / 终局收束的存在性检查 ──
// 弱 = 只检测「收束/终局信号是否出现」，不硬判对错（软着陆好坏是语义判断，归 grader）。
// 信号源：is_moment 标记 / 收束参考词出现 / game_time 推进。缺失只给 advisory，绝不 block。
describe("closureFloor（F2 弱地板：终局收束信号存在性，绝不硬判）", () => {
  it("出现 is_moment 标记 → present、floor 恒为 'advisory'", () => {
    const events: LogRow[] = [
      ev("narrate", "尘埃落定。", undefined, { is_moment: 1 }),
    ];
    const r = closureFloor(events, { closure: true });
    expect(r.signalPresent).toBe(true);
    expect(r.floor).toBe("advisory"); // 弱地板永不 pass/fail，只 advisory
  });

  it("narrate 含收束参考词 → present", () => {
    const events: LogRow[] = [
      ev("narrate", "至此，这趟狩猎告一段落，你拖着猎物回到营地。"),
    ];
    const r = closureFloor(events, { closure: true });
    expect(r.signalPresent).toBe(true);
  });

  it("无任何收束信号 → absent、但仍 advisory（不 fail）", () => {
    const events: LogRow[] = [
      ev("narrate", "你继续往林子深处走，前方传来窸窣声。"),
    ];
    const r = closureFloor(events, { closure: true });
    expect(r.signalPresent).toBe(false);
    expect(r.floor).toBe("advisory");
    expect(r.note).toMatch(/收束|终局|未见/);
  });

  it("场景未声明 closure → 不适用（signalPresent=null）", () => {
    const events: LogRow[] = [ev("narrate", "雨还在下。")];
    const r = closureFloor(events, { closure: false });
    expect(r.signalPresent).toBeNull();
    expect(r.floor).toBe("advisory");
  });
});
