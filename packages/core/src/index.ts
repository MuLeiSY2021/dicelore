// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// @dicelore/core 公共面（additive；引擎纯逻辑反向零 import 本文件）。
// store 一族引擎层已迁入 @dicelore/backend；core 经裸 @dicelore/backend barrel 转出，
// orchestrator 仍经 @dicelore/core 消费、签名不变（见重构 storage-port 阶段）。
export { openDb, initSchema, type DB } from "@dicelore/backend";
export { initViews } from "@dicelore/backend";
// 声明式工具生成层接线（叙事层 dogfooding，spec §8 + DT-9 step③）
export { toolgenToToolDef } from "@dicelore/backend";
export { narrationStdlibTools, narrationToolDecls } from "@dicelore/backend";
export {
  buildPresentationModel,
  type PresentationModel,
  type EchoEntry,
  type VisibleCell,
  type ChoiceView,
} from "@dicelore/backend";

// 玩家闸控明骰原语（供 orchestrator / 组件7 注入 gate、触发 commit）。
export {
  stagePendingRoll,
  getPendingRoll,
  type PendingRollRow,
  type RollSpec,
  type RollShape,
} from "@dicelore/backend";
export { commitPendingRoll, type RollResult } from "@dicelore/backend";
export { setRollGate, getRollGate, type RollGate } from "@dicelore/harness";

// in-process MCP 工厂 + 写后回调接缝（组件7 orchestrator 用）。
export {
  createMcpServer,
  type CanonWriteEvent,
  type McpServerDeps,
} from "@dicelore/harness";
export { makeTools, BUILTIN_TOOL_NAMES, BUILTIN_TOOL_COUNT } from "@dicelore/harness"; // 内置工具工厂 + 元数据（组件7 配置页展示真实工具数）
// SessionBackend 端口接口聚合 + 组合根工厂（storage-port ADR §3/§4）——组合根建实例注入 createMcpServer。
export { openSessionBackend } from "@dicelore/backend";
export type { SessionBackend } from "@dicelore/interface";

// eval 场景准备（run.ts 手动调试 + orchestrator harness 自动闭环共用）。
export { loadScenario, prepareSessionDb, type Scenario, type PreparedSession } from "@dicelore/backend";

// 回合末 hook（choice 物化 + L3 审计）——组件4，供 orchestrator turn-end 复用。
export { runTurnEnd } from "@dicelore/harness";

// ===== Catalog 团本包库（后端双路径架构 P2）=====
export {
  openCatalog, type CatalogDB, uuidv5, resolveId, commit, history, checkout, tag, list,
  type PackFile, type CommitRow, type TuanbenSummary,
} from "@dicelore/backend";
// import 信任闸门 + 建库（P3）
export { importPack, validatePack, type ImportResult, type ImportIssue } from "@dicelore/backend";
// git 单向投影（P4）
export { exportGit, importGit } from "@dicelore/backend";

// ===== 团本构建层（P5）=====
export { Draft, commitDraft, type StateCell } from "@dicelore/backend";
export { createBuildMcpServer, invokeBuildTool, type BuildCtx, BUILD_SCHEMAS } from "@dicelore/backend";

// ===== 运行时只读浏览（组件7 跑团页左活动轨自查源；additive 只读，不改引擎） =====
export { loreSearch, loreGet, type Lore } from "@dicelore/backend";
export { ruleSearch, ruleGet, type Rule } from "@dicelore/backend";
export { logSince, logRecall, type LogRow } from "@dicelore/backend";
export { stateList, stateGet, type RuntimeStateCell } from "@dicelore/backend";
// session_meta KV(团本名/prologue/started 等,P2 Play 生命周期) + 路径规则(sessionDbPath/openSession)。
// 后端 server.ts 与 eval prepareSessionDb 共用 openSession 路径规则,避免种子灌到 core 路径而后端开平铺空库。
export { metaGet, metaSet, sessionDbPath, sessionDir, openSession, type SessionKind } from "@dicelore/backend";
export { buildSessionContext } from "@dicelore/harness";
export { createFileLogger, initGlobalLogger, getLogger } from "@dicelore/logs";

// ===== 回合快照（SNAP-1 / ADR-0017 v1：自动持久化、存档/读档）=====
// orchestrator turnEnd 调 checkpoint、/rewind 端点调 restore+latestSnapshot；participant 注册表供客制域接入。
export {
  checkpoint,
  restore,
  latestSnapshot,
  listSnapshots,
  registerSnapshotParticipant,
  defaultParticipants,
  tableParticipant,
  type SnapshotParticipant,
  type SnapshotRow,
  type CheckpointOpts,
} from "@dicelore/backend";

// ===== token 用量计量(CO-采集 / store/usage.ts)=====
// DiceGm 消费到 result.usage → recordUsage 落库;查询按 turn/agent/session 聚合(可视化另起 CO-前端线)。
export {
  recordUsage,
  listUsage,
  usageByTurn,
  usageByAgent,
  usageBySession,
  type UsageInput,
  type UsageRow,
  type UsageTotals,
} from "@dicelore/backend";
