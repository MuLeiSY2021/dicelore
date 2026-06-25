// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { renderHook, act } from "@testing-library/react";
import { vi, afterEach, expect, it } from "vitest";
import { useSession } from "./useSession.js";
import { CLIENT_PROTOCOL } from "@dicelore/shared";

class FakeWS {
  onmessage: ((e: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = 1;
  sent: string[] = [];
  constructor(public url: string) { setTimeout(() => this.onopen?.(), 0); }
  send(d: string) { this.sent.push(d); }
  close() {}
  emit(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}

afterEach(() => { vi.restoreAllMocks(); });

it("收到 narration_commit 累积叙事；roll_staged 置 pendingRoll；roll_committed 清空", async () => {
  const instances: FakeWS[] = [];
  vi.stubGlobal("WebSocket", class extends FakeWS { constructor(u: string) { super(u); instances.push(this); } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) }));

  const { result } = renderHook(() => useSession("s1"));
  await act(async () => { await Promise.resolve(); });

  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 1, text: "门开了。" }); });
  expect(result.current.narration.join("")).toContain("门开了。");

  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_staged",
    pendingRoll: { eventId: 5, shape: "outcome", label: "撬锁", yourSide: { name: "你", exprDisplay: "1d100" }, bands: [] } }); });
  expect(result.current.pendingRoll?.eventId).toBe(5);

  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_committed", eventId: 5, rolls: [55], total: 55, outcome: "成功" }); });
  expect(result.current.pendingRoll).toBeNull();
});

it("postMessage 失败 → error 进 error 通道(不再静默吞)、generating 复位", async () => {
  vi.stubGlobal("WebSocket", class extends FakeWS {});
  // 首个 fetch(refetch presentation) ok，第二个(postMessage)失败
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) })
    .mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "turn_in_progress" }) });
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useSession("s1"));
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    await expect(result.current.postMessage("我推门")).rejects.toBeTruthy();
  });
  expect(result.current.error).toBeTruthy();
  expect(result.current.generating).toBe(false);
});

it("roll 失败 → error 进 error 通道(roll 之前无 catch、静默吞)", async () => {
  vi.stubGlobal("WebSocket", class extends FakeWS {});
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) })
    .mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "no_pending_roll" }) });
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useSession("s1"));
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    await expect(result.current.roll(5)).rejects.toBeTruthy();
  });
  expect(result.current.error).toBeTruthy();
});

it("切会话(sessionId 变更) → 重置叙事/pendingRoll/error/gameEnd 残留状态", async () => {
  const instances: FakeWS[] = [];
  vi.stubGlobal("WebSocket", class extends FakeWS { constructor(u: string) { super(u); instances.push(this); } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    protocol: CLIENT_PROTOCOL, sessionId: "s1", seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) }));

  const { result, rerender } = renderHook(({ sid }) => useSession(sid), { initialProps: { sid: "s1" } });
  await act(async () => { await Promise.resolve(); });

  // s1 累积叙事 + 待掷 + 错误
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "narration_commit", seq: 1, text: "旧会话叙事" }); });
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "roll_staged",
    pendingRoll: { eventId: 9, shape: "outcome", label: "旧待掷", yourSide: { name: "你", exprDisplay: "1d20" }, bands: [] } }); });
  act(() => { instances[0].emit({ protocol: CLIENT_PROTOCOL, type: "error", code: "x", message: "旧错误" }); });
  expect(result.current.narration.length).toBeGreaterThan(0);
  expect(result.current.pendingRoll).not.toBeNull();
  expect(result.current.error).toBeTruthy();

  // 切到 s2：旧会话残留状态必须清空（不闪现旧叙事/旧待掷/旧错误）
  rerender({ sid: "s2" });
  await act(async () => { await Promise.resolve(); });
  expect(result.current.narration).toEqual([]);
  expect(result.current.pendingRoll).toBeNull();
  expect(result.current.error).toBeNull();
  expect(result.current.gameEnd).toBeNull();
});

it("旧会话的迟到 refetch 不覆盖新会话快照（sessionId 守卫）", async () => {
  vi.stubGlobal("WebSocket", class extends FakeWS {});
  // 每次 fetch 回带 sessionId 标记的快照；用于断言守卫只接受当前会话的快照
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
    const m = /sessions\/([^/]+)\/presentation/.exec(url);
    const sid = m ? m[1] : "?";
    return Promise.resolve({ ok: true, json: async () => ({
      protocol: CLIENT_PROTOCOL, sessionId: sid, seq: 0, sheets: [], mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null }) });
  }));

  const { result, rerender } = renderHook(({ sid }) => useSession(sid), { initialProps: { sid: "s1" } });
  await act(async () => { await Promise.resolve(); });
  rerender({ sid: "s2" });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  // 切到 s2 后 snapshot 应是 s2 的（不被 s1 迟到 refetch 覆盖）
  expect(result.current.snapshot?.sessionId).toBe("s2");
});
