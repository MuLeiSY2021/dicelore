// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { LogRow } from "../store/record.js";

// eval 机械断言地板（客观、确定性、零 LLM）。语义判断（软着陆、明暗骰选对、与真人 GM 质量差距）
// 归带语料参考的 grader（见 eval/grader.md），不在此。本模块只判能机械确证的：
// narrate 泄漏（token 浪费）、漏 narrate、工具使用画像。

// 字符 n-gram shingle 集合（去空白），用于文本重叠度。
function shingles(s: string, n = 6): Set<string> {
  const t = s.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n));
  return out;
}

// b 有多少比例出现在 a 中（|shingles(b) ∩ shingles(a)| / |shingles(b)|）。
function overlapRatio(a: string, b: string): number {
  const sb = shingles(b);
  if (sb.size === 0) return 0;
  const sa = shingles(a);
  let hit = 0;
  for (const g of sb) if (sa.has(g)) hit++;
  return hit / sb.size;
}

export interface NarrateLeakInput { assistantText: string; narrateTexts: string[] }
export interface NarrateLeakResult { assistantProse: number; overlap: number; leak: boolean }

// 玩家视图只认 narrate（+面板）；GM 在正文里复述的剧情玩家看不到、且白生成 = 浪费 token。
// leak ⟺ 正文有实质内容（>20 字）∧ 与 narrate 高度重叠（>0.5）。阈值可随 eval 调。
export function narrateLeak(input: NarrateLeakInput): NarrateLeakResult {
  const assistantProse = input.assistantText.trim().length;
  const overlap = overlapRatio(input.assistantText, input.narrateTexts.join(""));
  return { assistantProse, overlap, leak: assistantProse > 20 && overlap > 0.5 };
}

// 漏 narrate：正文有实质剧情（>20 字）但本轮无 narrate event（散文没进可审计/可召回/可呈现的通道）。
export function missingNarrate(input: { assistantText: string; narrateCount: number }): boolean {
  return input.assistantText.trim().length > 20 && input.narrateCount === 0;
}

export interface ToolStats {
  narrate: number; reveal: number; choice: number; mutation: number; watcherFired: number; note: number;
  verdictGated: number; // 明骰（resolve_*_open，data_json.gated=true）
  verdictAuto: number;  // 暗骰（resolve_*_hidden）
}

// 工具使用画像：供报告 + grader 参考（不直接判分）。
export function toolStats(events: LogRow[]): ToolStats {
  const s: ToolStats = { narrate: 0, reveal: 0, choice: 0, mutation: 0, watcherFired: 0, note: 0, verdictGated: 0, verdictAuto: 0 };
  for (const e of events) {
    switch (e.kind) {
      case "narrate": s.narrate++; break;
      case "reveal": s.reveal++; break;
      case "choice": s.choice++; break;
      case "mutation": s.mutation++; break;
      case "watcher_fired": s.watcherFired++; break;
      case "note": s.note++; break;
      case "verdict": {
        const gated = e.data_json ? (JSON.parse(e.data_json) as { gated?: boolean }).gated : false;
        if (gated) s.verdictGated++; else s.verdictAuto++;
        break;
      }
    }
  }
  return s;
}

