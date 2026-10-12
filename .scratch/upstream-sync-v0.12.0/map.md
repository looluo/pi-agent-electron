# Upstream sync v0.11.0 → v0.12.0 map

Upstream `agegr/pi-web` c9e1513..894e1a2（68 non-merge commits，含中间 v0.11.1）。
版本目标：app 0.11.0 → 0.12.0；pi SDK 不动（双方都停在 1.1.0）。

## Waves（按依赖排）

- **W1** transport：650d7a3（httpIdleTimeoutMs → 我们 main 的无参 configureHttpDispatcher 正是此 bug）
- **W2** chat 独立修复批（13 提交：compaction/notice/minimap/desktop-links/display:false…）
- **W3** files/models/skills/audio（f87afbb CSV 表、93b3aba HTML 分块、Kimi 配额、audio 生命周期…）
- **W4** sessions/sidebar 逻辑（外部会话发现、gone-session 链接、delete-all、awaiting-input、切会话状态修复…）
- **W5** subagents 面板集群（311a901 SubagentViewer 右侧 tab + profile/mcp/codemode/thinking 后续 7 提交）
- **W6** perf 集群（0699107 turn-views、b73fdeb、a952ed5 markdown-blocks、b2b6a45 highlight-queue、046bc67 prism 按需、e8d91ef useStreamingSelector）
- **W7** sidebar 视觉重排（v0.11.1 批 7 提交：files-below-sessions、28px rows、fold 动效、brand 行）
- **W8** i18n 三语合并（×20 提交的增量键）+ 版本 0.12.0 + ledger + 门禁

## 已确认 n/a（ADR-0003 形态/基础设施）

- f98c088 CLI commands、5abdee3 CLI 退出、6425d0d server SDK 预载（electron main 天然急切加载）、30af3b4 release 文档
- 2adb185 PWA 安装名、d9adb38 新标签页打开（单窗口形态；lib/session-links.ts 仅在标签 UI 用则不带）
- 6835326 + 3ff7e1d Termux/竖屏触屏按键（桌面带物理键盘）
- a952ed5 的 web-push/SSE 半边（无 HTTP 面）；renderer 半边随 W6
- 6742182 Tailwind 扫描：我们的构建无 tailwind.config（vite+postcss），globals.css 行随 W7 顺带评估
- e783721 / 894e1a2 Release：本地版本独立对齐 0.12.0

## Divergence 基线（vs upstream@c9e1513，--ignore-cr-at-eol）

- 高危（>100 行）：AppShell 490、useAgentSession 427、useAgentSession.test 276、rpc-manager.test 254、
  ModelsConfig 202、ChatInput.test 163、rpc-manager 158、rpc-manager-shutdown.test 139、ChatInput 114
- 中危（60-107）：TerminalPanel 109、subagents.test 107、AgentsConfig 102、subagents.ts 96、
  SessionSidebar 90、ModelsConfig.test 87、ChatWindow 83、SkillsConfig 79、MessageView 76
- **零分歧 78 文件 → 整取**；1-59 行 58 文件（多为测试，随宿主文件走）
- 新增 lib/hook/component 21 文件（本波新建，整取+测试）：turn-views、session-links、session-delete、
  prism-languages、highlight-queue、markdown-blocks、delimited-table、notice-text、minimap-preview-lock、
  stream-token-rate、file-tree-expansion、useStreamingSelector、useSidebarMotion、useFilesPlacement、
  SubagentViewer(+state)、PiWebTitle、TerminalExtraKeys[n/a]、DelimitedTable、web-push[n/a]、
  terminal-extra-keys[n/a]、session-membership(test)

## 终局（2026-10-12）

- 全波一次性落地：68 提交中 **54 源码 ported**（文件级 3-way：base=c9e1513 / ours / theirs=894e1a2，
  78 零分歧文件整取 + 110 干净合并 + 50 文件手工解冲突 + 53 新文件整取 + i18n 三语 union+共享键值对齐上游）
  + 12 n/a + 2 release（本地 0.12.0）。
- PR #548 文件面板停车被上游正式化（d69b33e file-tab-state 工作区停车）→ 采纳上游版，
  我们手工 switchProjectFileTabs 退役；file-tabs-park 测试删除（被 file-tab-state.test 13 项取代）。
- 早前 sync 遗留补齐：mcpToolLabel 用法（v0.10 只进了 import）、models-config-helpers
  renameProviderEntry（50 行）、lib/__fixtures__/mcp-*.mjs（6695979）。
- 传输重定home：650d7a3（httpIdleTimeoutMs → electron main）、new-session-switch 测试
  fetch/SSE stub → window.pi 桥 stub、session-membership → sessionsList 服务。
- Windows 适配：PI_CODING_AGENT_DIR 奇偶性测试比 outcome；jiti 动态 import pathToFileURL；
  useI18n 无 .tsx 后缀；app/*.css 路径重映射；PiWebTitle/package.json 相对路径；
  files-placement alias 六形态（反斜杠/.ts/正斜杠/file-url）。
- 已知问题：subagent-mcp.integration 11 项 win32 skip（node:test runner 下测试体后挂起，
  功能已用同 setup 裸脚本验证绿——见 ledger）；e2e thinking/bash-output/markdown-image
  3 项预存红（2de8638 时代的 mac CDP 探针镜像，Windows 上 fixture 会话不可见，非本波回归）。
- 验证：typecheck 双绿；npm test 2096 = 2069 pass / 0 fail / 27 skip（16 预存 + 11 win32 mcp）；
  e2e 9 pass / 3 预存红 / 1 skip；main↔preload channel 双向 diff 空。
