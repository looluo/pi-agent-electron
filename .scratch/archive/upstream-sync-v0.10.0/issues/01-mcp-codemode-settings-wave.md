# Issue 01: port the MCP / Code mode Settings wave (B1, 13 commits)

Type: task
Status: resolved

Upstream `5d4c0b5..e77a4e5`-前的 13 个提交，严格按上游顺序移植（hunk 相邻，倒序必冲突）：
de91212 → c8fc3c0 → b183176 → 6c599e9（tools/settings 扩展 budget → `pi:tools:settings:put`）
→ 834b6b8 → d702bc6（exposure 可选 → `pi:mcp:*` 写 channel 扩展）→ dba11f4 → 0b2d4fa
→ 4e1edd8 → 9d5b077 → 7b3df71 → e851b03 → 82e5539（注意 file:// 字体栈守卫：
port 后 grep font-noto-mono 应为 0）。

i18n 三语随每个提交齐更（registry parity 测试强制）。census：`.scratch/upstream-sync-v0.10.0/commit-census.md` §B1。

## Answer

Resolved with the v0.10.0 sync; see docs/upstream-sync.md v0.10.0 section.
