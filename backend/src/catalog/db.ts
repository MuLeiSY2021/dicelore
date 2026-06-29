// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import Database from "better-sqlite3";

export type CatalogDB = Database.Database;

// 集中录团本包库(独立于 per-session 运行库)。线性版本:commits.parent 链 + file 全量快照。
export function openCatalog(path: string): CatalogDB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS adventure (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, head TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS commits (
      id TEXT PRIMARY KEY, adventure_id TEXT NOT NULL, parent TEXT, message TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS file (
      commit_id TEXT NOT NULL, path TEXT NOT NULL, content TEXT NOT NULL,
      PRIMARY KEY (commit_id, path)
    );
    CREATE TABLE IF NOT EXISTS tag (
      adventure_id TEXT NOT NULL, label TEXT NOT NULL, commit_id TEXT NOT NULL,
      PRIMARY KEY (adventure_id, label)
    );
  `);
  return db;
}
