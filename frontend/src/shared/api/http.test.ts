// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi, afterEach } from "vitest";
import { testModel, testMcp } from "./http.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("testModel / testMcp", () => {
  it("testModel 2xx 返回解析后的 TestResult", async () => {
    const result = { ok: true, status: 200, latencyMs: 12, message: "ok" };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", f);
    const got = await testModel({ baseUrl: "http://x", key: "k", gm: "g" });
    expect(f).toHaveBeenCalledWith("/diagnostics/model-test", expect.objectContaining({ method: "POST" }));
    expect(got).toEqual(result);
  });

  it("testModel 非 2xx 抛带状态码错误,不把错误体当成功解析", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json }));
    await expect(testModel({ baseUrl: "http://x", key: "k", gm: "g" })).rejects.toThrow("502");
    expect(json).not.toHaveBeenCalled();
  });

  it("testMcp 2xx 返回解析后的 TestResult", async () => {
    const result = { ok: true, status: 200, message: "ok" };
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", f);
    const got = await testMcp({ transport: "stdio", endpoint: "x" });
    expect(f).toHaveBeenCalledWith("/diagnostics/mcp-test", expect.objectContaining({ method: "POST" }));
    expect(got).toEqual(result);
  });

  it("testMcp 非 2xx 抛带状态码错误", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json }));
    await expect(testMcp({ transport: "stdio", endpoint: "x" })).rejects.toThrow("500");
    expect(json).not.toHaveBeenCalled();
  });
});
