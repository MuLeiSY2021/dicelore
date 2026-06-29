// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { DB } from "./db.js";
import { ftsIndex } from "./fts.js";

// ===== SNAP-1 快照 v1（ADR-0017 v1 降预期：只自动持久化，存档/读档）=====
//
// IoC 注册表：core 不编译期依赖任何具体域(sheet/world/watcher)。每个域以一个
// SnapshotParticipant 注册自己「怎么 capture（整表 dump）/ restore（整体覆写）」。
// checkpoint = 收集所有 participant 的 capture() → 全量 blob 落 snapshot 行；
// restore = 反序列化 blob → 逐 participant 调 restore()（整体覆写，不逆级联）。
// v1 默认注册 sheet / world.runtime / watcher；rule 不注册（带外热更不随回合回滚）。

export interface SnapshotParticipant {
  /** 域名（稳定键，写进 blob、按名定位 restore）。 */
  readonly name: string;
  /** 整表 dump → 可 JSON 序列化的不透明体（结构由 participant 自定）。 */
  capture(db: DB): unknown;
  /** 整体覆写：用 blob 覆盖当前态（实现自行清表 + 重灌；不逆级联）。 */
  restore(db: DB, blob: unknown): void;
}

// ---- 通用「整表 participant」----------------------------------------------
// 适用于「一张物理表 = 一个域」的常见情形：capture = 全行 dump（含 rowid，保 FTS 外键稳定），
// restore = 清表 + 按原 rowid 重灌。afterRestore 钩子给需要重建派生结构（如 FTS）的表用。
export function tableParticipant(
  name: string,
  table: string,
  opts: { afterRestore?: (db: DB, rows: Record<string, unknown>[]) => void } = {},
): SnapshotParticipant {
  return {
    name,
    capture(db: DB): unknown {
      // rowid 显式取出：lore 等无显式主键的表靠 rowid 与 FTS 行对齐，restore 必须保号。
      return db.prepare(`SELECT rowid AS __rowid, * FROM ${table}`).all() as Record<string, unknown>[];
    },
    restore(db: DB, blob: unknown): void {
      const rows = (blob ?? []) as Record<string, unknown>[];
      db.prepare(`DELETE FROM ${table}`).run();
      for (const r of rows) {
        const cols = Object.keys(r).filter((k) => k !== "__rowid");
        const rowidPart = r.__rowid != null ? ["rowid", ...cols] : cols;
        const vals = r.__rowid != null ? [r.__rowid, ...cols.map((c) => r[c])] : cols.map((c) => r[c]);
        const ph = rowidPart.map(() => "?").join(", ");
        db.prepare(`INSERT INTO ${table} (${rowidPart.join(", ")}) VALUES (${ph})`).run(...(vals as never[]));
      }
      opts.afterRestore?.(db, rows);
    },
  };
}

// ---- v1 默认三域 -----------------------------------------------------------
// sheet 域 = state 表；world.runtime = lore 表（+ pool AI 现编同表系，v1 先覆 lore 主体）；watcher = watcher 表。
// world restore 后重建 lore_fts：lore 整表覆写抹了旧 FTS 行（FTS 是独立虚表、不随 lore 行删），
// 必须据覆写后的 lore 行重灌索引，否则 restore 出的态搜不到（snapshot.test「restore 出的态可被检索」）。
function worldParticipant(): SnapshotParticipant {
  return tableParticipant("world", "lore", {
    afterRestore(db, rows) {
      // 清空 lore_fts 再据当前 lore 行重建（rowid 对齐 loreUpsert 的索引口径）。
      db.prepare("DELETE FROM lore_fts").run();
      for (const r of rows) {
        const rowid = Number(r.__rowid);
        const name = (r.name as string | null) ?? "";
        const content = (r.content as string | null) ?? "";
        const tags = r.tags as string | null;
        ftsIndex(db, "lore_fts", rowid, `${name}\n${content}${tags ? "\n" + tags : ""}`);
      }
    },
  });
}

