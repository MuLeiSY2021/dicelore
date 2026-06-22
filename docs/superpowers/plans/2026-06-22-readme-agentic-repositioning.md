# 定位升维（agentic 角色扮演宿主）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把项目对外定位从「安价 GM 框架」升维为「agentic 时代的角色扮演宿主」——先改 wiki 01 上游口径 + 新增 ADR-0020，再下推 README 九段重写。

**Architecture:** 纯文档/定位重构。单向推导：wiki 01（问题域升维 + 安价两页措辞微调）+ ADR-0020 为上游，README 为下游。下游引上游口径，不反向。技术设计层（02/03/04）一行不动。

**Tech Stack:** Markdown only。无代码、无单元测试；验证 = 对照 spec §8 验收 + 链接/图片路径核对 + `npm test`/`npm run typecheck` 确认未误伤。

**Spec：** `docs/superpowers/specs/2026-06-22-readme-agentic-repositioning-design.md`

## Global Constraints

- **slogan 定稿(逐字,不得改写)**：主 `A rose without thorns is too perfect to be true.`；中文灵魂正本「虚拟太完美了，像一朵没有味道也没有刺的玫瑰。」；锋刃 `Flawless, and therefore false.`
- **英文关键词**：`agentic`（中文自然表述「agent 化/智能体化」，不硬译）。
- **叙事宪法(spec §2.1)**：① 攻击范式(提示词天花板/LLM 讨好本能)不攻击产品；② 不喊「杀手」也不喊「接棒人/续作」，讲独立起源；③ 让裂缝自己说话(客观事实)；④ 诚实划界(不抢纯陪伴/拟真)；⑤ 诚实标注现状 vs 在建。
- **致谢酒馆**：作为「调研竞品时发现的重要灵感来源、同赛道前辈」，无代码血缘。
- **不动**：02/03/04 全部；wiki 问题域 §1「开源占卡位、不追护城河」叙事保留。
- **commit 前缀**：wiki 改动用 `docs(01)`/`docs(adr)`，README 用 `docs(readme)`。结尾附 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- **分支**：`docs/readme-agentic-repositioning`（已建）。

---

### Task 1: wiki 问题域.md 升维（上游核心口径）

**Files:**
- Modify: `docs/wiki/01-业务分析/问题域.md`（§状态行、§一句话、§1、§6.4 引用）

**Interfaces:**
- Produces: 「agentic 时代的角色扮演宿主 + 安价为首发载体 + GM 塑形为手段」的权威口径，Task 3（ADR）与 Task 4（README）下游引用。
- Consumes: 无。

- [ ] **Step 1: 改写 §一句话（顶部定位段）**

把现有 §一句话两段替换为(措辞可微调，但 slogan 逐字、须守叙事宪法)：

```markdown
## 一句话

**虚拟太完美了，像一朵没有味道也没有刺的玫瑰。** 当 AI 有求必应、剧情永远顺遂，虚拟世界就失去了「刺」——真正的对抗与后果。Dicelore 要把刺装回去：它是 **agentic 时代的角色扮演宿主**，把 AI 关进一个它改不了的世界，让对抗回来。

安科 / 安价（论坛接龙 + 投票 + 骰子裁决）是这件事**第一个、也最自证的载体**——天生需要外置状态、不可绕过的规则、多方投票，正是提示词范式撑不起、agentic 架构吃得下的东西。而把被嫁接的 AI 塑形成「不讨好的诚实 GM」（对抗讨好本能、不跳骰、不软着陆），是让刺立住的**核心机制**。

> 本项目仍是**开源、易分发**的：不自己跑模型、不绑定某套规则、不做闭环产品，而是给一个主流、可换底层模型的 AI agent 套上这层框架（具体基底与可移植边界 → [技术选型 §6](../03-架构/技术选型.md)）。
```

- [ ] **Step 2: §1 标题/首句衔接升维**

