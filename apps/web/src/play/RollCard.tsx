// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { PendingRoll } from "@dicelore/shared";

// BG3 掷骰卡(最小)：亮 DC/exprDisplay/区间 + 单按钮触发；动效精修延后。
export function RollCard({ pendingRoll, onRoll }: { pendingRoll: PendingRoll; onRoll: (eventId: number) => void }) {
  const p = pendingRoll;
  return (
    <div className="rollcard" style={{ border: "1px solid var(--acc)", borderRadius: 8, padding: 12, background: "var(--surface2)" }}>
      <div style={{ fontFamily: "var(--font-display)", color: "var(--acc-soft)" }}>{p.label}</div>
      <div style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>
        {p.yourSide.name}：{p.yourSide.exprDisplay}{p.dc != null ? ` vs DC ${p.dc}` : ""}
      </div>
      {p.bands?.map((b) => (
        <div key={b.label} style={{ fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
          {b.label}：{b.min}–{b.max}
        </div>
      ))}
      <button
        onClick={() => onRoll(p.eventId)}
        style={{ marginTop: 8, padding: "8px 16px", background: "var(--acc)", color: "var(--acc-on)", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
      >
        丢骰子 d{p.shape === "outcome" ? "100" : "20"}
      </button>
    </div>
  );
}
