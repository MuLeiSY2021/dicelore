// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/harness 公共面（agent 运行时工具面 + 适配器；显式手写 re-export，不用 auto export*）。
// 这些行原样搬自 @dicelore/core 旧 barrel 的 mcp/* + adapter/* 部分；core 经裸 @dicelore/harness 转出，
// orchestrator 仍经 @dicelore/core 消费、签名不变（见重构 storage-port 阶段 5a）。
// mcp 工具面只依赖注入的 SessionBackend 端口（@dicelore/interface），不直连 @dicelore/backend；
// 唯组合根 mcp/main.ts 与 adapter/hooks/* 经 @dicelore/backend 开库/注入（入口允许）。

// 玩家闸控明骰 gate（供 orchestrator / 组件7 注入 gate、触发 commit）。
export { setRollGate, getRollGate, type RollGate } from "./mcp/rollGate.js";

// in-process MCP 工厂 + 写后回调接缝（组件7 orchestrator 用）。
export {
  createMcpServer,
  wrapToolForTest,
  type CanonWriteEvent,
  type McpServerDeps,
} from "./mcp/server.js";
// 内置工具工厂 + 元数据（组件7 配置页展示真实工具数）。
export { makeTools, BUILTIN_TOOL_NAMES, BUILTIN_TOOL_COUNT } from "./mcp/tools.js";
// 工具执行入口（集成/harness 测试经此跑工具）。
export { runTool } from "./mcp/runTool.js";
// 工具定义契约（自 @dicelore/interface 转出，供消费方拿类型）。
export type { ToolDef, ToolAnnotations } from "./mcp/tooldef.js";

// 回合末 hook（choice 物化 + L3 审计）——组件4，供 orchestrator turn-end 复用。
export { runTurnEnd } from "./adapter/turnEnd.js";
// 开场/系统 prompt 组装（组件4，供 orchestrator 装会话上下文）。
export { buildSessionContext } from "./adapter/sessionContext.js";
// 项目初始化（写 .mcp.json / settings.json / 装 skills；core cli 的 `init` 子命令经此）。
export { runInit } from "./adapter/init.js";
