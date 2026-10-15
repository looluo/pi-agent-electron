# Spec: 历史会话折叠体验修复（history-collapse-ux）

## 背景

用户在 Pi Agent App（Electron + pi-web 前端）中重开长会话时观察到：工具调用与 thinking「默认展开」，手动折叠后切换会话再切回，全部恢复展开。

2026-09-16 实机诊断（带 CDP 的第二实例 + 会话 JSONL 比对，会话 01a0a945「排查对话工具调用默认展开问题」，225+ 条目）确认了三层叠加根因：

1. **初始窗口切在回合中间 → 平铺渲染**。打开会话只加载活动分支尾部 50 条（`sessions.ts` 默认 `tail=50` → `buildSessionContext`）。实测窗口首条落在回合 2 中段（entry [190]），窗口内无用户消息锚点；`ChatWindow` 分组循环只把「锚点之后」的消息包进 `ProcessDetailsGroup`，锚点之前的内容**直接平铺、没有折叠把手**。这是「重开即展开」的主因。
2. **无最终回答的回合强制展开**。`ChatWindow.tsx`：`defaultExpanded={!finalAnswerMessage}`。「最终回答」= 回合最后一条 assistant 消息里排在最后一个工具调用/thinking 之后的文本；aborted、toolUse 中断、纯 thinking 结尾的回合都没有 → 组强制展开。实测本会话 5 个回合中 1/4/5 均如此。
3. **折叠状态不持久**。组 / 单 thinking 块 / 单工具调用块的展开态全部是 React `useState`；会话 JSONL 无 UI 状态；切换会话 `AppShell.tsx` `<ChatWindow key={sessionKey}>` bump → 整树重挂载 → 按默认规则重算。

## 目标

- 重开会话首屏即有可折叠的「处理详情」组（窗口起点回退到最近回合锚点）。
- 无最终回答的回合也默认折叠（用户消息 + 组头仍可见，内容可手动展开）。
- 组级展开状态按会话记忆（sessionStorage），切对话再切回不丢。

## 非目标

- 单个 thinking / 工具调用块的展开态持久化（重置为默认，观察修复 ①② 后是否仍痛）。
- 会话 JSONL / 后端持久化 UI 状态。
- 超长回合（> 回退上限）仍平铺的边角（回退有上限，防一次性加载超大回合）。

## 票据

- `issues/01-anchor-initial-window.md` — 初始窗口回退到最近回合锚点
- `issues/02-collapse-without-final-answer.md` — 无最终回答的回合默认折叠
- `issues/03-persist-group-expansion.md` — 组展开状态按会话持久化
