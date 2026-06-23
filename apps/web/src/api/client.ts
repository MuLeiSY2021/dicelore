// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { PresentationSnapshot, SessionSummary } from "@dicelore/shared";

// 只读：取全量呈现快照(接口页 §2 GET /sessions/:id/presentation)。增量 WS 仍阻塞。
export async function getPresentation(sessionId: string): Promise<PresentationSnapshot> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/presentation`);
  if (!res.ok) throw new Error(`presentation 请求失败：${res.status}`);
  return (await res.json()) as PresentationSnapshot;
}

// 会话列表(主页继续上次 / 最近 Session)。
export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/sessions");
  if (!res.ok) throw new Error(`sessions 请求失败：${res.status}`);
  return ((await res.json()) as { sessions: SessionSummary[] }).sessions;
}

// 动作进：玩家自由文本输入(接口页 §2 POST /sessions/:id/messages)。
export async function postMessage(sessionId: string, text: string): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`message 请求失败：${res.status}`);
  return (await res.json()) as { turnId: string };
}

// 明骰：玩家点击触发掷骰(POST /sessions/:id/roll)。
export async function postRoll(sessionId: string, eventId: number): Promise<{ turnId: string }> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/roll`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId }),
  });
  if (!res.ok) throw new Error(`roll 请求失败：${res.status}`);
  return (await res.json()) as { turnId: string };
}

// ===== 团本目录录(后端双路径架构 P2/P3/P5)=====
export interface TuanbenSummary { id: string; name: string; head: string | null; tags: string[] }
export interface PackFile { path: string; content: string }

// 列团本(主页选团本玩 / 构建台列表)。
export async function listCatalog(): Promise<TuanbenSummary[]> {
  const res = await fetch("/catalog");
  if (!res.ok) throw new Error(`catalog 请求失败：${res.status}`);
  return ((await res.json()) as { tuanben: TuanbenSummary[] }).tuanben;
}

// 直接提交一个团本版本(程序化建包)。
export async function commitPack(name: string, message: string, files: PackFile[]): Promise<{ tuanbenId: string; commitId: string }> {
  const res = await fetch("/catalog/commit", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, message, files }),
  });
  if (!res.ok) throw new Error(`commit 请求失败：${res.status}`);
  return (await res.json()) as { tuanbenId: string; commitId: string };
}

// 开新局:选团本版本 import → 运行库(POST /sessions/:id/open)。
export async function openPlaySession(sessionId: string, tuanbenId: string, ref: string): Promise<void> {
  const res = await fetch(`/sessions/${encodeURIComponent(sessionId)}/open`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tuanbenId, ref }),
  });
  if (!res.ok) throw new Error(`open 请求失败：${res.status}`);
}
