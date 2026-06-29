// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import { initRetrieval } from "./db.js";
import { ingest } from "./ingest.js";
import { searchMaterial } from "./search.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initRetrieval(db);
});

afterEach(() => {
  db.close();
});

describe("initRetrieval", () => {
  test("build_material 表建成(幂等)", () => {
    // 二次调用不应抛出
    initRetrieval(db);
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='build_material'")
      .get();
    expect(row).toBeTruthy();
  });

  test("build_material_fts 虚表建成", () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE name='build_material_fts'")
      .get();
    expect(row).toBeTruthy();
  });
});

describe("ingest", () => {
  test("返回切块数量(单段短文 → 1)", () => {
    const n = ingest(db, "墨大夫悬壶济世，医术精湛。");
    expect(n).toBe(1);
  });

  test("多段文本返回正确块数", () => {
    const text = "第一段。\n\n第二段。\n\n第三段。";
    const n = ingest(db, text);
    expect(n).toBe(3);
  });

  test("ingest 后 build_material 行数与返回值一致", () => {
    const text = "段一内容。\n\n段二内容。";
    const n = ingest(db, text);
    const count = (db.prepare("SELECT COUNT(*) AS c FROM build_material").get() as { c: number }).c;
    expect(count).toBe(n);
  });

  test("ingest 两次 — 追加而非覆盖", () => {
    ingest(db, "甲段。");
    ingest(db, "乙段。");
    const count = (db.prepare("SELECT COUNT(*) AS c FROM build_material").get() as { c: number }).c;
    expect(count).toBe(2);
  });
});

describe("searchMaterial — jieba 中文召回", () => {
  const CORPUS = [
    "黄枫谷是一处幽静的山谷，谷中枫叶如火，四季皆宜。",
    "墨大夫行医数十年，以仁心仁术著称于世。",
    "铁剑门弟子每日晨起习剑，雷打不动。",
    "蜜糖山的熊族每到秋天便下山采蜜，喜笑颜开。",
    "黄枫谷的古井据传有千年历史，井水甘甜。",
  ];

  beforeEach(() => {
    for (const para of CORPUS) ingest(db, para);
  });

  test("按「黄枫谷」召回相关块", () => {
    const hits = searchMaterial(db, "黄枫谷");
    const texts = hits.map((h) => h.text);
    // 应命中含「黄枫谷」的两段
    expect(texts.some((t) => t.includes("黄枫谷"))).toBe(true);
  });

  test("按「墨大夫」召回正确块且不含无关块", () => {
    const hits = searchMaterial(db, "墨大夫", 1);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain("墨大夫");
  });

  test("「铁剑」与「蜜糖」互不串味", () => {
    const hitsJian = searchMaterial(db, "铁剑", 3);
    const textJian = hitsJian.map((h) => h.text);
    expect(textJian.some((t) => t.includes("铁剑"))).toBe(true);
    // 不应包含「蜜糖」段落
    expect(textJian.every((t) => !t.includes("蜜糖"))).toBe(true);

    const hitsMi = searchMaterial(db, "蜜糖", 3);
    const textMi = hitsMi.map((h) => h.text);
    expect(textMi.some((t) => t.includes("蜜糖"))).toBe(true);
    expect(textMi.every((t) => !t.includes("铁剑"))).toBe(true);
  });

  test("返回对象含 idx 和 text 字段", () => {
    const hits = searchMaterial(db, "黄枫谷");
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(typeof h.idx).toBe("number");
      expect(typeof h.text).toBe("string");
    }
  });

  test("k 参数限制返回数量", () => {
    // corpus 有 5 段; 搜一个宽泛词最多返回 2
    const hits = searchMaterial(db, "弟子", 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  test("空查询返回空数组", () => {
    const hits = searchMaterial(db, "");
    expect(hits).toEqual([]);
  });

  test("无命中返回空数组", () => {
    // 使用语料库中完全不存在的专有名词，jieba 无法切出命中词元
    const hits = searchMaterial(db, "紫霄仙府凌云阁");
    expect(hits).toEqual([]);
  });
});
