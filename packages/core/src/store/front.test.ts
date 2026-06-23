// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "./db.js";
import { frontUpsert, frontGet, frontList, frontSetStatus } from "./front.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("front store", () => {
  test("upsert 后 get（默认 status=active）", () => {
    frontUpsert(db, { id: "魔道入侵", name: "魔道入侵", stakes: "护山大阵能否建成", clock_ref: "世界.入侵进度" });
    expect(frontGet(db, "魔道入侵")).toMatchObject({
      id: "魔道入侵", name: "魔道入侵", stakes: "护山大阵能否建成", clock_ref: "世界.入侵进度", status: "active",
    });
  });
  test("setStatus 改 spent；list 返回全部", () => {
    frontUpsert(db, { id: "f1", name: "线1" });
    frontSetStatus(db, "f1", "spent");
    expect(frontGet(db, "f1")!.status).toBe("spent");
    expect(frontList(db).map((f) => f.id)).toEqual(["f1"]);
  });
});
