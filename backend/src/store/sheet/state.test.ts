// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { beforeEach, describe, expect, test } from "vitest";
import { initSchema, openDb, type DB } from "../db.js";
import { stateGet, stateList, stateSet } from "./state.js";

let db: DB;
beforeEach(() => { db = openDb(":memory:"); initSchema(db); });

describe("state store", () => {
  test("set 后 get", () => {
    stateSet(db, "张三", "力量", "7", 1);
    expect(stateGet(db, "张三", "力量")).toMatchObject({
      entity: "张三", attr: "力量", value: "7", visible: 1,
    });
  });

  test("新行 kind 默认 world、rel/clock 为 null", () => {
    stateSet(db, "世界", "年", "0");
    expect(stateGet(db, "世界", "年")).toMatchObject({
      kind: "world", rel_object: null, rel_dim: null,
      clock_min: null, clock_max: null, clock_mode: null,
    });
  });

  test("UPSERT 覆盖值、缺省 visible 保留旧值", () => {
    stateSet(db, "张三", "HP", "30", 1);
    stateSet(db, "张三", "HP", "20");
    expect(stateGet(db, "张三", "HP")).toMatchObject({ value: "20", visible: 1 });
  });

  test("list 按前缀（整卡 / 库存子集）", () => {
    stateSet(db, "张三", "力量", "7");
    stateSet(db, "张三", "库存:药水", "3");
    stateSet(db, "李四", "力量", "5");
    expect(stateList(db, "张三.").map((c) => c.attr).sort()).toEqual(["力量", "库存:药水"]);
  });

  test("get 缺失返回 undefined", () => {
    expect(stateGet(db, "无", "无")).toBeUndefined();
  });

  test("kind 参数：新建行携带 kind=npc（A1 npc 升一等地基）", () => {
    stateSet(db, "村长", "好感", "5", undefined, "npc");
    expect(stateGet(db, "村长", "好感")).toMatchObject({ kind: "npc", visible: 0 });
  });

  test("kind 参数：带 visible 与 kind 同时携带", () => {
    stateSet(db, "村长", "身份", "线人", 1, "npc");
    expect(stateGet(db, "村长", "身份")).toMatchObject({ kind: "npc", visible: 1, value: "线人" });
  });

  test("kind 省略：仍默认 world（回归）", () => {
    stateSet(db, "世界", "天气", "雨");
    expect(stateGet(db, "世界", "天气")).toMatchObject({ kind: "world" });
  });

  test("kind 在 UPSERT 时不覆盖旧 kind", () => {
    stateSet(db, "村长", "好感", "5", undefined, "npc");
    stateSet(db, "村长", "好感", "8"); // 不带 kind，改值
    expect(stateGet(db, "村长", "好感")).toMatchObject({ kind: "npc", value: "8" });
  });
});