// ── F1 机械地板：掷骰绕过检测 ──
// 病根：GM 在需要检定的情境下不发起 roll，直接在 narrate 里编出带成败的结果（"你一刀砍死它"），
// 机械层看不见 verdict event 就无从约束。本地板把"该检定处是否真落了 verdict"变成确定性判定。
//
// scenario.json 的 expects.minVerdicts 声明该场景的掷骰时序约束（玩家序列里有几个需检定的主动行动）。
// 判定（零 LLM）：
//   ① 计数地板：verdict 数 < minVerdicts → fail（漏掷 / 散文绕过）。
//   ② 时序地板：存在 narrate 抢在所有 verdict 之前（narrateBeforeVerdict）——典型绕过签名：
//      GM 先把结果写进散文、事后才补掷（或根本不掷）。minVerdicts>0 时这也算违规。
// 阈值/口径理由：minVerdicts 由场景显式声明而非全局常数，避免对"该不该掷"做语义猜测；
// 时序只看"首个 narrate 是否早于首个 verdict"这一最强信号，不追究逐条配对（那需语义，归 grader）。
export interface RollFloorExpect { minVerdicts: number }
export interface RollFloorResult {
  floor: "pass" | "fail";
  verdictCount: number;
  narrateBeforeVerdict: boolean; // 有 narrate 抢在所有 verdict 之前（绕过时序签名）
  reason?: string;
}
export function rollFloor(events: LogRow[], expect: RollFloorExpect): RollFloorResult {
  const verdictSeqs = events.filter((e) => e.kind === "verdict").map((e) => e.seq);
  const narrateSeqs = events.filter((e) => e.kind === "narrate").map((e) => e.seq);
  const verdictCount = verdictSeqs.length;

  // minVerdicts=0：场景不期望掷骰，地板不适用 → 永远 pass。
  if (expect.minVerdicts <= 0) {
    return { floor: "pass", verdictCount, narrateBeforeVerdict: false };
  }

  const firstVerdict = verdictSeqs.length ? Math.min(...verdictSeqs) : Infinity;
  const firstNarrate = narrateSeqs.length ? Math.min(...narrateSeqs) : Infinity;
  // 有 verdict 且首个 narrate 早于首个 verdict = 先编结果后补掷（或结果散文 + 事后掷）。
  const narrateBeforeVerdict = verdictCount > 0 && firstNarrate < firstVerdict;

  if (verdictCount < expect.minVerdicts) {
    return {
      floor: "fail",
      verdictCount,
      narrateBeforeVerdict,
      reason: `期望 ≥${expect.minVerdicts} 次裁决(verdict)，实际 ${verdictCount}：疑似散文绕过掷骰（GM 未发起 roll 就编出成败）。`,
    };
  }
  if (narrateBeforeVerdict) {
    return {
      floor: "fail",
      verdictCount,
      narrateBeforeVerdict,
      reason: "存在 narrate 抢在所有 verdict 之前出结果：疑似先编结果、事后补掷（时序绕过）。",
    };
  }
  return { floor: "pass", verdictCount, narrateBeforeVerdict };
}

// ── F2 弱机械地板：软着陆 / 终局收束的存在性检查 ──
// F2＝软着陆/终局收束。"软着陆好不好、坏结果有没有被淡化"是语义判断（归 grader.md）；机械层只能做
// 弱信号：该收束的场景里，是否出现了任何"收束/终局"标记。故本地板是【弱】的——floor 恒为 "advisory"，
// 永不 pass/fail、永不 block，缺信号只提示评测者重点看（喂 grader 的 F2 线索），不替它下结论。
// 信号源（任一即视为 present）：
//   ① is_moment=1（引擎标记的关键时刻 / 收束节点）；
//   ② narrate/note 含收束参考词（告一段落 / 落定 / 终 / 收场 …）；
//   ③ game_time 推进（出现非空 game_time，时间跳进暗示场景收束）。
// 参考词表是"参考"非硬条件——命中即提示存在，未命中只是 absent advisory，不扣分（避免对措辞过拟合）。
const CLOSURE_WORDS = ["告一段落", "落定", "尘埃落定", "收场", "收束", "落幕", "终局", "至此", "故事的结尾", "画上句号"];
export interface ClosureFloorExpect { closure: boolean }
export interface ClosureFloorResult {
  floor: "advisory"; // 弱地板：恒 advisory，绝不硬判
  signalPresent: boolean | null; // null = 场景未声明 closure，不适用
  note?: string;
}
export function closureFloor(events: LogRow[], expect: ClosureFloorExpect): ClosureFloorResult {
  if (!expect.closure) return { floor: "advisory", signalPresent: null };

  const hasMoment = events.some((e) => e.is_moment === 1);
  const hasGameTime = events.some((e) => e.game_time != null && e.game_time.trim() !== "");
  const hasWord = events.some(
    (e) => (e.kind === "narrate" || e.kind === "note") && e.content != null && CLOSURE_WORDS.some((w) => e.content!.includes(w)),
  );
  const signalPresent = hasMoment || hasGameTime || hasWord;
  return {
    floor: "advisory",
    signalPresent,
    note: signalPresent
      ? "检出终局/收束信号（is_moment / 收束词 / game_time 推进之一）。软着陆质量仍需 grader 定性判。"
      : "未见任何收束信号：本场景期望软着陆/收束，请评测者重点核对 F2（是否硬着陆+fail-forward 收场）。",
  };
}
