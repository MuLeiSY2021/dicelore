# @dicelore/logs — 分级 logger（纯叶包）

基于 pino 的分级文件 logger（按 level 严格分文件：error 只进 `error.log`，warn 进 `warn.log`…）。**纯叶子**：只依赖 pino。在四根架构里属 `packages/`（纯库）。

```
src/
  log.ts     createFileLogger / 全局 logger 初始化（pino multistream + dedupe，按级别分文件）
  index.ts   公共 barrel
```

依赖方向：被 `backend/`、`harness/` 消费；不依赖项目内任何包。
