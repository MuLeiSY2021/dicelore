// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Hono } from "hono";
import { list, commit, tag, type CatalogDB, type PackFile } from "@dicelore/core";
import { InMemorySessionRegistry } from "../pkg/registry.js";
import { LoreSession, type LoreSessionDeps } from "../lore/LoreSession.js";
import type { Agent } from "../pkg/agent.js";

export interface LoreDeps {
  catalog: CatalogDB;
  driverFactory: (host: LoreSession) => Agent; // LoreBuilder(SDK + 构建 MCP + 构建 skill)
}

const loreReg = new InMemorySessionRegistry<LoreSession>();

// lore 路径 server 面:Catalog 管理(列/建/发布) + 构建会话(agent 造包)。
// 与 dice /sessions 路由物理分离(/lore/*、/catalog)。
export function createLoreApp(deps: LoreDeps): Hono {
  const app = new Hono();

  // 团本目录录(主页选团本玩 / 构建台列表)
  app.get("/catalog", (c) => c.json({ tuanben: list(deps.catalog) }));

  // 直接提交一个团本版本(程序化建包:种子/前端表单;agent 路径见 /lore-sessions)
  app.post("/catalog/commit", async (c) => {
    const body = (await c.req.json()) as { name: string; message: string; files: PackFile[] };
    const r = commit(deps.catalog, { name: body.name, message: body.message, files: body.files });
    return c.json(r, 201);
  });

  // 打 tag(真发布)
  app.post("/catalog/:tuanbenId/tag", async (c) => {
    const body = (await c.req.json()) as { commitId: string; label: string };
    tag(deps.catalog, { tuanbenId: c.req.param("tuanbenId"), commitId: body.commitId, label: body.label });
    return c.json({ ok: true }, 201);
  });

  // 构建会话:agent 经构建 MCP 造包(需 LLM driver)
  app.post("/lore-sessions/:id/messages", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json()) as { text: string; name: string };
    const dep: LoreSessionDeps = { catalog: deps.catalog, name: body.name, driverFactory: deps.driverFactory };
    const host = loreReg.getOrCreate(id, () => new LoreSession(id, dep));
    const { turnId } = await host.handleMessage(body.text);
    return c.json({ turnId }, 202);
  });

  return app;
}

export function getLoreSession(id: string): LoreSession | undefined { return loreReg.get(id); }
