# 初始窗口回退到最近回合锚点

Status: ready-for-agent

## 问题

打开会话时 `buildSessionContext`（`pi-web/src/lib/session-reader.ts`）按 `tail=50` 切活动分支尾部。窗口起点落在某回合中间时，窗口内没有该回合的用户消息锚点；`ChatWindow` 的分组循环只把锚点之后的消息包进 `ProcessDetailsGroup`，**锚点之前的内容平铺渲染，没有任何折叠把手**。

实测（会话 01a0a945，225+ 条）：窗口首条 = entry [190]（回合 2 中段），顶部为 ~7 条 thinking+工具调用平铺墙；用户感知即「重开对话还是全展开」。

## 方案

`buildSessionContext` 在**初始加载路径**（未传 `before`、`excludeLeaf` 为假）上：若 `sliced[0]` 有更早历史，则沿 parentId 向前回退收集条目，直到最近的回合锚点（`message.role === "user"` 或 `compaction`），并把回退段前插进窗口。带**回退上限**（300 条）防止一次性拉入超大回合；超限未找到锚点则保持现状（平铺）。

分页路径（`before` + `excludeLeaf`）不回退——分页前插后锚点迟早进窗，只有初始窗口的头部存在此问题。

`hasMore` / `oldestEntryId` 基于回退后的 `sliced[0]` 重算，分页无重复无空洞。

## 验收

- 长回合中段开窗：窗口首条为回合锚点（用户消息），首屏出现 ProcessDetailsGroup。
- 锚点距离超上限：行为与现状一致（平铺），不抛错。
- 分页（excludeLeaf）调用不触发回退。
- `session-reader` 单测覆盖以上三分支。

## Comments

### 2026-09-16 已实现（工作树，未提交）

`pi-web/src/lib/session-reader.ts`：`buildSessionContext` 初始路径增加锚点回退——窗口头非锚点且有更早历史时，沿 parentId 回退至最近回合锚点（用户消息 / compaction），上限 `ANCHOR_ROLLBACK_CAP = 300`；分页路径（`excludeLeaf`）与「窗口头已是锚点」两种情况均不回退。`hasMore`/`oldestEntryId` 基于回退后窗口重算，分页无重复无空洞。

新增 `pi-web/src/lib/session-reader.anchor-rollback.test.mjs`（6 用例：中段开窗回退 / 头即锚点不回退 / compaction 锚点 / 超上限保持现状 / 分页不回退 / hasMore+衔接）。既有 `session-reader.pagination.test.mjs` 全部通过（41 pass / 1 skip）。

### 2026-09-16 追加修复：分页页同样回退（用户实测反馈）

首版只回退初始窗口；用户向上滚动时分页页把回合中段先送进来（页首无锚点 → 平铺展开观感），翻到回合锚点所在页时整段重组成折叠组——「下面展开、滚到开头变折叠」的跳变。修正：回退条件去掉 `!excludeLeaf`，任何窗口（初始或分页页）头非锚点都回退，回合内容永远与锚点同页到达。`ANCHOR_ROLLBACK_CAP` 导出供测试；分页测试的 `length <= tail` 界放宽为 `<= tail + ANCHOR_ROLLBACK_CAP`。全量测试过（仅剩既有无关失败）。

### 2026-09-16 追加修复 2：回退上限 300 → 2000（Symphony 会话实测）

用户在「实现支持多 Coding Agent 的 Symphony」（921 条）复现：进对话最后一回合不折叠，滚到提问处才折叠。根因：该会话**活动分支**最后一个回合 541 条（链上最后用户锚点在 379 位，tail-50 窗口头在 870 位，距离 491），超过 300 上限 → 回退放弃 → 平铺；滚动分页两页后锚点入窗 → 重组折叠。上限提至 2000（真实会话实测覆盖；渲染端有虚拟化，成本在载荷不在 DOM）。真实文件探针验证：初始窗口现以 user 消息开头、541 条一回合成组。500 条的旧上限用例改为 2500，并新增 541 形态回归用例。
