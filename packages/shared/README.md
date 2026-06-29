# @dicelore/shared — 前后端共享类型（纯叶包）

前端（`frontend/`）与后端（`backend/`）之间走 HTTP/WS 时共用的协议 / 呈现 / REST / 流 / 通知类型。在四根架构里属 `packages/`（纯库）；是「缝 B」（后端↔web）的契约源。

```
src/
  protocol.ts      会话协议类型
  rest.ts          REST 请求/响应类型（MessageRequest / ChoiceRequest / RollRequest…）
  stream.ts        SSE/流式事件类型
  presentation.ts  呈现模型（前端渲染契约）
  notify.ts        通知事件类型
  index.ts         公共 barrel（re-export 全部）
```

依赖方向：纯叶子；被 `frontend/` 与 `backend/api` 双方消费，不依赖项目内其他包。
