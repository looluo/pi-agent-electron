# Issue 04: version 0.10.0 alignment, ledger, full verify

Type: task
Status: resolved

- 6fcd7d4 上游仅改 package.json/lock 版本号（n/a）；本地对齐：app 0.9.3 → 0.10.0，
  依赖随 issue 03。
- `docs/upstream-sync.md` 增加 v0.10.0 节（沿用 ported/n-a/deferred 词汇）。
- 全量验证：`npm test`、`npm run typecheck`、`npm run package:mac` + 打包版冒烟
  （Settings › MCP 页渲染 + Test 连接）。

## Answer

Resolved with the v0.10.0 sync; see docs/upstream-sync.md v0.10.0 section.
