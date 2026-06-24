// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test } from "vitest";
import { matchWrite } from "./writeMatch.js";

describe("matchWrite", () => {
  test("UPDATE …±:p WHERE entity=:e → mutate", () => {
    expect(
      matchWrite("UPDATE player SET 金币 = 金币 - :price WHERE entity = :buyer")
    ).toEqual({
      kind: "mutate",
      entityParam: "buyer",
      muts: [{ attr: "金币", op: "-", expr: ":price" }],
    });
  });

  test("mutate 加法", () => {
    expect(
      matchWrite("UPDATE player SET HP = HP + :heal WHERE entity = :who")
    ).toEqual({
      kind: "mutate",
      entityParam: "who",
      muts: [{ attr: "HP", op: "+", expr: ":heal" }],
    });
  });

  test("mutate 赋值 = 字面量", () => {
    expect(
      matchWrite("UPDATE player SET HP = :newHp WHERE entity = :who")
    ).toEqual({
      kind: "mutate",
      entityParam: "who",
      muts: [{ attr: "HP", op: "=", expr: ":newHp" }],
    });
  });

  test("UPDATE 叙事 SET status=:s WHERE id=:i → setStatus", () => {
    expect(
      matchWrite("UPDATE plotline SET status = :s WHERE id = :pid")
    ).toEqual({
      kind: "setStatus",
      table: "plotline",
      idParam: "pid",
      statusParam: "s",
    });
  });

  test("setStatus front 表", () => {
    expect(
      matchWrite("UPDATE front SET status = :newStatus WHERE id = :fid")
    ).toEqual({
      kind: "setStatus",
      table: "front",
      idParam: "fid",
      statusParam: "newStatus",
    });
  });

  test("setStatus foreshadow 表", () => {
    expect(
      matchWrite("UPDATE foreshadow SET status = :st WHERE id = :fsId")
    ).toEqual({
      kind: "setStatus",
      table: "foreshadow",
      idParam: "fsId",
      statusParam: "st",
    });
  });

  test("INSERT INTO 叙事 → insert", () => {
    expect(
      matchWrite("INSERT INTO foreshadow (id, content) VALUES (:id, :content)")
    ).toEqual({
      kind: "insert",
      table: "foreshadow",
      cols: ["id", "content"],
      valParams: ["id", "content"],
    });
  });

  test("INSERT INTO plotline → insert", () => {
    expect(
      matchWrite("INSERT INTO plotline (id, title) VALUES (:id, :title)")
    ).toEqual({
      kind: "insert",
      table: "plotline",
      cols: ["id", "title"],
      valParams: ["id", "title"],
    });
  });

  test("不可映射形状 → 拒", () => {
    for (const s of [
      "UPDATE a JOIN b SET x=1 WHERE entity=:e",
      "DELETE FROM state",
      "UPDATE x SET y=1 WHERE z>5 OR w<3",
    ]) {
      expect(() => matchWrite(s), `should throw for: ${s}`).toThrow();
    }
  });

  test("非叙事表 setStatus 拒绝", () => {
    // setStatus 只允许 front|plotline|foreshadow
    expect(() =>
      matchWrite("UPDATE state SET status = :s WHERE id = :i")
    ).toThrow();
  });

  test("INSERT INTO 非叙事表 拒绝", () => {
    expect(() =>
      matchWrite("INSERT INTO state (entity, attr) VALUES (:entity, :attr)")
    ).toThrow();
  });
});
