# @dicelore/backend — 存储 + 服务 + 组合根

后端运行时宿主：嵌入式 SQLite 存储引擎、裁决/呈现/团本等纯服务、HTTP/WS 边，以及**组合根**（构造 storage-port 实现、按会话注入 harness）。在四根架构里属 `backend/` 根（→ `packages/*` + `packages/shared`，反向零 import）。

> 端口/依赖方向/组合根生命周期 → 见 [`docs/重构/ADR-storage-port.md`](../docs/重构/ADR-storage-port.md)；store 域内分组的依据 → [`docs/重构/模块内部架构-决议.md`](../docs/重构/模块内部架构-决议.md)。

```
src/
  store/              地基：嵌入式 SQLite 存储，全项目被依赖最重
    sheet/              人物/世界状态域：state / mutate / visibility
    event/              事件日志域：record / history
    world/              世界域：world(lore/pool) / rule / anchor
    narrative/          叙事域：front(阵线) / plotline / foreshadow / watcher
    interaction/        交互域：choice(待选) / pendingRoll(待掷)
    db.ts views.ts      库句柄 + 视图（顶层基建，横切诸域）
    fts.ts              全文检索（FTS5 + jieba）
    snapshot.ts         per-turn 快照（回滚=选快照）
    usage.ts evalCtx.ts 用量统计 / eval 上下文（横切）
  expr/               取数文法：evaluate / parse / predicate（store 的下游纯逻辑）
  resolve/            裁决：commitRoll(明骰提交) / contest(对抗)
  present/            呈现模型生成：model / playerView / tensionBoard
  toolgen/            声明式 SQL → ToolDef 编译（read/write tool、sqlGuard、view）
  stdlib/             内置工具实现：narration / npc
  session/            会话 DB 元数据 KV（metaGet/metaSet）+ 路径解析
  catalog/            团本包库：uuid / commit / git 投影 / import 闸门（开局物化）
  build/              lore 构建纯逻辑：draft / buildMcp(构建工具面) / pack(校验) / retrieval(检索)
  eval/               评测纯件：loadScenario / prepareSessionDb / 断言库（dice + lore）
  api/                HTTP/WS 边（薄路由 + 组合根接线）：dice / lore / ws / sessions / presentation / diagnostics
  integration/        跨 backend+harness 的集成测试（harness / import）
  sessionBackend.ts   storage-port 实现：openSessionBackend(db) 闭包绑 db 组装 SessionBackend
  server.ts           后端进程入口（组合根：解析会话库 → importPack → openSessionBackend → 注入 harness 会话）
  cli.ts              开发 CLI：new / list / inspect / init
  index.ts            公共 barrel（显式手写 re-export，不用 auto export*）
```

关键约定：
- **ports-adapters / storage-port**：`sessionBackend.ts` 实现 `@dicelore/interface` 的 `SessionBackend` 端口；harness 经注入的端口访存储，不直连 backend——断 backend↔harness 模块级环。
- **`api` 是组合根**：在 HTTP/WS 入口把抽象接到具体实现（解析库、import 团本、组装端口、注入会话工厂）。
- store 按**业务域**分组（非按层）；`db/views/fts/snapshot/usage/evalCtx` 作基建横切留 store 顶层。
