// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState, useCallback } from "react";
import type { PresentationSnapshot, PendingRoll, StreamMessage } from "@dicelore/shared";
import { getPresentation, postMessage as apiPostMessage, postRoll as apiPostRoll } from "../api/client.js";

// WS 客户端：连 /sessions/:id/ws，分发流消息。
// presentation_delta/choices → refetch 全量对账(Phase 1)；roll_staged → 弹卡；roll_committed → 清卡 + 对账。
export function useSession(sessionId: string) {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);
  const [narration, setNarration] = useState<string[]>([]);
  const [pendingRoll, setPendingRoll] = useState<PendingRoll | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const refetch = useCallback(() => { getPresentation(sessionId).then(setSnapshot).catch(() => {}); }, [sessionId]);

  useEffect(() => {
    refetch();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/sessions/${encodeURIComponent(sessionId)}/ws`);
    wsRef.current = ws;
    ws.onmessage = (e: MessageEvent) => {
      let msg: StreamMessage;
      try { msg = JSON.parse(e.data) as StreamMessage; } catch { return; }
      switch (msg.type) {
        case "narration_commit": setNarration((n) => [...n, msg.text]); break;
        case "presentation_delta": refetch(); break;
        case "choices": refetch(); break;
        case "roll_staged": setPendingRoll(msg.pendingRoll); break;
        case "roll_committed": setPendingRoll(null); refetch(); break;
        default: break;
      }
    };
    return () => ws.close();
  }, [sessionId, refetch]);

  const postMessage = useCallback((text: string) => apiPostMessage(sessionId, text), [sessionId]);
  const roll = useCallback((eventId: number) => apiPostRoll(sessionId, eventId), [sessionId]);
  return { snapshot, narration, pendingRoll, postMessage, roll };
}
