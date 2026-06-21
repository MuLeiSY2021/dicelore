// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { RollCard } from "./RollCard.js";
import type { PendingRoll } from "@dicelore/shared";

const pr: PendingRoll = {
  eventId: 12, shape: "contest", label: "说服守卫",
  yourSide: { name: "张三", exprDisplay: "1d20+{说服}" }, dc: 15,
};

it("亮 DC/exprDisplay + 点[掷骰]回调 eventId", () => {
  const onRoll = vi.fn();
  render(<RollCard pendingRoll={pr} onRoll={onRoll} />);
  expect(screen.getByText(/1d20\+\{说服\}/)).toBeInTheDocument();
  expect(screen.getByText(/15/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /丢骰子/ }));
  expect(onRoll).toHaveBeenCalledWith(12);
});
