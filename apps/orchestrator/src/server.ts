// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { serve } from "@hono/node-server";
import { openDb, initSchema } from "@dicelore/core";
import { createLiveApp } from "./api/dice.js";
import { attachWsUpgrade } from "./api/ws.js";
import { listSessionSummaries } from "./dice/sessions.js";
import type { DiceSession } from "./dice/DiceSession.js";
import type { Agent } from "./pkg/agent.js";
import { DiceGm } from "./dice/DiceGm.js";
import { FakeDiceGm } from "./dice/FakeDiceGm.js";

export function startServer(port: number): void {
  const dir = process.env.DICELORE_SESSIONS_DIR ?? ".";
  const openSession = (id: string) => { const db = openDb(`${dir}/${id}.db`); initSchema(db); return db; };
  // DICELORE_FAKE_GM=1：脚本化假 GM(端到端测试,不烧 LLM)；否则真 Agent SDK。
  const driverFactory: (host: DiceSession) => Agent = process.env.DICELORE_FAKE_GM === "1"
    ? () => new FakeDiceGm((input) => [{ type: "narration", text: `（GM）你说：「${input.text}」。门吱呀一声开了。` }, { type: "turn_end" }])
    : (host) => new DiceGm({ mcpServer: host.mcpServer });

  const app = createLiveApp({ driverFactory, openSession, listSessions: () => listSessionSummaries(dir) });
  const server = serve({ fetch: app.fetch, port });
  attachWsUpgrade(server, { openSession, driverFactory });
  console.log(`[orchestrator] live :${port}`);
}

// tsx src/server.ts 直接起
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  startServer(Number(process.env.PORT ?? 8787));
}
