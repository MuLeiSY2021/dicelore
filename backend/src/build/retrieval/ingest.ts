// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { ftsIndex } from "../../store/fts.js";
import { chunkText } from "./chunk.js";
import type { RetrievalDB } from "./db.js";
import { MATERIAL_FTS_TABLE, MATERIAL_TABLE } from "./db.js";

/**
 * 将原著文本 text 切块后写入 build_material + build_material_fts。
 * 每次调用是追加语义，rowid 使用自增策略（idx 基于当前表最大 idx + 1）。
 * 返回本次写入的块数。
 */
export function ingest(db: RetrievalDB, text: string): number {
  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  // 计算起始 idx：取当前最大 idx + 1，以支持多次 ingest 追加
  const maxRow = db
    .prepare(`SELECT COALESCE(MAX(idx), -1) AS m FROM ${MATERIAL_TABLE}`)
    .get() as { m: number };
  const offset = maxRow.m + 1;

  const insertMaterial = db.prepare(
    `INSERT INTO ${MATERIAL_TABLE} (idx, text) VALUES (?, ?)`,
  );

  for (const chunk of chunks) {
    const globalIdx = offset + chunk.idx;
    insertMaterial.run(globalIdx, chunk.text);
    // rowid in FTS mirrors the idx in build_material
    ftsIndex(db, MATERIAL_FTS_TABLE, globalIdx, chunk.text);
  }

  return chunks.length;
}
