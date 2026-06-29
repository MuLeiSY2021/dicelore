// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test } from "vitest";
import { openDb, initSchema } from "../store/db.js";
import { stateSet, stateGet } from "../store/state.js";
import { plotlineUpsert } from "../store/plotline.js";
import { foreshadowUpsert } from "../store/foreshadow.js";
import { compileWriteTool } from "./writeTool.js";

describe("compileWriteTool", () => {
  test("写工具:扣钱经 applyMutations(落 event/触发 watcher)", () => {
    const db = openDb(":memory:");
    initSchema(db);
    stateSet(db, "张三", "金币", "100");
    const t = compileWriteTool({
      name: "spend",
      params: { buyer: "string", price: "int" },
      sql: "UPDATE player SET 金币 = 金币 - :price WHERE entity = :buyer",
    });
    t.handler(db, { buyer: "张三", price: 30 });
    expect(stateGet(db, "张三", "金币")!.value).toBe("70");
  });

  test("写工具:加血经 applyMutations", () => {
    const db = openDb(":memory:");
    initSchema(db);
    stateSet(db, "李四", "HP", "80");
    const t = compileWriteTool({
      name: "heal",
      params: { who: "string", amount: "int" },
      sql: "UPDATE player SET HP = HP + :amount WHERE entity = :who",
    });
    t.handler(db, { who: "李四", amount: 20 });
    expect(stateGet(db, "李四", "HP")!.value).toBe("100");
  });

  test("写工具:decl.kind=npc → mutate 落 kind=npc 行（A1 引擎表达力补齐）", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const t = compileWriteTool({
      name: "npc_update",
      params: { npc: "string", delta: "int" },
      sql: "UPDATE state SET 好感 = 好感 + :delta WHERE entity = :npc",
      kind: "npc",
    });
    t.handler(db, { npc: "村长", delta: 5 });
    expect(stateGet(db, "村长", "好感")).toMatchObject({ kind: "npc", value: "5" });
  });

  test("写工具:无 decl.kind → mutate 仍默认 world（回归）", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const t = compileWriteTool({
      name: "bump",
      params: { who: "string", n: "int" },
      sql: "UPDATE state SET 计数 = 计数 + :n WHERE entity = :who",
    });
    t.handler(db, { who: "张三", n: 1 });
    expect(stateGet(db, "张三", "计数")).toMatchObject({ kind: "world" });
  });

  test("写工具:setStatus via plotline", () => {
    const db = openDb(":memory:");
    initSchema(db);
    plotlineUpsert(db, { id: "p1", title: "第一条线", status: "open" });
    const t = compileWriteTool({
      name: "close_plotline",
      params: { pid: "string", s: "string" },
      sql: "UPDATE plotline SET status = :s WHERE id = :pid",
    });
    t.handler(db, { pid: "p1", s: "closed" });
    const row = db.prepare("SELECT status FROM plotline WHERE id='p1'").get() as { status: string };
    expect(row.status).toBe("closed");
  });

  test("写工具:INSERT foreshadow via foreshadowUpsert", () => {
    const db = openDb(":memory:");
    initSchema(db);
    const t = compileWriteTool({
      name: "plant_foreshadow",
      params: { id: "string", content: "string" },
      sql: "INSERT INTO foreshadow (id, content) VALUES (:id, :content)",
    });
    t.handler(db, { id: "fs1", content: "一个伏笔" });
    const row = db
      .prepare("SELECT content FROM foreshadow WHERE id='fs1'")
      .get() as { content: string };
    expect(row.content).toBe("一个伏笔");
  });

  test("写工具:不可映射形状抛 BAD_INPUT", () => {
    expect(() =>
      compileWriteTool({
        name: "bad",
        sql: "DELETE FROM state WHERE entity=:e",
      })
    ).toThrow();
  });
});
