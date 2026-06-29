# @dicelore/harness — agent 运行时

驱动 agent 的运行时：共享回合骨架 + 两条自包含的 GM 角色线（dice 跑团 / lore 构建）。在四根架构里属 `harness/` 根；经注入的 `SessionBackend` 端口（`@dicelore/interface`）访存储，**不直连 `backend`**（模块级无环）。

> 共享骨架 vs 角色线自包含的依据 → [`docs/重构/模块内部架构-决议.md`](../docs/重构/模块内部架构-决议.md)；为何接受 4 处组合根/入口的包级互指 → [`docs/重构/ADR-storage-port.md`](../docs/重构/ADR-storage-port.md) §5.2。

```
src/
  runtime/            共享骨架（两条线复用）：session(身份契约+SessionRegistry) / registry / streamTurn / agent / wsHub / reasoning
  dicegm/             dice 跑团线（GM 角色 = 工具面 + 适配器 + 技能 + prompt，自包含）
    mcp/                in-play MCP 工具面（dice 私有）：server / runTool / handlers(sheet/event/world/resolver/io) / schemas / envelope / reminders / rollGate / tooldef / main.ts(stdio 入口)
    adapter/            GM 适配：init / templates / sessionContext / l3 / ruleRecall / turnEnd / hooks(CC spawn 的独立进程脚本)
    skills/             教条 .md 资产：dicelore-gm-core + dicelore-flow-*(anka/contest/explore/gacha)
    DiceGm.ts FakeDiceGm.ts   agent 适配器（真 / fake）
    DiceSession.ts turnLoop.ts rollGate.ts recovery.ts notify.ts gmAssembly.ts openingPrompt.ts skillStage.ts   会话/回合循环/明骰 gate/开场组装
  loregm/             lore 构建线（自包含）：LoreSession / openingPrompt / skills(dicelore-build-pack)
  index.ts            公共面（显式手写 re-export；顶注记载包级互指裁决单源）
```

关键约定：
- **共享骨架 + 角色线自包含**：`runtime/` 是 loregm 与 dicegm 都用的真共享件；`mcp/` `adapter/` 是 dicegm 私有（loregm 零引用），故下沉 dicegm 而非抬成顶层。两条线对称、各自自包含。
- **经端口访存储**：mcp 工具面经注入的 `SessionBackend` 调存储；仅 `dicegm/mcp/main.ts`（stdio 入口）+ `dicegm/adapter/hooks/*`（CC 独立进程脚本）4 处作组合根/入口直接 import backend——这是入口本分，已裁决接受。