§1 现标题「第一性问题：一个真实存在、却没人趁手解决的空白」保留；首句把「安科…交给 AI 的需求」一句后补一句衔接，使「空白」服务于新命题（agentic 宿主），而非仅安价垂类。新增一句（接在 §1 现有首段末）：

```markdown
> 把镜头拉远：安价只是「让虚拟重新有对抗」这件事最锋利的一个切口；同样的空白存在于任何该有对抗、却被讨好本能磨平的虚拟叙事（TRPG、有对抗的 galgame…）。下文论证以安价为样本，结论对整个 agentic roleplay 品类成立。
```

- [ ] **Step 3: §6.4 玫瑰段标注「已上提」**

§6.4 内容保留（玫瑰句、完美失真、把刺装回去的论证不动）。在 §6.4 开头小注里补一句，标明它已上提为顶层命题：

```markdown
> （本节的「玫瑰/对抗」体感已上提为项目顶层命题，见本页 §一句话与 README hero；此处保留其完整结构论证。）
```

- [ ] **Step 4: 更新 §状态行**

在 §状态行追加一笔（保留原有历史标注）：

```markdown
；**2026-06-22 §一句话升维**——命题由「安价 GM 框架」上提为「agentic 时代的角色扮演宿主」，安价重述为首发载体，详见 [ADR-0020](../05-决策记录-ADR/README.md)）。
```

- [ ] **Step 5: 自检**

核对：① §一句话含玫瑰中文正本 + 「agentic 时代的角色扮演宿主」；② 安价出现身份为「首发/最自证载体」，非「项目目的」；③ GM 塑形表述为「核心机制/手段」；④ §1-§6 原有论证未删（只增不删）；⑤ 未出现攻击酒馆产品、未喊杀手/接棒；⑥ 页内相对链接仍有效。

- [ ] **Step 6: Commit**

```bash
git add docs/wiki/01-业务分析/问题域.md
git commit -m "docs(01): 问题域 §一句话升维为 agentic 角色扮演宿主

命题由「安价 GM 框架」上提为「agentic 时代的角色扮演宿主」；
安价重述为首发/最自证载体；GM 塑形降为核心机制；§6.4 玫瑰上提为顶层命题。
保留 §1-§6 全部论证与开源占位叙事。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 安价两页措辞微调（安科安价是什么 + 用户与场景）

**Files:**
- Modify: `docs/wiki/01-业务分析/安科安价是什么.md`
- Modify: `docs/wiki/01-业务分析/用户与场景.md`

**Interfaces:**
- Consumes: Task 1 的「安价 = 首发载体」口径（口径已在 spec/Task1 Step1 定稿，可不等 Task 1 提交，照口径写即可）。
- Produces: 两页安价定位与新口径一致。

- [ ] **Step 1: 安科安价是什么.md —— §5 末尾加一句载体定位**

在 §5「和传统桌面跑团的关系」末段「而不是去复刻某套桌面 TRPG 引擎」后，新增：

```markdown
> **它在本项目里的身份**：安科/安价不是 Dicelore 服务的「垂类目的」，而是「让虚拟重新有对抗」这件事**第一个、最自证的载体**——它的投票/骰子/接龙形态天生吃 agentic 架构红利。框架命题与品类边界见 [问题域 §一句话/§6.3](问题域.md)。
```

- [ ] **Step 2: 用户与场景.md —— 调「付费/接入方」注的措辞**

将现「> **谁是付费/接入方？** v1 不预设商业角色。」这一行的「付费」语义淡化（呼应不商业化），改为：

```markdown
> **谁是接入方？** 最直接的使用者是**团本作者 = 接入者**：拿 Dicelore 嫁接到自己的 agent 上、填一个团、开跑。玩家通过这个团间接消费框架。（v1 不预设商业角色；项目不走商业化，详见 [ADR-0020](../05-决策记录-ADR/README.md)。）
```

- [ ] **Step 3: 自检**

核对：① 两页安价均呈现为「首发载体」而非「目的」；② 用户与场景不再以「付费角色」为框架；③ 链接有效；④ 未删除原有场景/路线图论证。

- [ ] **Step 4: Commit**

```bash
git add docs/wiki/01-业务分析/安科安价是什么.md docs/wiki/01-业务分析/用户与场景.md
git commit -m "docs(01): 安价两页措辞微调——重述为首发载体、淡化付费角色

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 新增 ADR-0020（定位升维 + 不商业化）

