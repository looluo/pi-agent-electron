# Upstream sync v0.10.0 → v0.11.0 map

Upstream `agegr/pi-web` 6fcd7d4..c9e1513（44 non-merge commits）。版本目标：
app 0.10.0 → 0.11.0，pi SDK 1.0.0 → 1.1.0。

## Waves（按上游 parentage）

- W1 独立修复批（6f2b4f0…012e805，~23 commits：subagents/chat/markdown/models/fonts）
- W2 sidebar 重设计集群（2e87ddb…76bdc57，15 commits，~19k 行）
- W3 SDK 1.1.0（86dea26）+ 收尾（f722a5d/0f30627/2f6a0a9）

## 已确认 n/a

- 99b2c3f docs(agents)、2e76e9a e2e、37d4045 sw.js、cf3ebfb bin/preview-secrets（无 HTTP 面）
- 1e294b0 next 16.3.8（我们是 Vite）；mermaid 11.17.2 共享，随 W3 顺带
- c9e1513 Release（本地版本独立对齐 0.11.0）

## Divergence 基线（vs upstream@6fcd7d4）

- SessionSidebar 263 行（多为 fetch→window.pi 传输适配）、ChatInput 149、FileExplorer 173、
  ChatWindow 180、globals.css 307、AppShell 626（PR #548 文件面板——最高危）
- useAgentSession 569（PR #45 auto-title）
- ModelSelector/SettingsUi/workspace-memory 零分歧

## 终局（2026-10-09）

- W1/W2/W3 全部落地（44 源码提交 + 70470ca/a0c00f3 两笔历史回填），ledger 见
  docs/upstream-sync.md v0.11.0 节。
- 新 IPC 面：pi:sessions:ui-state:get/:post、pi:open-in-explorer:get/:post、
  pi:sessions:fork；pi:mcp:action 增 set-in-project；pi:agent:running 增
  sessionUiStateRevision；pifile://…?type=list 增 &hidden=1。
- 验证：typecheck 双绿；npm test 2144/2128/0（15 skip + 1 已知 Defender 偶发）；
  package:dir + packaged-probe 10/10。
