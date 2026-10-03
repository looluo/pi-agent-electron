# Issue 02: port models/settings + chat singles (B3 + B2)

Type: task
Status: resolved

- 8800b5a fix(models): say why a model switch cannot move in visible text
  （其 docs/adr/0004 hunk 是上游自己 ADR 编号撞车 → 该 hunk n/a）
- 3eb8a9d feat(settings): choose global or project in one place in every add pane
  （依赖 B1#3 的 McpAddServer 状态机；settings-ui-helpers 197a3e5 已在）
- cfcf2a1 fix(chat): drop the light theme's own border inside code blocks

i18n 三语齐更。依赖 issue 01 完成。

## Answer

Resolved with the v0.10.0 sync; see docs/upstream-sync.md v0.10.0 section.
