// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type Database from "better-sqlite3";
import { ftsTableDDL } from "../../store/fts.js";

export type RetrievalDB = Database.Database;

const MATERIAL_TABLE = "build_material";
const MATERIAL_FTS_TABLE = "build_material_fts";

/**
 * 幂等建表：
 *   - build_material(idx INTEGER PRIMARY KEY, text TEXT)
 *   - build_material_fts  FTS5 虚表，复用 ftsTableDDL
 */
export function initRetrieval(db: RetrievalDB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MATERIAL_TABLE} (
      idx INTEGER PRIMARY KEY,
      text TEXT NOT NULL
    );
  `);
  db.exec(ftsTableDDL(MATERIAL_FTS_TABLE));
}

export { MATERIAL_TABLE, MATERIAL_FTS_TABLE };
