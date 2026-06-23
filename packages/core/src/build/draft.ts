// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { commit, type PackFile } from "../catalog/catalog.js";
import type { CatalogDB } from "../catalog/db.js";

// 团本构建草稿:lore_agent 按域累积内容,toPackFiles 序列化成 P3 import 认的包格式,commit 到 Catalog。
// (harvest 旧 2026-06-21 build 读写层:文件式 packDir → 内存 draft → Catalog DB。)

function toCsv(rows: Record<string, string | number>[], cols?: string[]): string {
  const keys = cols ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = rows.map((r) => keys.map((k) => esc(r[k] ?? "")).join(",")).join("\n");
  return rows.length ? `${keys.join(",")}\n${body}\n` : `${keys.join(",")}\n`;
}

export interface StateCell { entity: string; kind?: "player" | "npc" | "world"; attr: string; value: string; visible?: number }

export class Draft {
  private loreDocs = new Map<string, string>();
  private ruleDocs = new Map<string, string>();
  private pools = new Map<string, Record<string, string | number>[]>();
  private stateRows: StateCell[] = [];
  private fronts: Record<string, string | number>[] = [];
  private plotlines: Record<string, string | number>[] = [];
  private foreshadows: Record<string, string | number>[] = [];
  private anchors: Record<string, string | number>[] = [];
  private manifestName?: string;
  private manifestId?: string;

  setManifest(a: { name?: string; id?: string }): void {
    if (a.name) this.manifestName = a.name;
    if (a.id) this.manifestId = a.id;
  }
  writeLore(name: string, content: string): void { this.loreDocs.set(name, content); }
  writeRule(name: string, content: string): void { this.ruleDocs.set(name, content); }
  addPool(pool: string, rows: Record<string, string | number>[]): void {
    const e = this.pools.get(pool) ?? [];
    e.push(...rows);
    this.pools.set(pool, e);
  }
  setState(cells: StateCell[]): void { this.stateRows.push(...cells); }
  // 叙事域(团本作者声明的一等对象):front 威胁层 / plotline 故事线 / foreshadow 伏笔 / anchor 关系。
  addFront(rows: { id: string; name: string; stakes?: string; clock_ref?: string; status?: string }[]): void { this.fronts.push(...rows); }
  addPlotline(rows: { id: string; title: string; summary?: string; status?: string }[]): void { this.plotlines.push(...rows); }
  addForeshadow(rows: { id: string; content: string; status?: string }[]): void { this.foreshadows.push(...rows); }
  addAnchor(rows: { owner_table: string; owner_id: string; target_table: string; target_id: string; role?: string }[]): void { this.anchors.push(...rows); }

  toPackFiles(): PackFile[] {
    const files: PackFile[] = [];
    if (this.manifestName || this.manifestId) {
      files.push({ path: "manifest.md", content: `# ${this.manifestName ?? "(未命名)"}\n\n- id: ${this.manifestId ?? ""}` });
    }
    for (const [n, c] of this.loreDocs) files.push({ path: `lore/${n}.md`, content: c });
    for (const [n, c] of this.ruleDocs) files.push({ path: `rules/${n}.md`, content: c });
    for (const [p, rows] of this.pools) files.push({ path: `pools/${p}.csv`, content: toCsv(rows) });
    if (this.stateRows.length) {
      files.push({
        path: "state/开局.csv",
        content: toCsv(
          this.stateRows.map((c) => ({ entity: c.entity, kind: c.kind ?? "world", attr: c.attr, value: c.value, visible: c.visible ?? 0 })),
          ["entity", "kind", "attr", "value", "visible"],
        ),
      });
    }
    if (this.fronts.length) files.push({ path: "fronts/main.csv", content: toCsv(this.fronts, ["id", "name", "stakes", "clock_ref", "status"]) });
    if (this.plotlines.length) files.push({ path: "plotlines/main.csv", content: toCsv(this.plotlines, ["id", "title", "summary", "status"]) });
    if (this.foreshadows.length) files.push({ path: "foreshadows/main.csv", content: toCsv(this.foreshadows, ["id", "content", "status"]) });
    if (this.anchors.length) files.push({ path: "anchors/main.csv", content: toCsv(this.anchors, ["owner_table", "owner_id", "target_table", "target_id", "role"]) });
    return files;
  }
}

// 把草稿提交为团本一个版本(linear commit)。name 决定 UUIDv5 身份。
export function commitDraft(
  catalogDB: CatalogDB,
  a: { name: string; message: string; draft: Draft; createdAt?: string },
): { tuanbenId: string; commitId: string } {
  return commit(catalogDB, { name: a.name, files: a.draft.toPackFiles(), message: a.message, createdAt: a.createdAt });
}
