# @dicelore/errors — 错误契约（纯叶包）

全项目统一的错误类型 `DiceloreError`（带分类 `code` + 可选 `hint`）。**纯叶子**：零依赖、谁都可依赖它、它不依赖任何包。在四根架构里属 `packages/`（纯库）。

```
src/
  errors.ts   DiceloreError 类 + DiceloreErrorCode 联合（EXPR_EVAL / RANGE_INVALID / BAD_INPUT / …）
  index.ts    公共 barrel（re-export errors）
```

依赖方向：被 `packages/*`、`backend/`、`harness/` 广泛消费；自身不 import 任何包。