**Files:**
- Modify: `docs/wiki/05-决策记录-ADR/README.md`（在 ADR-0019 之后追加 ADR-0020）

**Interfaces:**
- Consumes: Task 1 口径。
- Produces: ADR-0020，被 Task 1/2/4 引用。

- [ ] **Step 1: 追加 ADR-0020（逐字成稿）**

在文件末尾「待决策」段之前（或最末一条 ADR 之后）追加：

```markdown
## ADR-0020 定位升维：从「安价 GM 框架」到「agentic 时代的角色扮演宿主」

- **背景**：早期对外定位「服务安科/安价的 GM 行为塑形框架」已小于作者真实野心。目标是承接 SillyTavern（酒馆）一类**提示词架构**宿主迟早让出的生态位；核心命题收敛为「把对抗（刺）装回虚拟体验」——见 [问题域 §6.4](../01-业务分析/问题域.md) 的玫瑰隐喻。酒馆是调研竞品时发现的重要灵感来源，但与本项目**无代码血缘**。
- **决策**：① 对外一句话升维为「**agent 化的酒馆 / agentic 时代的角色扮演宿主**」；② GM 行为塑形（F1/F2/F3）由「定位本身」降为「让刺立住的实现手段」；③ 安科/安价重述为「**第一个、最自证的载体**」，非垂类目的；④ 英文关键词定为 `agentic`（中文不硬译）；⑤ 叙事姿态=**独立起源**、致谢酒馆为灵感来源、**攻击范式不攻击产品**、不喊杀手/接棒（无血缘，避免误导成衍生）；⑥ **放弃商业化**——许可证为纯 **AGPL-3.0-or-later**，移除双授权/商业授权话术。
- **后果**：README 整体重写为「玫瑰钩子 → 分层下沉」九段；问题域/安价两页措辞升维；**下游技术设计（02/03/04）不变**；品类边界（不抢纯陪伴/拟真，见 [成功标准 §3](../01-业务分析/成功标准.md)）维持；问题域 §1「开源占卡位、不追护城河」叙事保留（与不商业化一致）。**被否**：正面喊「取代/杀死酒馆」、自称「酒馆接棒人」（无血缘会误导成续作）。
```

- [ ] **Step 2: 更新 wiki README 的 ADR 编号范围（若有标注）**

检查 `docs/wiki/README.md` 与 `docs/wiki/05-决策记录-ADR/README.md` 顶部若写「0001–0019」，改为「0001–0020」。

```bash
grep -rn "0001.0019\|0001–0019\|0001-0019" docs/wiki/
```

对命中处改为 `0001–0020`。

- [ ] **Step 3: 自检**

核对：① ADR-0020 三段式齐全（背景/决策/后果）；② 含「不商业化/纯 AGPL」「独立起源」「攻击范式不攻击产品」「被否：取代/接棒」；③ 编号范围已同步；④ 链接有效。

- [ ] **Step 4: Commit**

```bash
git add docs/wiki/05-决策记录-ADR/README.md docs/wiki/README.md
git commit -m "docs(adr): 新增 ADR-0020 定位升维 + 放弃商业化

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: README.md 九段重写（下游）

**Files:**
- Modify: `README.md`（整体重写，保留 logo/截图/CONTRIBUTING/LICENSE 资产引用）

**Interfaces:**
- Consumes: Task 1 定位口径、Task 3 ADR-0020、Global Constraints 的 slogan。
- Produces: 对外门面。

**前置**：Task 1 已提交（下游引上游口径）。

- [ ] **Step 1: 重写 Hero 段（逐字，保留 logo）**

```markdown
<p align="center">
  <img src="docs/wiki/04-子系统设计/玩家客户端-视觉草图/dicelore-logo-dark.png" alt="Dicelore" width="440">
