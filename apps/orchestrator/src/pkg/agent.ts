// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

export interface TurnInput { text: string }

export type TurnEvent =
  | { type: "narration"; text: string } // 一段散文(Phase 1 = narrate 工具调用粒度)
  | { type: "turn_end" } // GM 本回合自然结束
  | { type: "error"; message: string }; // 驱动/SDK 错误

export interface Agent {
  runTurn(input: TurnInput): AsyncIterable<TurnEvent>;
}
