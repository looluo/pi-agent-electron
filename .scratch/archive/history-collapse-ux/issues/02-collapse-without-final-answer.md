# 无最终回答的回合默认折叠

Status: resolved

## 问题

`ChatWindow.tsx` 中 ProcessDetailsGroup 调用点传 `defaultExpanded={!finalAnswerMessage}`：aborted、stopReason=toolUse 中断、纯 thinking 结尾的回合（无「最终回答」——定义为回合最后一条 assistant 消息里排在最后一个工具调用/thinking 之后的文本）强制展开。

实测（会话 01a0a945）：回合 1（[63] thinking+aborted）、回合 4（[208] 空+aborted）、回合 5（流式中）均默认展开；原设计意图是「否则回合不可见」，但用户消息 + 组头（「处理详情 · N 条消息 · M 次工具调用」）本身可见且信息量足够，强制展开反而制造「默认全展开」的观感。

## 方案

调用点改为不传 `defaultExpanded`（组件默认 false）。`reveal`（搜索跳转强制展开）保持不变。

## 验收

- aborted / toolUse 中断 / 纯 thinking 回合默认折叠，仅显示组头。
- 搜索跳转（reveal）仍能强制展开目标组。
- 更新 `ChatWindow.process-details.test.mjs` 断言（原断言锁定旧行为，需反转为锁定新行为）。

## Comments

### 2026-09-16 已实现（工作树，未提交）

`pi-web/src/components/ChatWindow.tsx`：ProcessDetailsGroup 调用点移除 `defaultExpanded={!finalAnswerMessage}`，回落组件默认 `false`；`reveal`（搜索跳转强制展开）不变。`ChatWindow.process-details.test.mjs` 断言反转为锁定新行为。

## Answer (2026-10-14 re-audit: superseded by upstream #906)

Our fix (26be91e, defaultExpanded always false) was displaced by the v0.12.0
sync's f47c38a semantics. Current call site is
`defaultExpanded={!answered}` with `collapsesProcessDetails()` deciding: a
turn collapses when its answer carries non-empty text or an image, and stays
open for error/truncation notices, aborted turns and pure-thinking turns —
the opposite call from this ticket, deliberately: upstream #906 argues that
text a turn wrote before its last tool call lives inside the group, and
collapsing error turns would hide it.

Judgement: accept the upstream semantics and close. The original complaint
("everything reopens expanded") is largely absorbed by tickets 01 + 03
(anchor-aligned windows + remembered expansion), and re-carrying this diff
against upstream would re-conflict on every sync. If aborted turns' open
state still bothers in practice, the upstream-compatible lever is persisting
them collapsed (ticket 03's mechanism), not flipping the default.
