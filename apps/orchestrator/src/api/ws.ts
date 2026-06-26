// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { DB } from "@dicelore/core";
import { getLogger } from "@dicelore/core";
import { getOrCreateHost } from "../dice/registry.js";
import { restagePendingRolls, replayNarration } from "../dice/recovery.js";
import type { AgentFactory, SkillRef } from "../pkg/agent.js";

export interface WsUpgradeDeps {
  openSession: (id: string) => DB;
  agentFactory: AgentFactory;
  skills?: SkillRef[];
  model?: string;
  baseline?: boolean; // eval baseline 对照:透传 DiceSession
  debug?: boolean; // eval/裸 CC 明骰降级:透传 DiceSession(不注入 rollGate)
  sessionsDir?: string; // GM raw 日志根目录:透传 DiceSession→DiceGm(否则 WS 路径 sessionLogger 退化全局,GM 日志刷屏全局 debug.log)
}

// dice 会话 WS 升级(/sessions/:id/ws)挂到 http server——从原 startServer 内联块抽出,行为不变。
export function attachWsUpgrade(server: unknown, deps: WsUpgradeDeps): void {
  const wss = new WebSocketServer({ noServer: true });
  (server as { on(ev: string, cb: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): void }).on(
    "upgrade",
    (req, socket, head) => {
      const m = /^\/sessions\/([^/]+)\/ws(?:\?(.*))?$/.exec(req.url ?? "");
      if (!m) {
        // 非 dice 会话 WS 路径(其它升级请求/探测)→ 拒绝升级。warn:非预期路径打到此处。
        getLogger().warn({ url: req.url }, "WS 升级路径不匹配 /sessions/:id/ws,拒绝升级");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        const id = decodeURIComponent(m[1]);
        const host = getOrCreateHost(id, { db: deps.openSession(id), agentFactory: deps.agentFactory, skills: deps.skills, model: deps.model, baseline: deps.baseline, debug: deps.debug, sessionsDir: deps.sessionsDir });
        const wsLike = ws as unknown as { send(d: string): void; readyState: number };
        host.attachWs(wsLike);
        const since = new URLSearchParams(m[2] ?? "").get("since");
        getLogger().info({ sessionId: id, since: since ?? undefined }, "WS 连接建立");
        restagePendingRolls(host); // 重连/重启 → 重弹未决掷骰卡
        // B2：重连带 ?since=<narrativeCursor> 时补叙述历史(无 since=首连,客户端走 snapshot+GET /events,不重发避重复)。
        if (since !== null) replayNarration(host, Number(since) || 0);
        ws.on("error", (err) => {
          // WS 传输层错误(对端异常/网络抖动);连接随后多会触发 close,此处只记不额外清理。
          getLogger().warn({ sessionId: id, err }, "WS 连接错误");
        });
        ws.on("close", (code?: number) => {
          getLogger().info({ sessionId: id, code }, "WS 连接断开");
          host.detachWs(wsLike);
        });
      });
    },
  );
}
