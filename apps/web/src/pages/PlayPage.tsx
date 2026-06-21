// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState, type KeyboardEvent } from "react";
import { useSession } from "../live/useSession.js";
import { PresentationStage } from "../play/PresentationStage.js";
import { RollCard } from "../play/RollCard.js";
import "./PlayPage.css";

// v1：会话选择(主页继续上次)尚未实现，跑团页先固定 demo 会话。
const DEMO_SESSION = "demo";

export default function PlayPage() {
  const { snapshot, narration, pendingRoll, postMessage, roll } = useSession(DEMO_SESSION);
  const [draft, setDraft] = useState("");

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && draft.trim()) {
      postMessage(draft.trim()).catch(() => {});
      setDraft("");
    }
  };

  return (
    <div className="play">
      <aside className="rail" aria-label="活动轨">设定 / 规则 / 日志 / 会话</aside>
      <section className="center" aria-label="叙事">
        <div className="narration">
          {narration.length === 0
            ? <p style={{ color: "var(--text3)" }}>等待 GM 开场……</p>
            : narration.map((para, i) => <p key={i} style={{ color: "var(--text)" }}>{para}</p>)}
        </div>
        <div className="typer">
          {pendingRoll
            ? <RollCard pendingRoll={pendingRoll} onRoll={(id) => roll(id).catch(() => {})} />
            : <input
                aria-label="输入"
                value={draft}
                placeholder="你做什么？（回车发送）"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                style={{ width: "100%", padding: 10, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 6 }}
              />}
        </div>
      </section>
      <aside className="stage" aria-label="呈现台">
        <PresentationStage snapshot={snapshot} />
      </aside>
    </div>
  );
}
