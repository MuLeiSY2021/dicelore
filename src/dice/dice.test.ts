import { describe, expect, test } from "vitest";
import { rangeMap, rollDice, type Band } from "./index.js";

describe("rollDice", () => {
  test("注入定种子 rng → 确定性", () => {
    const rng = () => 0.5; // floor(0.5*6)+1 = 4
    expect(rollDice(3, 6, rng)).toEqual([4, 4, 4]);
  });
  test("count 与范围", () => {
    const seq = [0, 0.999999, 0.5];
    let i = 0;
    const rng = () => seq[i++];
    expect(rollDice(3, 20, rng)).toEqual([1, 20, 11]);
  });
  test("校验 count≥1", () => {
    expect(() => rollDice(0, 6)).toThrow();
  });
  test("校验 sides≥2", () => {
    expect(() => rollDice(1, 1)).toThrow();
  });
});

describe("rangeMap", () => {
  const bands: Band[] = [
    { label: "fail", min: 1, max: 10 },
    { label: "ok", min: 11, max: 20 },
  ];
  test("命中档", () => {
    expect(rangeMap(5, bands).label).toBe("fail");
    expect(rangeMap(11, bands).label).toBe("ok");
  });
  test("落空报错", () => {
    expect(() => rangeMap(21, bands)).toThrow();
  });
  test("区间重叠报错", () => {
    expect(() => rangeMap(5, [
      { label: "a", min: 1, max: 10 },
      { label: "b", min: 10, max: 20 },
    ])).toThrow();
  });
});