</p>

<p align="center"><strong><em>A rose without thorns is too perfect to be true.</em></strong></p>

> 「虚拟太完美了，像一朵没有味道也没有刺的玫瑰。」

**Dicelore** 是 **agent 化的酒馆**——agentic 时代的角色扮演宿主。它把 AI 关进一个它改不了的世界，用骰子、外置状态和不讨好的诚实 GM，把「刺」（真正的对抗与后果）装回虚拟体验。
```

- [ ] **Step 2: 第 2 段「它在反抗什么」**

要点（散文，守叙事宪法）：① 玫瑰叹息——AI 有求必应→虚拟太完美→失真无聊；② `prompt-based → agentic` 范式换代：提示词范式状态住在 context 里、有求必应是结构必然；③ 大方致谢酒馆是把提示词范式做到极致的灵感来源；④ 诚实划界：不抢纯陪伴/拟真，只打「机制可信/有对抗」的赛道。**禁止**：贬低酒馆产品、喊杀手/接棒、讲 fork 传承史。

- [ ] **Step 3: 第 3 段「预览·玩家客户端」（保留现有截图块）**

保留现有 README 第 9–25 行的截图表格与「墨金主题」描述，标题/导语小改一句呼应「agentic tavern 长这样」。

- [ ] **Step 4: 第 4 段「完美为何失真」**

要点：AI 讨好本能 = 没有刺，落到三种可观测失败 F1 跳骰 / F2 软着陆 / F3 替玩家选（沿用现有「它解决什么」的 F1/F2/F3 文字）。

- [ ] **Step 5: 第 5 段「怎么把刺装回去」+ 代际差对比表（表格逐字）**

先讲三层强制力（L1 工具强制 / L2 塑形教条 / L3 审计网）+ 权威状态外置（AI 够不到的 SQLite，四业务域 sheet/event/world/rule），再放对比表：

```markdown
| | 提示词范式（酒馆） | Dicelore（agentic） |
|---|---|---|
| 状态住哪 | AI 的输出里（context） | AI 够不到的 SQLite |
| 谁掷骰 / 取数 | AI 自己写个数字 | 引擎执行，AI 只给引用 |
| 世界查询 | 关键词触发整段注入 | 结构化检索（按需拉） |
| 加一项能力的代价 | context 变胖、token 涨 O(能力数) | 多一个工具，context 不涨 O(1) |
| 反 F1/F2（防跳骰/软着陆） | 靠 AI 自觉（结构上无法阻止） | 结构上 AI 拿不到真值 |
```

一句收口（逐字）：**酒馆把世界塞进提示词，Dicelore 把 AI 关进一个它改不了的世界——这是代际差，不是优化差。**

- [ ] **Step 6: 第 6 段「现在能玩什么」（诚实分层）**

逐字骨架：

```markdown
## 现在能玩什么

