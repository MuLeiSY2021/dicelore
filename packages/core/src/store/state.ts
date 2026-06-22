// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";

export type StateKind = "player" | "npc" | "world";

export interface StateCell {
  entity: string;
  attr: string;
  value: string;
  visible: number;
  kind: StateKind;
  rel_object: string | null;
  rel_dim: string | null;
  clock_min: number | null;
  clock_max: number | null;
  clock_mode: string | null;
}

const SELECT_COLS =
  "entity, attr, value, visible, kind, rel_object, rel_dim, clock_min, clock_max, clock_mode";

export function stateGet(db: DB, entity: string, attr: string): StateCell | undefined {
  return db
    .prepare(`SELECT ${SELECT_COLS} FROM state WHERE entity=? AND attr=?`)
    .get(entity, attr) as StateCell | undefined;
}

// prefix 形如 "张三." 或 "张三.库存:"。约定:prefix 以 "." 分隔 entity 与 attr 前缀。
export function stateList(db: DB, prefix: string): StateCell[] {
  const dot = prefix.indexOf(".");
  if (dot === -1) throw new Error(`stateList: prefix 需含 '.'(如 "张三." )— 收到 "${prefix}"`);
  const entity = prefix.slice(0, dot);
  const attrPrefix = prefix.slice(dot + 1);
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLS} FROM state WHERE entity=? AND attr LIKE ? ESCAPE '\\' ORDER BY attr`,
    )
    .all(entity, likePrefix(attrPrefix));
  return rows as StateCell[];
}

function likePrefix(p: string): string {
  const escaped = p.replace(/[\\%_]/g, (m) => "\\" + m);
  return escaped + "%";
}

export function stateSet(db: DB, entity: string, attr: string, value: string, visible?: number): void {
  if (visible === undefined) {
    db.prepare(
      `INSERT INTO state (entity, attr, value, visible) VALUES (?, ?, ?, 0)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value`,
    ).run(entity, attr, value);
  } else {
    db.prepare(
      `INSERT INTO state (entity, attr, value, visible) VALUES (?, ?, ?, ?)
       ON CONFLICT(entity, attr) DO UPDATE SET value=excluded.value, visible=excluded.visible`,
    ).run(entity, attr, value, visible);
  }
}
