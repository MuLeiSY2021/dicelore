// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// worktree+monorepo：node_modules/@dicelore/core 经符号链接指向主仓库 core，
// 运行时(vitest)会绕过本 worktree 的 core 源码。这里把 @dicelore/core 别名到本 worktree 的
// core src（与 tsconfig.json paths 同口径），使运行时解析与类型检查一致——纯测试解析配置、不改产物行为。
const coreSrc = fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@dicelore/core": coreSrc } },
  test: { include: ["src/**/*.test.ts", "eval/**/*.test.ts"], exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**"] },
});