- **现在可玩**：装好 Claude Code（可接各种大模型，含国产）+ `dicelore` CLI，本机一键脚手架即可跑**单人安价**——框架强制掷骰/给选项、维护人物卡与剧情状态，AI 据结果叙述且不软着陆。
- **在建中**：不依赖 Claude Code TUI、用 Claude Agent SDK 程序化驱动的**全栈玩家客户端**（自建后端 + 墨金主题 web 前端）。进度见 [里程碑](docs/wiki/06-里程碑与问题/里程碑.md)。
```

- [ ] **Step 7: 第 7–9 段（技术栈/开发/文档 + 路线图/状态 + 许可证/贡献）**

- 技术栈/开发/文档：精简保留现有 README 第 43–62 行内容。
- 状态/路线图：保留并指向里程碑。
- **许可证段（关键删改）**：保留 AGPL 徽章 + 「采用 AGPL-3.0-or-later 开源」+ Copyright + AGPL 要点说明；**删除**现有 README 第 78 行整段「**双授权 / 商业授权**……联系 MuLeiSY2021 …洽谈单独的商业授权。」。贡献段（CONTRIBUTING 链接）保留。

- [ ] **Step 8: 自检（对照 spec §8 验收）**

核对：① 第一屏见玫瑰 slogan + agentic 定位，无「服务安价的 GM 框架」旧定位句；② 安价身份=首发载体；③ 许可证段只剩 AGPL、无商业/双授权；④ 现状 vs 在建已分层；⑤ 守叙事宪法（不攻击酒馆产品、不喊杀手/接棒、不讲传承史）；⑥ 所有图片(`docs/wiki/04-…/*.png`)与链接路径仍有效。

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "docs(readme): 重写为 agentic 角色扮演宿主——玫瑰钩子 + 分层下沉

Hero 玫瑰 slogan + agentic 定位；GM 塑形降为机制；安价为首发载体；
加 prompt vs agentic 代际差对比表；现状/在建诚实分层；许可证转纯 AGPL。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 终检（一致性 + 未误伤 + 链接）

**Files:** 无改动（只读核对）；如发现问题回到对应 Task 修。

- [ ] **Step 1: 跑构建确认纯 md 改动未误伤**

```bash
npm test && npm run typecheck
```
Expected: 与改动前一致通过（纯文档不应影响）。若失败，确认与本次 md 改动无关。

- [ ] **Step 2: 上下游口径一致性核对**

对照 spec §8 全部 7 条验收逐条打勾；重点确认 README 定位口径与 wiki 01/ADR-0020 不矛盾（单向推导）。

- [ ] **Step 3: 链接/图片全量核对**

```bash
grep -oE '\]\(([^)]+)\)' README.md docs/wiki/01-业务分析/问题域.md docs/wiki/05-决策记录-ADR/README.md
```
逐条确认相对路径与图片存在（尤其 README 内 `docs/wiki/04-…/*.png` 与 `.html`）。

- [ ] **Step 4: 清场（problem-lifecycle ③）**

- 删除本 spec：`docs/superpowers/specs/2026-06-22-readme-agentic-repositioning-design.md`
- 删除本 plan：`docs/superpowers/plans/2026-06-22-readme-agentic-repositioning.md`
- 检查 `docs/wiki/06-里程碑与问题/问题总账.md` 是否有相关条目需关闭/更新（如有「README/定位过时」类欠账则关闭）。

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "docs: 定位升维收尾——清理 spec/plan、核对链接与口径一致性

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 执行波次（DAG）

- **Wave 1（并发）**：Task 1（问题域升维）· Task 2（安价两页）· Task 3（ADR-0020）——三者改不同文件、口径已在 spec 定死，可并发派 subagent。
- **Wave 2**：Task 4（README）——依赖 Task 1 已提交。
- **Wave 3**：Task 5（终检 + 清场）——依赖全部前置。

## Self-Review

- **Spec coverage**：spec §2 升维→T1/T3；§2.1 叙事原则→Global Constraints + 各 Task 自检；§3 slogan→Global Constraints + T4S1；§4 范围→T1-T4；§5 README 九段→T4 九步；§5.1 取舍(GM降级/对比表/纯AGPL)→T4S1/S5/S7；§6 ADR→T3；§7 非目标(不动02/03/04、保留§1占位叙事)→Global Constraints；§8 验收→T4S8/T5S2。无缺口。
- **Placeholder scan**：slogan/对比表/ADR-0020/许可证删改/hero 均逐字给出；叙述段(T4S2/S4)给要点+禁止项(文档任务散文的合理粒度，非占位)。
- **Type consistency**：文件路径、ADR 编号(0020)、slogan 文本、分支名跨 Task 一致。
