// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, expect, test } from "vitest";
import { chunkText } from "./chunk.js";

describe("chunkText", () => {
  test("空字符串返回空数组", () => {
    expect(chunkText("")).toEqual([]);
  });

  test("单段落短文返回单块", () => {
    const text = "黄枫谷是一处幽静的山谷。";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].idx).toBe(0);
    expect(chunks[0].text).toBe("黄枫谷是一处幽静的山谷。");
  });

  test("空行分隔的两段返回两块", () => {
    const text = "第一段文字。\n\n第二段文字。";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].idx).toBe(0);
    expect(chunks[1].idx).toBe(1);
    expect(chunks[0].text).toBe("第一段文字。");
    expect(chunks[1].text).toBe("第二段文字。");
  });

  test("Markdown 标题边界分块(# / ## / ###)", () => {
    const text = "# 第一章\n正文一。\n\n## 第一节\n正文二。";
    const chunks = chunkText(text);
    // 标题行应作为分块边界
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // 所有块的 idx 严格递增
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].idx).toBe(chunks[i - 1].idx + 1);
    }
  });

  test("过长段落在 maxChars 处切块", () => {
    // 生成一个 1600 字的段落(无空行)
    const longPara = "甲".repeat(1600);
    const chunks = chunkText(longPara, { maxChars: 800 });
    // 应切成至少 2 块
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // 每块不超过 maxChars
    for (const c of chunks) {
      expect([...c.text].length).toBeLessThanOrEqual(800);
    }
  });

  test("idx 从 0 开始严格递增", () => {
    const text = "段一。\n\n段二。\n\n段三。";
    const chunks = chunkText(text);
    expect(chunks.map((c) => c.idx)).toEqual([0, 1, 2]);
  });

  test("多余空白行不产生空块", () => {
    const text = "第一段。\n\n\n\n第二段。";
    const chunks = chunkText(text);
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
  });

  test("默认 maxChars 约 800", () => {
    // 恰好 800 字不应被切
    const text = "乙".repeat(800);
    expect(chunkText(text)).toHaveLength(1);
    // 801 字应被切成 2 块
    const text2 = "丙".repeat(801);
    const chunks = chunkText(text2);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});
