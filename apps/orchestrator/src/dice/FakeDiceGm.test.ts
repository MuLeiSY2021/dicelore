// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect } from "vitest";
import { FakeDiceGm } from "./FakeDiceGm.js";
import type { TurnEvent } from "../pkg/agent.js";

describe("FakeDiceGm", () => {
  it("按脚本异步吐出事件序列", async () => {
    const script: TurnEvent[] = [{ type: "narration", text: "你推门进去。" }, { type: "turn_end" }];
    const drv = new FakeDiceGm(script);
    const got: TurnEvent[] = [];
    for await (const e of drv.runTurn({ text: "我推门" })) got.push(e);
    expect(got).toEqual(script);
  });

  it("脚本可按输入定制(函数形式)", async () => {
    const drv = new FakeDiceGm((input) => [{ type: "narration", text: `收到:${input.text}` }, { type: "turn_end" }]);
    const got: TurnEvent[] = [];
    for await (const e of drv.runTurn({ text: "压价" })) got.push(e);
    expect(got[0]).toEqual({ type: "narration", text: "收到:压价" });
  });
});
