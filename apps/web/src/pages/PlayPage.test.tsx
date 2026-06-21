// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import PlayPage from "./PlayPage.js";
import { useSession } from "../live/useSession.js";
import type { PresentationSnapshot } from "@dicelore/shared";

vi.mock("../live/useSession.js", () => ({ useSession: vi.fn() }));

const snap: PresentationSnapshot = {
  protocol: "dicelore.client/1", sessionId: "demo", seq: 5,
  sheets: [{ entity: "张三", cells: [{ attr: "HP", value: "12", visible: 1 }] }],
  mechanics: [], choices: null, narrativeCursor: 0, pendingRoll: null,
};

function mockSession(over: Partial<ReturnType<typeof useSession>> = {}) {
  (useSession as Mock).mockReturnValue({
    snapshot: snap, narration: [], pendingRoll: null,
    postMessage: vi.fn().mockResolvedValue({ turnId: "t" }), roll: vi.fn().mockResolvedValue({ turnId: "t" }),
    ...over,
  });
}

it("三栏壳齐全(活动轨/叙事/呈现台) + 呈现台渲染快照", () => {
  mockSession();
  render(<PlayPage />);
  expect(screen.getByLabelText("活动轨")).toBeInTheDocument();
  expect(screen.getByLabelText("叙事")).toBeInTheDocument();
  expect(screen.getByLabelText("呈现台")).toBeInTheDocument();
  expect(screen.getByText("张三")).toBeInTheDocument();
});

it("有叙事时渲染段落；无 pendingRoll 时显示输入框", () => {
  mockSession({ narration: ["门开了。"] });
  render(<PlayPage />);
  expect(screen.getByText("门开了。")).toBeInTheDocument();
  expect(screen.getByLabelText("输入")).toBeInTheDocument();
});

it("pendingRoll 非空时打字区换成掷骰卡", () => {
  mockSession({ pendingRoll: { eventId: 7, shape: "outcome", label: "撬锁", yourSide: { name: "你", exprDisplay: "1d100" }, bands: [] } });
  render(<PlayPage />);
  expect(screen.getByRole("button", { name: /丢骰子/ })).toBeInTheDocument();
});
