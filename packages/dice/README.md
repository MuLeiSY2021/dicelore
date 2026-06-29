# @dicelore/dice — 骰子数学（纯叶包）

纯骰子数学：喂 RNG 即可单测的 `rollDice` / `rangeMap` / `resolveOutcome` 等纯计算，不认识存储、不认识 agent。在四根架构里属 `packages/`（纯库底座）。

```
src/
  index.ts   Rng 类型 + rollDice / rangeMap / resolveOutcome 等纯函数（喂种子可复现）
```

依赖方向：仅依赖叶包 `@dicelore/errors`；被 `backend/`（resolve/裁决）、`packages/interface`（域类型引 `Rng`）消费。
