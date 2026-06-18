import { describe, expect, test } from "vitest";
import { initSchema, openDb } from "./db.js";

describe("schema", () => {
  test("初始化建出四域表", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["sheet", "event", "watcher", "world_doc", "world_pool", "rule_doc", "session_meta", "pending_choice"]) {
      expect(names).toContain(t);
    }
  });
  test("幂等:重复 initSchema 不报错", () => {
    const db = openDb(":memory:");
    initSchema(db);
    expect(() => initSchema(db)).not.toThrow();
  });

  test("初始化建出 FTS 虚表", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    for (const t of ["event_fts", "world_doc_fts", "rule_doc_fts"]) {
      expect(names).toContain(t);
    }
  });
});