export function defaultParticipants(): SnapshotParticipant[] {
  // sheet / world / watcher（rule 不在内——带外热更自动留存）。排序稳定，便于断言与 blob 可读。
  const base = [tableParticipant("sheet", "state"), worldParticipant(), tableParticipant("watcher", "watcher")];
  return [...base, ..._registered].sort((a, b) => a.name.localeCompare(b.name));
}

// ---- 全局 participant 注册（插件/客制域不改 core 即可入快照）----------------
const _registered: SnapshotParticipant[] = [];
export function registerSnapshotParticipant(p: SnapshotParticipant): () => void {
  _registered.push(p);
  return () => {
    const i = _registered.indexOf(p);
    if (i >= 0) _registered.splice(i, 1);
  };
}

// ---- snapshot 行查询 -------------------------------------------------------
export interface SnapshotRow {
  id: number;
  parentId: number | null;
  turnStartSeq: number | null;
  turnEndSeq: number | null;
  createdAt: string;
}

function rowToSnapshot(r: {
  id: number; parent_id: number | null; turn_start_seq: number | null; turn_end_seq: number | null; created_at: string;
}): SnapshotRow {
  return { id: r.id, parentId: r.parent_id, turnStartSeq: r.turn_start_seq, turnEndSeq: r.turn_end_seq, createdAt: r.created_at };
}

export function listSnapshots(db: DB): SnapshotRow[] {
  const rows = db.prepare("SELECT id, parent_id, turn_start_seq, turn_end_seq, created_at FROM snapshot ORDER BY id").all() as Parameters<typeof rowToSnapshot>[0][];
  return rows.map(rowToSnapshot);
}

export function latestSnapshot(db: DB): SnapshotRow | undefined {
  const r = db.prepare("SELECT id, parent_id, turn_start_seq, turn_end_seq, created_at FROM snapshot ORDER BY id DESC LIMIT 1").get() as Parameters<typeof rowToSnapshot>[0] | undefined;
  return r ? rowToSnapshot(r) : undefined;
}

// ---- checkpoint / restore 原语 --------------------------------------------
export interface CheckpointOpts {
  /** 本回合末 log seq（turn_end_seq）。turn_start_seq 暂记同值，v2 branch 锚点再细分。 */
  turnSeq: number;
  /** 自定义 participant 集；省略 = defaultParticipants()（含全局注册）。 */
  participants?: SnapshotParticipant[];
}

export function checkpoint(db: DB, opts: CheckpointOpts): number {
  const parts = opts.participants ?? defaultParticipants();
  const blob: Record<string, unknown> = {};
  for (const p of parts) blob[p.name] = p.capture(db);
  const parent = latestSnapshot(db); // 线性链：parent = 上一份快照（v1 不分叉）。
  const info = db
    .prepare("INSERT INTO snapshot (parent_id, turn_start_seq, turn_end_seq, blob_json) VALUES (?, ?, ?, ?)")
    .run(parent?.id ?? null, opts.turnSeq, opts.turnSeq, JSON.stringify(blob));
  return Number(info.lastInsertRowid);
}

export function restore(db: DB, snapshotId: number, participants?: SnapshotParticipant[]): void {
  const row = db.prepare("SELECT blob_json FROM snapshot WHERE id=?").get(snapshotId) as { blob_json: string } | undefined;
  if (!row) throw new Error(`restore: 无此 snapshotId=${snapshotId}`);
  const blob = JSON.parse(row.blob_json) as Record<string, unknown>;
  const parts = participants ?? defaultParticipants();
  // 整事务覆写：任一 participant 失败则整体回滚，不留半态。
  const tx = db.transaction(() => {
    for (const p of parts) {
      if (p.name in blob) p.restore(db, blob[p.name]);
    }
  });
  tx();
}
