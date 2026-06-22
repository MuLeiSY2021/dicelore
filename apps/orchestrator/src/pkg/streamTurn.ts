// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { CLIENT_PROTOCOL, type StreamMessage } from "@dicelore/shared";
import type { Agent, TurnInput } from "./agent.js";
import type { WsHub } from "./wsHub.js";

export interface StreamTurnDeps {
  driver: Agent;
  hub: WsHub;
  sessionId: string;
  turnId: string;
}

// 驱动 Agent 事件流 → 广播 turn_started + 逐条 narration_commit；遇 error 发 error 并返回 errored。
// 不发 turn_ended——回合收尾由调用者按场景决定(dice 跑 turn-end hook,lore 直接结束)。
export async function streamDriverTurn(deps: StreamTurnDeps, input: TurnInput): Promise<{ seq: number; errored: boolean }> {
  const { hub, sessionId, turnId } = deps;
  const send = (m: StreamMessage) => hub.broadcast(sessionId, m);
  send({ protocol: CLIENT_PROTOCOL, type: "turn_started", turnId });
  let seq = 0;
  try {
    for await (const ev of deps.driver.runTurn(input)) {
      if (ev.type === "narration") {
        seq += 1;
        send({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq, text: ev.text });
      } else if (ev.type === "error") {
        send({ protocol: CLIENT_PROTOCOL, type: "error", code: "gm_error", message: ev.message });
        return { seq, errored: true };
      } else if (ev.type === "turn_end") {
        break;
      }
    }
  } catch (e) {
    send({ protocol: CLIENT_PROTOCOL, type: "error", code: "driver_error", message: e instanceof Error ? e.message : String(e) });
    return { seq, errored: true };
  }
  return { seq, errored: false };
}
