// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { buildSessionContext, metaGet, type DB } from "@dicelore/core";

// 开场 prompt = 引擎 signpost(GM 身份/Agenda/纪律) + gm-core 教条全文 + 团本 prologue(AD-2 叠加)。
//
// ⚠️ STOPGAP(2026-06-23)：signpost 让 GM「consult dicelore-gm-core skill」，但 DiceGm 设
// settingSources:[](ADR-0020 不读本地 .claude),skill 加载不到 → GM 拿到指针却无教条正文,
// 真 GM 会吐「The skill isn't registered here…」之类 OOC 元话。此处把 gm-core SKILL.md 正文
// 内联进 systemPrompt 作兜底,使 GM 当下可正常入戏。
// **真解属后端 skill-可达 决策**(spec §2/§3：内联 vs 松 settingSources vs 把 skills 软链进
// .claude vs 渐进披露由 agent 自调),定了之后替换本兜底。flow-* 流程 skill 仍未接(同一决策)。
function gmCoreDoctrine(): string {
  const candidates: string[] = [];
  try {
    const req = createRequire(import.meta.url);
    candidates.push(req.resolve("@dicelore/core").replace(/src[/\\]index\.ts$/, "skills/dicelore-gm-core/SKILL.md"));
  } catch { /* resolve 失败走 cwd 兜底 */ }
  candidates.push(`${process.cwd()}/packages/core/skills/dicelore-gm-core/SKILL.md`);
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, "utf8");
      return raw.replace(/^---[\s\S]*?---\s*/, "").replace(/<!--[\s\S]*?-->/g, "").trim();
    } catch { /* 下一候选 */ }
  }
  return "";
}

let _doctrine: string | null = null;
function doctrine(): string { return (_doctrine ??= gmCoreDoctrine()); }

export function buildOpeningPrompt(db: DB): string {
  const signpost = buildSessionContext(db);
  const prologue = metaGet(db, "prologue");
  const core = doctrine();
  const head = core ? `${signpost}\n\n---\n\n${core}` : signpost;
  return prologue ? `${head}\n\n---\n\n# 团本开场\n\n${prologue}` : head;
}
