# Upstream sync v0.12.1 → v0.12.2 map

Upstream `agegr/pi-web` f83b1a5..b017cd4（37 non-merge commits）。版本目标：
app 0.12.1 → 0.12.2；pi SDK 不动（1.2.0）。

## Waves

- W1 主题系统大扩容（d749fad 多主题 swatch、e070e0b 暗色平滑/滚动渐隐、520ce8d 终端明暗随主题）
- W2 chat 信息密度（653cd7c cache/cost 通知、49fa89c 回合耗时、56f71d9 折叠摘要精简）
- W3 agent switcher（972b02d 时间/token/成本、4b529b4 面板 tab 切换）
- W4 subagent worktree 生命周期（d92eb83 告知 worktree 去向、341ada5 拒绝恢复已删目录、c5555cd settled id、0368401 input_files 预算）
- W5 sessions/files perf 与修复（1a94341 尾部扫描、8f3a71e 签名省略、898eb5a 更多高亮、bf0730c 面板 tab 溢出、ac54e01 git diff 归属、5ec5a74 拖放子目录）
- W6 models/transport（eb135e5 deferred default、0e78bbe 上下文窗口编辑、8b9a084 CONNECT 2s 窗、4c0077b proxyTunnel）
- W7 杂项修复 + 8c61022 测试 harness（jiti import 形态守卫——正好上游也踩了我们的 Windows jiti 坑 #1211）

## n/a

- 5e286a9 项目开新标签页（单窗口形态，与 d9adb38 同族）
- 6835326 遗留：TerminalExtraKeys 仍 n/a（Termux 按键；TerminalPanel 剥离之，保留 useTerminalTheme）
- app/ 路由全部 re-home（skills/content +document、upload-check 按目录、models-config draft）

## Divergence 处理（28 hunks / 17 文件，全波文件级 3-way）

- 传输类保 ours + 吸收 theirs 新语义：SkillsConfig（+document 参数进 IPC 三层）、
  FileExplorer（upload-check 目标从 cwd → drop 的 directory）、ModelsConfig（draft + normalizeContextWindowOverrides）
- ChatWindow ProcessDetailsGroup = theirs 新签名（durationMs/cacheMisses/messageKeys/notice-only 不折叠）
  **+ 我们的 persistence 合并**（initializer/toggle/调用点 anchorId）
- TerminalPanel：取 theirs 主题接线，剥离 Termux extra-keys 机器（state/handlers/write modifier）
- theme.test：ours 的 index.html boot-script 同步测试升级为**全文比对** THEME_INIT_SCRIPT
  （旧断言硬编码两主题写法，主题扩到 14 个后失效）；index.html 内嵌脚本同步重生成
- SessionSidebar.tabs.test：上游 #1211 的规范化单键 alias 取代我们的六形态 hack
- TabBar.layout.test（fork 自有）：布局契约更新为 bf0730c 的内联 stretch 形态
- 漏网补齐：extension-ui-queue.retainExtensionUiRequests（census 漏收）

## Windows 适配

- skills-service.integration ×3 win32 skip：DefaultResourceLoader 在 win32 仍并真实用户
  skills 树（HOME/USERPROFILE/PI_CODING_AGENT_DIR 三管齐下不够；上游 CI 是 HOME 隔离的 linux）
- test-imports 守卫扫描根去掉 app/
- 上游 #1211 顺带证明 ChatInput.test 的 Windows jiti 注释（我们早有同款适配）

## 终局（2026-10-16）

- 37 提交全部裁决：33 ported + 3 n/a + 1 release（本地 0.12.2 对齐）
- 验证：typecheck 双绿；npm test 2233 = 2203/0/30（27 原有 skip + 3 win32 skills）；
  e2e 9 pass / 3 预存红（2de8638 三件，与本波无关）/ 1 skip
