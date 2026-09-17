# 组展开状态按会话持久化

Status: ready-for-agent

## 问题

ProcessDetailsGroup 的展开态是 `useState(defaultExpanded)`，切换会话时 `<ChatWindow key={sessionKey}>` 重挂载即归零。用户手动展开/折叠的结果不被记忆。

## 方案

新增 `pi-web/src/lib/process-group-expansion.ts`（对齐 `thinking-expansion-preference.ts` 的风格）：

- 存储：`sessionStorage`，key `pi-process-groups:<sessionId>`，值为展开组锚点 entryId 数组（封顶 200，FIFO 淘汰）。
- API：`isProcessGroupExpanded(sessionId, anchorId)` / `setProcessGroupExpanded(sessionId, anchorId, expanded)`，读写均 best-effort（storage 不可用时静默降级为无持久化）。
- ProcessDetailsGroup 增加可选 `persistence?: { sessionId: string; anchorId: string }`：初值读存储（有存储记录优先于 defaultExpanded），toggle 时写回。ChatWindow 调用点在 `session?.id` 与 `entryIds[userIdx]` 可得时传入。
- `reveal` 只改内存态不写存储（跳转是瞬态导航，不应固化展开）。

sessionStorage 而非 localStorage：随应用重启重置是有意为之——默认折叠的新世界开机即生效，不携带陈年展开记忆。

## 验收

- 展开某组 → 切到其他会话 → 切回：该组仍展开。
- 折叠某组 → 切走切回：仍折叠。
- 新会话（无 id）/存储异常：行为与无持久化一致，不抛错。
- 单测用 fake window（对齐 thinking-expansion-preference.test.mjs 的 installWindow 模式）。

## Comments

### 2026-09-16 已实现（工作树，未提交）

新增 `pi-web/src/lib/process-group-expansion.ts`（sessionStorage `pi-process-groups:<sessionId>`，展开锚点 id 数组，FIFO 封顶 200，读写 best-effort）。`ProcessDetailsGroup` 增加 `persistence?: { sessionId; anchorId }`：初值 `isProcessGroupExpanded(...) ?? defaultExpanded`，toggle 写回；`reveal` 仅内存态。调用点在 `session?.id` 存在时以 `entryIds[userIdx]` 为锚点传入。新增 `process-group-expansion.test.mjs`（7 用例，fake window 模式）。
