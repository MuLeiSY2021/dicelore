// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, Dices, Hammer, MessagesSquare, Settings, Swords, Clock, Flag } from "lucide-react";
import type { SessionSummary } from "@dicelore/shared";
import { listSessions, commitPack, openPlaySession } from "../api/client.js";

// 示例团本(快速验证「建团本→开局玩」闭环;无需 LLM)。
const SAMPLE_PACK = [
  { path: "manifest.md", content: "# 示例·黑风寨\n\n- id: sample" },
  { path: "lore/黑风寨.md", content: "黑风寨盘踞鹰愁涧,当家钟三爷使子母钟锤。" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n旅人,player,HP,12,1\n旅人,player,身上银两,30,1\n" },
];

const STATUS_LABEL: Record<SessionSummary["status"], string> = {
  active: "进行中",
  archived: "已存档",
  ended: "终局",
};
const STATUS_ICON: Record<SessionSummary["status"], typeof Swords> = {
  active: Swords,
  archived: Clock,
  ended: Flag,
};

const QUICK = [
  { Icon: Dices, qt: "开新局", qd: "选团本 / 存档起一局", to: "/play" },
  { Icon: Hammer, qt: "团本制作", qd: "丢本小说造团本", to: "/build" },
  { Icon: MessagesSquare, qt: "会话管理", qd: "搜索 / 续档 / 删档", to: "/config" },
  { Icon: Settings, qt: "配置", qd: "服务 / MCP / 模型", to: "/config" },
];

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // 造示例团本 → 开局 import → 跳跑团页(端到端闭环)。
  async function quickPlay() {
    setBusy(true);
    setError(null);
    try {
      const { tuanbenId, commitId } = await commitPack("示例·黑风寨", "sample", SAMPLE_PACK);
      const sid = `s-${commitId.slice(0, 8)}`;
      await openPlaySession(sid, tuanbenId, commitId);
      navigate(`/play/${sid}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    listSessions()
      .then((s) => { if (alive) setSessions(s); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const list = sessions ?? [];
  const last = list[0];

  return (
    <main className="home">
      <div className="hello">Good evening · 旅人</div>
      <div className="htitle">{last ? `夜还长，要继续${last.title}吗？` : "欢迎回到案上"}</div>
      <div className="hsub">
        {error ? "" : last ? "上次的故事还在等你落座。" : "选一个团本，开一局新的故事。"}
      </div>

      {error && <div className="herror">加载失败：{error}</div>}

      <div className="resume" aria-label="快速开局">
        <div className="meta">
          <div className="scen">示例·黑风寨</div>
          <div className="where">一键造示例团本并开局(验证闭环)</div>
        </div>
        <button className="cont" onClick={quickPlay} disabled={busy} data-testid="quick-play">
          <Play className="lucide" />{busy ? "开局中…" : "造团本并开局"}
        </button>
      </div>

      {last && (
        <div className="resume" aria-label="继续上次">
          <div className="meta">
            <div className="scen">{last.title}</div>
            <div className="where">{STATUS_LABEL[last.status]}{last.updatedAt ? ` · ${new Date(last.updatedAt).toLocaleString()}` : ""}</div>
          </div>
          <Link className="cont" to="/play"><Play className="lucide" />继续跑团</Link>
        </div>
      )}

      <div className="quick">
        {QUICK.map(({ Icon, qt, qd, to }) => (
          <Link className="qcard" to={to} key={qt}>
            <div className="ico"><Icon className="lucide" /></div>
            <div className="qt">{qt}</div>
            <div className="qd">{qd}</div>
          </Link>
        ))}
      </div>

      <div className="label">最近 Session</div>
      <div className="recent">
        {list.length === 0 ? (
          <div className="row"><span className="rs">暂无会话，去开新局</span></div>
        ) : (
          list.map((s) => {
            const Icon = STATUS_ICON[s.status];
            return (
              <Link className="row" to="/play" key={s.sessionId}>
                <Icon className="lucide" />
                <span className="rs">{s.title}</span>
                <span className={"tag" + (s.status === "active" ? " live" : "")}>{STATUS_LABEL[s.status]}</span>
                {s.updatedAt && <span className="rt">{new Date(s.updatedAt).toLocaleDateString()}</span>}
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
