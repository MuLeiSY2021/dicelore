// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import type { Agent, TurnInput, TurnEvent } from "../pkg/agent.js";

type Script = TurnEvent[] | ((input: TurnInput) => TurnEvent[]);

// 脚本化 GM 驱动：测试用，不烧 LLM。
export class FakeDiceGm implements Agent {
  constructor(private script: Script) {}
  async *runTurn(input: TurnInput): AsyncIterable<TurnEvent> {
    const events = typeof this.script === "function" ? this.script(input) : this.script;
    for (const e of events) yield e;
  }
}
