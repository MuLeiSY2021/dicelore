// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { ftsSearch } from "../../store/fts.js";
import type { RetrievalDB } from "./db.js";
import { MATERIAL_FTS_TABLE, MATERIAL_TABLE } from "./db.js";

export interface MaterialHit {
  idx: number;
  text: string;
}

/**
 * 用 ftsSearch（jieba BM25）召回 top-k 块，回查原文。
 * @param db   已经过 initRetrieval 建表的数据库
 * @param query  查询词（中文自动 jieba 分词）
 * @param k    最大返回数，默认 20
 */
export function searchMaterial(
  db: RetrievalDB,
  query: string,
  k = 20,
): MaterialHit[] {
  const hits = ftsSearch(db, MATERIAL_FTS_TABLE, query, k);
  const stmt = db.prepare(
    `SELECT idx, text FROM ${MATERIAL_TABLE} WHERE idx = ?`,
  );
  return hits
    .map((h) => stmt.get(h.rowid) as MaterialHit | undefined)
    .filter((r): r is MaterialHit => r !== undefined);
}
