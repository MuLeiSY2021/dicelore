// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

export interface Chunk {
  idx: number;
  text: string;
}

/**
 * 把长文按段落/标题边界切块。
 * 规则：
 *   1. 空行（连续 \n\n）或 Markdown 标题行（/^#{1,6}\s/）作为分块边界。
 *   2. 标题行本身保留在它"引领"的那块开头。
 *   3. 超过 maxChars（默认 800 个 Unicode 字符）的段落再按字符数截断。
 *   4. 空/纯空白块丢弃。
 *   5. 返回结果的 idx 从 0 起严格递增。
 */
export function chunkText(
  text: string,
  opts?: { maxChars?: number },
): Chunk[] {
  const maxChars = opts?.maxChars ?? 800;

  if (!text || !text.trim()) return [];

  // Step 1: 按「空行」或「标题行开头」拆分为原始段落。
  // 我们先按行分割，然后在遇到空行或标题行时切边界。
  const lines = text.split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isBlankLine = line.trim() === "";
    const isHeading = /^#{1,6}\s/.test(line);

    if (isBlankLine) {
      // 空行 → 结束当前段落
      if (current.length > 0) {
        paragraphs.push(current.join("\n").trim());
        current = [];
      }
    } else if (isHeading) {
      // 标题行 → 先结束当前段落，再开新段落
      if (current.length > 0) {
        paragraphs.push(current.join("\n").trim());
        current = [];
      }
      current.push(line);
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join("\n").trim());
  }

  // Step 2: 过滤空段落，然后把过长段落按 maxChars 截断。
  const rawChunks: string[] = [];
  for (const para of paragraphs) {
    if (!para) continue;
    const chars = [...para]; // unicode-safe
    if (chars.length <= maxChars) {
      rawChunks.push(para);
    } else {
      // 截断：每 maxChars 个字符切一块
      for (let i = 0; i < chars.length; i += maxChars) {
        rawChunks.push(chars.slice(i, i + maxChars).join(""));
      }
    }
  }

  // Step 3: 分配 idx
  return rawChunks.map((text, idx) => ({ idx, text }));
}
