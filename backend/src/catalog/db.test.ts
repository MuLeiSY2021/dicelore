// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { openCatalog } from "./db.js";

describe("openCatalog", () => {
  it("建 tuanben/commits/file/tag 表", () => {
    const db = openCatalog(":memory:");
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
    for (const t of ["tuanben", "commits", "file", "tag"]) expect(names).toContain(t);
    db.close();
  });
});
