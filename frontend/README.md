# @dicelore/frontend — React + Vite 玩家客户端

玩家客户端 UI：React + Vite。在四根架构里属 `frontend/` 根（→ `packages/shared`，经 HTTP/WS 连 `backend`，即「缝 B」）。内部按**轻量 feature 切片 + shared 公共层 + app 入口层**组织。

> 切片惯例的依据 → [`docs/重构/模块内部架构-决议.md`](../docs/重构/模块内部架构-决议.md)（frontend 段）。

```
src/
  app/         入口 / 路由 / providers：main.tsx / App.tsx / router.tsx
  shared/      跨 feature 公共层
    api/         fetch 基建 + health（http.ts）；各域专属 api 在 feature 内
    i18n/        国际化
    theme/       墨金主题 ThemeProvider
    settings/    useSettings
    icons/       图标
  features/    按业务域切片（各含页面 + 域内 api/hook）
    play/        游戏对局：PlayPage / useSession / Markdown / api
    catalog/     团本库：CatalogPage / api
    build/       团本构建：BuildPage / api
    home/        首页：HomePage
    config/      设置页诸面板：General / ModelConnection / McpServers / DataStorage / ServiceNetwork / ThemeAppearance / About
  shell/       外壳：TopBar / Logo / useHealth
  styles/      全局样式：tokens.css(墨金视觉 token) / shell.css
```

关键约定：
- **`@/*` 路径别名** → `src/*`（vite `resolve.alias` + tsconfig `paths`），消除脆弱的 `../../` 相对路径。
- **不引入 feature `index.ts` 桶文件**——直接深路径 import，保住 Vite tree-shaking。
- 测试 colocation：`*.test.tsx` 与被测件同目录。
