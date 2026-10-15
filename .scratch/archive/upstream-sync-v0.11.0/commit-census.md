# Upstream commit census — v0.10.0 → v0.11.0 (`6fcd7d4..pi-web-upstream/main`)

Range: `git log --no-merges 6fcd7d4..pi-web-upstream/main` = **47 commits** (upstream HEAD `c9e1513` Release v0.11.0).
Note: the brief said 44; actual count is 47 — the difference is exactly the 3 non-source commits (e2e-only `2e76e9a`, docs-only `99b2c3f`, release `c9e1513`).

Class legend: **port-mech** = pure renderer/shared-lib port (`git show … -- components hooks lib app/*.css` → `apply --3way --directory=pi-web/src`); **port-ipc** = touches `app/api/**` and needs re-homing into `electron/main/services/` + `window.pi.*`; **sdk** = pi SDK upgrade; **n/a** = web/PWA/Next.js/CI/docs-only.

## §A 总览表 (parentage order = `git log --reverse --no-merges`)

| sha | 主题 | 分类 | 文件面摘要 | 3-way 风险（本仓分歧文件） |
|---|---|---|---|---|
| `6f2b4f0` | subagents: 拒绝不支持的 resume option 覆盖 | port-mech | `lib/subagent-extension.ts` +15, 集成测试, docs | 无（纯共享 lib） |
| `038057f` | write() 工具内容渲染为可读文件文本 | port-mech | `MessageView.tsx` +16, 测试 | 无 |
| `1333c80` | 状态栏显示 extension command 按钮 | port-mech | `ExtensionStatusBar.tsx`/`ExtensionWidgets.tsx` 大改, `ChatWindow.tsx` +7, **globals.css** +80 | globals.css(13 次触碰), ChatWindow(6) |
| `981e270` | extension 对话框/自定义面板可加宽 | port-mech | `lib/extension-dialog-fit.ts`(新), `ChatWindow.tsx` +83, i18n×3; demo/** 跳过 | ChatWindow; i18n 策展子集 +2 keys |
| `99b2c3f` | docs: extensions 行为须与 pi CLI 一致 | n/a | AGENTS.md 1 行 | — |
| `80cd55e` | SMIL spinner → CSS 动画 | port-mech | globals.css +20, **SessionSidebar.tsx** 52 行换 | **SessionSidebar**(本地分歧 204 行)；建议折进 2e87ddb 或跳过（旧 sidebar 将被重写） |
| `1ddaf11` | 保留失败上传 + git diff 目标授权 | **port-ipc** | `app/api/files/[...path]`（replace 语义 → `replaceUploadFile`）, `app/api/git/diff`（`isDiffPathAllowed` 防 junction 越权）, `lib/file-upload.ts` +24 | lib 为共享层可直接 apply；服务侧改 `services/files-upload.ts` + `files.ts:gitDiff` |
| `7aaeff9` | models-only provider 保留 catalog API protocol | port-mech | `ModelsConfig.tsx` −7（去掉 api 默认值 effect）, e2e/docs | 无 |
| `5d5a69e` | subagents: profiles 预载命名 skills | **port-ipc**(轻) | `lib/subagents`+`subagent-runtime`+`subagent-skills`(新)+`rpc-manager`, profiles route **+1 行**（PATCH 响应带 `skills`）, `AgentsConfig.tsx`, i18n×3 | rpc-manager(4 次触碰, 本地已对齐到 28bab3c); 服务侧 `pi:subagents:profiles:*` 响应体 +skills |
| `17bbadb` | subagents: 只加载 profile `extensions:` 点名的扩展 | port-mech | `lib/subagents.ts` +94, `rpc-manager`, `subagent-runtime/skills`, `AgentsConfig.tsx`, i18n×3 | rpc-manager |
| `81e5b03` | markdown: 长表格单元格换行不挤压宽表 | port-mech | globals.css **1 行** + e2e | globals.css（最小 hunk） |
| `496611c` | subagents: turn limits/terminal 结果留在 SDK 边界 | port-mech | `lib/subagent-runtime.ts` +103, 集成测试, docs | 无（共享 lib；electron subagents 服务间接受益） |
| `e2ea7da` | markdown: 主题切换保留代码背景色 | port-mech | `MermaidBlock.tsx` +17, demo 同步(跳过), e2e | 无 |
| `9182fdf` | chat: model 调用间刷新 context usage | port-mech | **`hooks/useAgentSession.ts`** +58, 新 `hooks/context-usage.test.mjs` | **useAgentSession（高危, 本地分歧 449 行）**; hunk 内 `fetch('/api/agent/:id')` → `window.pi.agentState`(pi:agent:state) |
| `fdeea87` | shell: 移动端 resize 后恢复桌面 sidebar 状态 | port-mech | `AppShell.tsx` +10, 新测试 | **AppShell（高危, 本地分歧 492 行）** |
| `2e76e9a` | test(e2e): 等 desktop sidebar 稳定 | n/a | e2e/run.mjs 4 行 | — |
| `c3c5c6f` | chat: 拖文件到聊天上传并 @mention | port-mech† | `lib/file-upload-client.ts`(新, 98 行, `fetch /api/files?type=upload` → **`window.pi.filesUpload` 重写**), `ChatWindow.tsx` +49, `FileExplorer.tsx` −51, `useDragDrop.ts`, **useAgentSession** +1, i18n×3 | useAgentSession(1 行), ChatWindow; †transport 重写但无 route 变更 |
| `a136267` | models: 列出 extension 在 session_start 注册的 provider | **port-ipc** | `app/api/models{,/default,/enabled}` 三处小改 + `lib/deferred-provider-models.ts`(新 66) + `rpc-manager` +30 + `model-runtime` | rpc-manager; 服务侧: models/models-config/models-enabled 服务函数包 `withDeferredProviderModels`/`rememberProviderModels` |
| `6d4d6b5` | markdown: CJK 标点旁 emphasis | port-mech | `lib/markdown.ts` +3, **新依赖 `remark-cjk-friendly@^2.3.2`** | 无（记得 npm i） |
| `37d4045` | SW: 静态响应不阻塞在 cache 写 | n/a | `public/sw.js` + 测试 — 本仓无 service worker | — |
| `a096af3` | sessions: 删除已离开的 session 不强制跳空聊天 | port-mech | `AppShell.tsx` +15, 新测试 | **AppShell（高危）** |
| `cf3ebfb` | security: 启动轮换 preview-mode secrets | n/a | `bin/pi-web.js` + `bin/rotate-preview-secrets.js` — Next.js preview 代理/npm tarball 专属；本仓无 HTTP 面/代理, 已确认无 electron 等价物 | — |
| `86d94e2` | settings: 自定义字体族与字重 | port-mech | 23 文件: `FontSettings.tsx`/`useFontPreferences.ts`/`lib/font-preferences.ts`(全新, localStorage+CSS 变量, **无需 electron 字体枚举**), settings.css +63, `SettingsPanel` 重排, `TerminalPanel`, `ChatInput` +4, `AppShell` +3, `MessageView/MermaidBlock/FileViewer` 各 3, globals.css, i18n 16 keys×3 | **ChatInput**(分歧 114 行), SettingsPanel, AppShell, settings.css |
| `012e805` | chat: 文件 mention 可撤销 | port-mech | **`ChatInput.tsx`** ±92 重构, 测试 | **ChatInput（高危, 本地分歧 114 行）** |
| `2e87ddb` | **sidebar 重设计**: 项目分组/置顶/归档 + Sessions\|Files 分栏 | **port-ipc** + 巨型 renderer | 51 文件 ≈+9172/−1365: api 三处(`agent/running` +`sessionUiStateRevision`、`sessions/[id]` DELETE +`forgetSessionUiState`、**新 `sessions/ui-state` route GET/POST** 60 行); `SessionSidebar.tsx` 重写(±2421), 新 `SessionTree/SidebarMenu/SidebarToast/SidebarIcons`, 新 `app/sidebar.css`(1145)/`sidebar-menu.css`(492), 新 `useSessionUiState`/`lib/session-ui-state{,-shared}`/`sidebar-actions`/`sidebar-prefs`, `lib/session-tree.ts` 重写(+533), AppShell.handleNewSession, i18n 47 keys×3 | **SessionSidebar（本地 PR#548 面板化+记忆 cwd 分歧将被整体覆盖 — 本轮同步最大决策点）**, AppShell, globals.css, i18n 大批量 |
| `fb34df9` | sidebar: show-more 按 20 分页 + 行样式 | port-mech | `SessionTree.tsx` +149, `session-tree.ts` +94, sidebar.css, i18n | 低（新文件链） |
| `7b25fe3` | sidebar: 13px 标题, 颜色代字重 | port-mech | sidebar.css 12 行, 测试 | 低 |
| `9da54e1` | file-viewer: 主题切换保留源码背景 | port-mech | `FileViewer.tsx` +17 | 无 |
| `bb51aca` | chat: 新会话 composer 上方选 project/worktree | port-mech | 34 文件: AppShell +104(含 workspace-memory 测试), **useAgentSession +43**, 新 `NewSessionContextBar.tsx`(261)/`WorktreeCreateForm.tsx`, `lib/new-session-context.ts`(新), SessionSidebar/Tree 调整, sidebar-actions −76, model-loading, i18n×3 | **AppShell + useAgentSession（双高危）** |
| `085fba9` | sidebar: 行菜单 fork 会话 | **port-ipc** | **新 `app/api/sessions/[id]/fork` route(82 行)** + `lib/session-fork.ts`(新 72)/`session-reader` +13, SessionSidebar +129, SessionTree +90, SidebarIcons, AppShell +9, i18n×3 | SessionSidebar, AppShell; 新 IPC `pi:sessions:fork` |
| `02ded7e` | sidebar: 项目顺序固定 + 手动排序 | **port-ipc** | `ui-state` route +7（`projectOrder`）, 新 `hooks/useGroupDrag.ts`(492), `session-tree.ts` +163, `session-ui-state{,-shared}` +261, SessionTree/SessionSidebar, sidebar.css, i18n×3 | SessionSidebar; 扩展 ui-state channel 字段 |
| `497ac65` | style: 新会话 bar 对齐 composer 控件 | port-mech | globals.css +45, `NewSessionContextBar.tsx` | globals.css |
| `1aef2f6` | sidebar: fork 以源会话名+随机后缀命名 | **port-ipc** | fork route +16, 新 `lib/session-fork-name.ts`, `session-fork.ts` +53, SessionSidebar/Tree, SidebarToast, sidebar css×2, i18n | SessionSidebar; 扩展 `pi:sessions:fork`（服务端命名） |
| `ce5c08c` | sidebar: 拖拽 ghost 避开 drop line | port-mech | `useGroupDrag.ts`, `session-tree.ts` +59, SessionTree, sidebar.css | 低 |
| `7989bc2` | refactor: Files tab 与新会话 bar 共用一个 project/worktree picker | port-mech | 新 `ProjectWorktreePicker.tsx`(481), **SessionSidebar −823**, SidebarMenu +224, NewSessionContextBar −236, globals/sidebar css, AppShell +4, i18n×3 | SessionSidebar 大改（链内） |
| `12cf745` | chat: 新会话 project bar 放到品牌行 | port-mech | `ChatWindow.tsx` +76, globals.css +95, NewSessionContextBar | ChatWindow, globals.css |
| `4f883eb` | sidebar: files tab 按钮收纳进 project 卡片 | port-mech | SessionSidebar ±163, sidebar.css, FileExplorer +4, i18n×3 | SessionSidebar |
| `8e6b7d3` | sidebar: 头部搜索按钮搜文件 | port-mech | SessionSidebar ±30, FileExplorer +1, sidebar.css | SessionSidebar |
| `4b018a6` | style: files tab 卡片扁平化 | port-mech | sidebar.css ±85, globals.css, SessionSidebar | SessionSidebar, globals.css |
| `5042bec` | sidebar: 单 toolbar 行（sidebar + 主区 project/worktree 盒） | port-mech | globals.css ±198, sidebar.css ±243, sidebar-menu.css +173, **SessionSidebar ±305**, SidebarMenu/ProjectWorktreePicker/NewSessionContextBar/WorktreeCreateForm, i18n×3 | SessionSidebar, 三份 css |
| `76bdc57` | chore(css): 删掉未用的 unread ping | port-mech | globals.css −20 | globals.css（末尾清理, 冲突面小） |
| `86dea26` | **pi 1.1.0** | **sdk** | 50 文件: package(-lock) pi-* 1.0.0→1.1.0（shrinkwrap 取消, 单副本共享）; MCP 项目级 override（`app/api/mcp/route.ts` +58 `set-in-project` → **需 re-home 到 `pi:mcp:action`**）, sign-in signal, paste importer cimd, `agent_settled.aborted`, 工具卡 durationMs（MessageView）, azure 图标, `ProjectTrustDialog`, **useAgentSession** +19, ChatWindow +11, AppShell +6, **rpc-manager** +22, api-types, settings.css +13, i18n 15 keys×3 | useAgentSession, ChatWindow, AppShell, rpc-manager; 服务侧 mcp.ts + ipc-mcp.ts |
| `f722a5d` | settings: general 页全宽滚动 | port-mech | settings.css 9 行 | settings.css |
| `0f30627` | style: 去掉 general 页重复标题 | port-mech | settings.css −9, `SettingsPanel.tsx` −2 | SettingsPanel |
| `2f6a0a9` | files: explorer 显示 Git-ignored 文件（暗淡+原因） | **port-ipc** | `app/api/files/[...path]` list 分支（`hidden=1` 返回 ignored/excluded 原因）→ 本仓对应 `services/files.ts:handleFilesGet`（`pifile://local?type=list&hidden=1`, renderer 端 query 参数形态兼容）; `lib/file-tree-visibility.ts` +32, FileExplorer +66, SessionSidebar +26, `sidebar-prefs.ts` +30, SidebarIcons, sidebar.css, i18n×3 | SessionSidebar; files 服务 list 分支 |
| `1e294b0` | next 16.3.8 + npm audit fix | n/a* | package(-lock) — next 本仓不适用；*audit 部分**共享依赖**: mermaid→11.17.2, js-yaml, dompurify, sharp, brace-expansion（本仓 package.json 有 mermaid ^11.16.1 / js-yaml ^5.2.3）→ 可选跟进 audit | — |
| `c9e1513` | Release v0.11.0 | n/a | version bump | — |

† = 无 route 变更但含 `fetch('/api/…')` → `window.pi.*` transport 重写（ledger 机制内）。

## §B 集群分组与移植顺序建议

按主题分组；组内顺序 = 上游 parentage（`git log --reverse`），**除注明外不要乱序**（sidebar 链尤其严格）。

### 1. subagents 集群（独立, 建议最先）
`6f2b4f0` → `5d5a69e` → `17bbadb` → `496611c`
- 全部落在共享 `lib/`（electron 服务与 renderer 共用同一份 `pi-web/src/lib`），apply 即两端生效。
- 唯一 IPC 面：`5d5a69e` 在 profiles PATCH 响应 +1 字段（`skills`）→ `services/subagents.ts` 对应通道响应体补字段。
- `496611c` 是 SDK 边界修复，与 `86dea26` 的 rpc-manager 改动无重叠文件冲突（不同函数区），但建议仍按 parentage。

### 2. chat-fixes 集群（独立）
`038057f` → `1333c80` → `981e270` → `9182fdf` → `fdeea87` → `a096af3` → `c3c5c6f` → `012e805`
- 高危点集中在 `useAgentSession.ts`（9182fdf, c3c5c6f）、`AppShell.tsx`（fdeea87, a096af3）、`ChatInput.tsx`（012e805）——本地分歧 449/492/114 行，逐 hunk 审。
- `c3c5c6f` 的新 `lib/file-upload-client.ts` 必须重写为 `window.pi.filesUpload/filesUploadCheck`（本仓 FileExplorer 已走该通道，直接复用形态）。
- `9182fdf` 的 `fetch('/api/agent/:id')` → `window.pi.agentState`。

### 3. markdown / theme-fixes 集群（独立, 最轻）
`81e5b03` → `e2ea7da` → `6d4d6b5` → `9da54e1`
- `6d4d6b5` 需新增依赖 `remark-cjk-friendly@^2.3.2`（纯 renderer remark 插件，无 native）。
- demo/** 与 e2e/** 跳过（无 demo 目录）。

### 4. models 集群
`7aaeff9` → `a136267`
- `7aaeff9` 纯 renderer（ModelsConfig 去掉 api 默认值回填）。
- `a136267` 是 port-ipc：新共享 lib `deferred-provider-models` 直接 apply；三处 route 改动映射到 `services/models*`（`pi:models`、`pi:models-config:*`、`pi:models:enabled:*` 的服务函数包裹 `withDeferredProviderModels` / 列表前 `rememberProviderModels`）。

### 5. upload / git 安全修复
`1ddaf11`（独立, 建议尽早 — 安全修复）
- lib 层直接 apply；`replaceUploadFile` 的调用点在 `services/files-upload.ts`；`isDiffPathAllowed` 移植进 `services/files.ts` 的 `gitDiff`（防 junction 越权读文件）。

### 6. settings / fonts 集群
`86d94e2`（主体） … 收尾 `f722a5d` + `0f30627` 放到 sdk 之后（parentage 如此, 且 settings.css 依赖 86dea26 的 +13 行邻域）
- 字体偏好全走 localStorage + CSS custom properties，**不需要 electron 侧字体枚举/新 IPC**。
- 触 ChatInput(4 行)/SettingsPanel/AppShell/settings.css + i18n 16 keys×3（策展子集要补 key）。

### 7. sidebar 巨型集群（本轮主战役, 严格按链序原子推进）
`80cd55e`（建议折进 2e87ddb 或仅取 globals.css hunk — 旧 SessionSidebar 马上被重写, 单独 3-way 到本地分歧 204 行的旧文件是浪费）
→ `2e87ddb`（锚点：先落 IPC 三件 + 新文件骨架, SessionSidebar 本地分歧整体让位）
→ `fb34df9` → `7b25fe3` → `bb51aca` → `085fba9` → `02ded7e` → `497ac65` → `1aef2f6` → `ce5c08c` → `7989bc2` → `12cf745` → `4f883eb` → `8e6b7d3` → `4b018a6` → `5042bec` → `76bdc57`
- 链内后 16 个提交基本只碰 `2e87ddb` 引入的新文件（SessionTree/SidebarMenu/sidebar.css/…），链锚落稳后风险骤降。
- 本地 SessionSidebar 的 PR#548 面板化改造 + 记忆 cwd 分歧需要在 `2e87ddb` 落地时**显式决策**：上游新结构（行菜单含 pin/rename/archive/fork）大概率覆盖了同等能力；保留的本地特性（记忆 cwd 已由上游 a5630c1 系列承接）逐条核对后放弃旧分歧。
- `bb51aca` 与 `085fba9` 再次碰 AppShell/useAgentSession（高危文件第二轮）。

### 8. sdk
`86dea26` — parentage 在 sidebar 链之后。两个可选位置：
- **A（推荐, 贴 parentage）**: sidebar 链完成后、settings 收尾前。冲突面：MessageView/ChatWindow/AppShell/useAgentSession/rpc-manager 均已在前面提交中更新到 v0.11.0 形态, hunk 上下文吻合。
- B（提前做）: 若想先拿到 SDK 升级的独立验证窗口, 可在任何集群前做, 但要对后续所有 renderer 提交接受轻微上下文漂移（api-types/MessageView durationMs 等）。
- 内嵌一个 port-ipc 子任务：`app/api/mcp/route.ts` 的 `set-in-project`（项目级 MCP override, pi 1.0.1 特性）→ `services/mcp.ts` + `ipc-mcp.ts` 扩展 `pi:mcp:action`。

### 9. n/a（不移植, ledger 记录）
`99b2c3f`（docs）、`2e76e9a`（e2e）、`37d4045`（SW）、`cf3ebfb`（Next preview 代理, 已确认无 electron 等价物）、`1e294b0`（next bump；audit 共享依赖 mermaid/js-yaml 可选跟进）、`c9e1513`（release version）。

**全局建议顺序**: 1 subagents → 3 markdown → 5 upload/git（安全） → 4 models → 2 chat-fixes → 6 fonts(86d94e2) → 7 sidebar 链 → 8 sdk → 6 收尾(f722a5d/0f30627) → 2f6a0a9（files, 骑在新 sidebar files-tab 上, 必须最后）。

## §C 高风险文件清单（本轮被碰次数）

`git log --oneline 6fcd7d4..pi-web-upstream/main -- <path>` 计数, 括号内为本地相对 6fcd7d4 的分歧行数（diff `<>` 行合计）:

| 上游路径 | 本仓路径 | 触碰次数 | 本地分歧 |
|---|---|---|---|
| `app/globals.css` | `pi-web/src/globals.css` | **13** | 275 行 |
| `components/SessionSidebar.tsx` | 同名 | **13** | 204 行（PR#548 面板化+记忆 cwd） |
| `app/sidebar.css`（2e87ddb 新建） | 待建 | 13（建成后 12 次追加） | 新文件 |
| `app/sidebar-menu.css`（新建） | 待建 | 4 | 新文件 |
| `app/settings.css` | `pi-web/src/settings.css` | 4 | — |
| `components/AppShell.tsx` | 同名 | **9** | 492 行 |
| `components/SessionTree.tsx`（新建） | 待建 | 9 | 新文件 |
| `components/ChatWindow.tsx` | 同名 | 6 | ~15 行 |
| `hooks/useAgentSession.ts` | 同名 | **4**（9182fdf/c3c5c6f/bb51aca/86dea26） | 449 行 |
| `components/ChatInput.tsx` | 同名 | 2（86d94e2/012e805） | 114 行 |
| `components/FileExplorer.tsx` | 同名 | 4 | ~18 行 |
| `components/SettingsPanel.tsx` | 同名 | 2 | — |
| `lib/session-tree.ts` | 同名 | 5（含 2e87ddb 重写 +533） | — |
| `lib/rpc-manager.ts` | 同名（共享, main 直接 import） | 4（5d5a69e/17bbadb/a136267/86dea26） | ~34 行 |
| `lib/subagents.ts` / `lib/subagent-runtime.ts` | 同名 | 2 / 3 | 0（已对齐） |
| `lib/markdown.ts` | 同名 | 1 | 33 行 |

i18n: **15 个提交**触碰 `lib/i18n/messages/{en,zh-CN,zh-TW}.ts`（keys: 2e87ddb +47、86d94e2 +16、86dea26 +15, 其余 1–7）。本仓为策展子集——每个带 locale 的移植需按已采纳 key 手工合并三语言。

## §D IPC 新面预估

新 channel（2 个）:
1. **`pi:sessions:ui-state:get` / `:post`**（`2e87ddb` 新建, `02ded7e` 扩 `projectOrder` 字段）— 服务建议落 `services/sessions.ts` 或新 `services/session-ui-state.ts`；状态文件 `<agentDir>/pi-web-session-state.json`（共享 lib `session-ui-state{,-shared}` 直接 apply 即可复用锁/revision/原子写）。
2. **`pi:sessions:fork`**（`085fba9` 新建, `1aef2f6` 扩命名）— 包 `lib/session-fork.ts` + rpc-manager 叶子解析 + `session-reader` 缓存失效；纯文件级操作，不触碰 AgentSession。

扩展现有 channel（7 处）:
3. `pi:agent:running` 响应 + `sessionUiStateRevision`（`2e87ddb`）— `services/agent.ts:agentRunningIds`（sidebar 各窗口据此 refetch）。
4. `pi:sessions:delete` + `forgetSessionUiState`（`2e87ddb`）— `services/sessions.ts:sessionsDelete` 尾部 best-effort。
5. `pi:files:upload` 冲突 replace 走 `replaceUploadFile`（`1ddaf11`）— `services/files-upload.ts` 调用点换函数；失败上传不再半删。
6. `pi:git:diff` 目标路径授权 `isDiffPathAllowed`（`1ddaf11`）— `services/files.ts:gitDiff`（防 junction 越权）。
7. `pi:models` / `pi:models-config:*` / `pi:models:enabled:*` 包 `deferred-provider-models`（`a136267`）— models 系服务函数。
8. `pi:subagents:profiles:*` 响应 + `skills` 字段（`5d5a69e`）。
9. `pi:mcp:action` + `set-in-project`（项目级 override, pi 1.0.1）（`86dea26`）— `services/mcp.ts` + `ipc-mcp.ts`; 另 sign-in 流程传 AbortSignal（`pi:mcp:sign-in:*` 语义微调）。
10. `pifile://local/…?type=list` 支持 `hidden=1` 返回 ignored/excluded 原因（`2f6a0a9`）— `services/files.ts:handleFilesGet` list 分支（非 ipcMain channel, 走 files-protocol, 形态同构）。

无需新 IPC 的确认项: `86d94e2` 字体偏好（localStorage, 无字体枚举）；`cf3ebfb` 无等价物; `9182fdf` 复用现有 `pi:agent:state`。
