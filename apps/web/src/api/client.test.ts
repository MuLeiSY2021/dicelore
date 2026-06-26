// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, vi, afterEach } from "vitest";
import { getPresentation, listSessions, postMessage, postRoll, testModel, testMcp } from "./client.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("getPresentation", () => {
  it("命中 /sessions/:id/presentation 并返回解析后的快照", async () => {
    const snap = {
      protocol: "dicelore.client/1", sessionId: "demo", seq: 0,
      sheets: [], mechanics: [], choices: null, narrativeCursor: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => snap });
    vi.stubGlobal("fetch", fetchMock);

    const got = await getPresentation("demo");
    expect(fetchMock).toHaveBeenCalledWith("/sessions/demo/presentation");
    expect(got).toEqual(snap);
  });

  it("非 2xx 抛错", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(getPresentation("demo")).rejects.toThrow("500");
  });
});

describe("listSessions", () => {
  it("命中 /sessions 并返回 sessions 数组", async () => {
    const sessions = [{ sessionId: "demo", title: "demo", status: "active" }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessions }) });
    vi.stubGlobal("fetch", fetchMock);

    const got = await listSessions();
    expect(fetchMock).toHaveBeenCalledWith("/sessions");
    expect(got).toEqual(sessions);
  });

  it("非 2xx 抛错", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(listSessions()).rejects.toThrow("503");
  });
});

describe("postMessage / postRoll", () => {
  it("postMessage 命中 /sessions/:id/messages(POST)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t" }) });
    vi.stubGlobal("fetch", f);
    await postMessage("s1", "我推门");
    expect(f).toHaveBeenCalledWith("/sessions/s1/messages", expect.objectContaining({ method: "POST" }));
  });

  it("postRoll 命中 /sessions/:id/roll(POST)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ turnId: "t" }) });
    vi.stubGlobal("fetch", f);
    await postRoll("s1", 12);
    expect(f).toHaveBeenCalledWith("/sessions/s1/roll", expect.objectContaining({ method: "POST" }));
  });
});

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
    // 关键回归:4xx/5xx 时 json() 不应被调用,必须抛错。
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
