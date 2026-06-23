// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Draft, commitDraft } from "./draft.js";
import { tag, resolveId } from "../catalog/catalog.js";
import type { CatalogDB } from "../catalog/db.js";

// 构建会话上下文:一个 Draft(跨工具调用累积) + Catalog + 团本名。lore_agent 在此造包。
export interface BuildCtx {
  catalog: CatalogDB;
  draft: Draft;
  name: string;
}

export interface BuildEnvelope {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

function ok(out: unknown): BuildEnvelope {
  return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
}
function err(code: string, message: string): BuildEnvelope {
  return { content: [{ type: "text", text: JSON.stringify({ error: { code, message } }) }], isError: true };
}

const rowsSchema = z.array(z.record(z.union([z.string(), z.number()]))).min(1);
export const BUILD_SCHEMAS = {
  set_manifest: z.object({ name: z.string().optional(), id: z.string().optional() }).strict(),
  write_lore: z.object({ name: z.string(), content: z.string() }).strict(),
  write_rule: z.object({ name: z.string(), content: z.string() }).strict(),
  add_pool: z.object({ pool: z.string(), rows: rowsSchema }).strict(),
  set_state: z.object({
    cells: z.array(z.object({
      entity: z.string(),
      kind: z.enum(["player", "npc", "world"]).optional(),
      attr: z.string(), value: z.string(),
      visible: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    })).min(1),
  }).strict(),
  commit: z.object({ message: z.string() }).strict(),
  tag: z.object({ commitId: z.string(), label: z.string() }).strict(),
} as const;

// 调一个构建工具(无 dicelore_build_ 前缀):校验入参 → 改 draft / commit。可测核心。
export function invokeBuildTool(ctx: BuildCtx, name: string, args: unknown): BuildEnvelope {
  const schema = (BUILD_SCHEMAS as Record<string, z.ZodTypeAny>)[name];
  if (!schema) return err("UNKNOWN_TOOL", `未知构建工具: ${name}`);
  const parsed = schema.safeParse(args);
  if (!parsed.success) return err("VALIDATION", parsed.error.message);
  const a = parsed.data as Record<string, unknown>;
  switch (name) {
    case "set_manifest": ctx.draft.setManifest(a); return ok({ ok: true });
    case "write_lore": ctx.draft.writeLore(a.name as string, a.content as string); return ok({ ok: true });
    case "write_rule": ctx.draft.writeRule(a.name as string, a.content as string); return ok({ ok: true });
    case "add_pool": ctx.draft.addPool(a.pool as string, a.rows as Record<string, string | number>[]); return ok({ ok: true });
    case "set_state": ctx.draft.setState(a.cells as Parameters<Draft["setState"]>[0]); return ok({ ok: true });
    case "commit": {
      const r = commitDraft(ctx.catalog, { name: ctx.name, message: a.message as string, draft: ctx.draft });
      return ok(r);
    }
    case "tag": tag(ctx.catalog, { tuanbenId: resolveId(ctx.name), commitId: a.commitId as string, label: a.label as string }); return ok({ ok: true });
    default: return err("UNKNOWN_TOOL", name);
  }
}

// 构建版 MCP server:注册 dicelore_build_* 工具,挂在 LoreSession 的 in-process MCP。
// 与运行时 TOOLS 编译期不交叉(物理隔离不变量:lore 会话只见构建工具)。
export function createBuildMcpServer(ctx: BuildCtx): McpServer {
  const server = new McpServer({ name: "dicelore-build", version: "0.0.0" });
  for (const [name, schema] of Object.entries(BUILD_SCHEMAS)) {
    server.registerTool(
      `dicelore_build_${name}`,
      { description: `团本构建:${name}`, inputSchema: (schema as z.ZodObject<z.ZodRawShape>).shape },
      (args: unknown) => invokeBuildTool(ctx, name, args) as never,
    );
  }
  return server;
}
