// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDb, initSchema, metaSet } from "@dicelore/backend";
import { listSessionSummaries } from "./sessions.js";

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "sessions-test-"));
}

function makeSessionDb(dir: string, name: string, meta: Record<string, string>) {
  const sessionDir = join(dir, name);
  mkdirSync(sessionDir, { recursive: true });
  const path = join(sessionDir, "session.db");
  const db = openDb(path);
  initSchema(db);
  for (const [k, v] of Object.entries(meta)) metaSet(db, k, v);
  db.close();
  return path;
}

describe("listSessionSummaries", () => {
  let dir: string;

  beforeEach(() => { dir = makeTmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("目录不可读 → 返回空数组", () => {
    expect(listSessionSummaries("/nonexistent_path_xyz")).toEqual([]);
  });

  it("空目录 → 返回空数组", () => {
    expect(listSessionSummaries(dir)).toEqual([]);
  });

  it("无 adventure_name 时 title=sessionId, adventureName 为 undefined", () => {
    makeSessionDb(dir, "sess-abc", {});
    const result = listSessionSummaries(dir);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("sess-abc");
    expect(result[0].title).toBe("sess-abc");
    expect(result[0].adventureName).toBeUndefined();
  });

  it("有 adventure_name 时 adventureName 填入且 title 仍为 sessionId(非 adventureName)", () => {
    makeSessionDb(dir, "sess-001", { adventure_name: "魔道传说" });
    const result = listSessionSummaries(dir);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("sess-001");
    // adventureName 应为团本包名
    expect(result[0].adventureName).toBe("魔道传说");
    // title 应为 sessionId，而非 adventureName（前端格式: adventureName + " · " + title）
    expect(result[0].title).toBe("sess-001");
  });

  it("多会话：adventureName 各自正确填入", () => {
    makeSessionDb(dir, "sess-a", { adventure_name: "凡人修仙" });
    makeSessionDb(dir, "sess-b", { adventure_name: "凡人修仙" });
    makeSessionDb(dir, "sess-c", {});
    const result = listSessionSummaries(dir);
    expect(result).toHaveLength(3);
    const byId = Object.fromEntries(result.map((r) => [r.sessionId, r]));
    expect(byId["sess-a"].adventureName).toBe("凡人修仙");
    expect(byId["sess-b"].adventureName).toBe("凡人修仙");
    expect(byId["sess-c"].adventureName).toBeUndefined();
  });

  it("非目录条目(散落文件)被忽略——只枚举 session 子目录", () => {
    writeFileSync(join(dir, "stray.db"), ""); // 散落文件,非 session 子目录
    makeSessionDb(dir, "sess-real", {});
    const result = listSessionSummaries(dir);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("sess-real");
  });

  it("started=1 时 started 字段为 true", () => {
    makeSessionDb(dir, "sess-started", { started: "1" });
    const result = listSessionSummaries(dir);
    expect(result[0].started).toBe(true);
  });

  it("started=0 时 started 字段为 false", () => {
    makeSessionDb(dir, "sess-notstarted", { started: "0" });
    const result = listSessionSummaries(dir);
    expect(result[0].started).toBe(false);
  });
});
