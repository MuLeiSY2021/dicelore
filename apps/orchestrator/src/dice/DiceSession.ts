// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { openDb, initSchema, createMcpServer, buildPresentationModel, runTurnEnd, importPack, type DB, type CanonWriteEvent, type CatalogDB } from "@dicelore/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WsHub, type WsLike } from "../pkg/wsHub.js";
import { PlayerRollGate } from "./rollGate.js";
import { mapCanonWrite } from "./notify.js";
import { runTurn, type TurnEndResult } from "./turnLoop.js";
import type { Agent } from "../pkg/agent.js";
import type { Session } from "../pkg/session.js";

let turnCounter = 0; // 进程内自增,测试稳定(不依赖随机/时间)
function nextTurnId(sessionId: string): string { turnCounter += 1; return `${sessionId}-t${turnCounter}`; }

export interface DiceSessionDeps {
  db?: DB; // 省略则内存库(测试)
  driverFactory: (host: DiceSession) => Agent; // 每回合产一个 driver;真实现据 host.mcpServer 建 DiceGm
  importFrom?: { catalog: CatalogDB; tuanbenId: string; ref: string }; // 开局从 Catalog import 团本(过信任闸门)→运行库
}

// dice 跑团运行单元：db + in-process MCP(按实例注入 onCanonWrite/rollGate) + Agent + WsHub + turn-end hook。
export class DiceSession implements Session {
  readonly kind = "dice" as const;
  readonly db: DB;
  readonly hub = new WsHub();
  readonly gate: PlayerRollGate;
  readonly mcpServer: McpServer;
  constructor(public sessionId: string, private deps: DiceSessionDeps) {
    this.db = deps.db ?? (() => { const d = openDb(":memory:"); initSchema(d); return d; })();
    // 开局物化:从 Catalog import 选定团本版本(信任闸门重验)→ 本局运行库。仅空库时(避免重复 import)。
    if (deps.importFrom) {
      const empty = (this.db.prepare("SELECT COUNT(*) n FROM log").get() as { n: number }).n === 0;
      if (empty) importPack(deps.importFrom.catalog, this.db, deps.importFrom.tuanbenId, deps.importFrom.ref);
    }
    this.gate = new PlayerRollGate(this.db, this.hub, sessionId);
    this.mcpServer = createMcpServer(this.db, {
      onCanonWrite: (e) => this.onCanonWrite(e),
      rollGate: this.gate.gate,
    });
  }

  onCanonWrite(evt: CanonWriteEvent): void {
    const msg = mapCanonWrite(evt);
    if (msg) this.hub.broadcast(this.sessionId, msg);
  }

  attachWs(ws: WsLike): void { this.hub.add(this.sessionId, ws); }
  detachWs(ws: WsLike): void { this.hub.remove(this.sessionId, ws); }

  async handleMessage(text: string): Promise<{ turnId: string }> {
    const turnId = nextTurnId(this.sessionId);
    const driver = this.deps.driverFactory(this);
    await runTurn(
      { db: this.db, driver, hub: this.hub, sessionId: this.sessionId, turnId, runTurnEnd: (db) => this.turnEnd(db) },
      { text },
    );
    return { turnId };
  }

  handleRoll(eventId: number): boolean { return this.gate.resolveRoll(eventId); }

  private turnEnd(db: DB): TurnEndResult {
    runTurnEnd(db, { transcriptHasText: true, stopHookActive: false }); // 物化 choice + L3 审计
    const pc = buildPresentationModel(db, { turnStartSeq: 0 }).pendingChoice;
    if (!pc) return {};
    return {
      choices: { eventId: pc.seq, options: pc.options.map((o, index) => ({ index, label: o.label, consequence: o.consequence })) },
    };
  }
}
