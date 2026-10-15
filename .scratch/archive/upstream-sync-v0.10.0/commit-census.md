# Commit census — pi-web `v0.9.3..upstream/main` (111 commits)

生成于 v0.10.0 同步准备期（只读分析，未改任何源码）。范围：`git log v0.9.3..upstream/main`，
上游 tag `v0.9.3` = `0876cf4 Release v0.9.3`，`upstream/main` = `6fcd7d4 Release v0.10.0`。

状态词汇沿用 `docs/upstream-sync.md`：**ported** / **n/a** / **deferred**。本 census 中
「ported」分两种，在备注列区分：**已同步**（v0.9.3 轮已完成，无需动作）与**本轮待移植**。

## 0. 范围校正（重要发现）

本仓上次同步轮的实际终点不是 v0.9.3 tag，而是 **`5d4c0b5`**：

- `docs/upstream-sync.md` 的 v0.9.3 节覆盖 `040fadd..5d4c0b5`（100 个非 merge 提交），
  `.scratch/upstream-sync-v0.9.3/map.md` 显示 issues 01–09 **全部 resolved**，含
  SDK 0.99.1（issue 01）与整个 MCP 波（issue 09，`pi:mcp:*` 7 个 IPC channel）。
- 该轮从 `040fadd`（Release v0.9.2）出发，包含 v0.9.3 tag 之前的 11 个提交 + 之后的
  **90 个**提交。因此本范围的 111 个提交中 **90 个已随 v0.9.3 轮落地**，
  **真正待同步的只有最后 21 个**（`5d4c0b5..upstream/main`）。
- 证据：`pi-web/src/components/McpAddServer.tsx` 与 upstream@`5d4c0b5` 逐字节一致；
  `McpConfig.tsx` 的 exposure 只读展示（9 处）与 `d702bc6^` 的上游状态一致（该提交的
  「可选 exposure」未落地）；`pi-web/src/lib/` 已含全部 mcp-*/codemode-* 文件；
  本地版本号 0.9.3。

结论：**Part A（90 个，§A）为已同步的历史清单**（备注标注所属 issue），**Part B（21 个，§B）
是 v0.10.0 同步的全部工作量**。

## 1. `+111k` 行的分布（核实）

`git diff --numstat v0.9.3..upstream/main`：538 files, **+112,054 / −2,744**。大头核实如下：

| 区域 | 插入行 | 文件数 | 定性 |
|---|---|---|---|
| **`demo/`** | **+58,949** | 264 | GitHub Pages 静态 demo（`4857da3` 一次引入 272 个文件，含整套复制的 components/lib/mock、catppuccin 图标、`demo/package-lock.json` +9,999）→ **n/a**（ADR-0003 无 demo 形态） |
| `lib/` | +30,650 / −481 | 146 | 几乎全是 MCP 集群：mcp-import-core 1,217、mcp-host 1,086、mcp-config-read 846、mcp-import-cli 731、mcp-test 704、mcp-sign-in 691、mcp-import-json 649、mcp-secrets 523、mcp-config-file 498、mcp-import 470、pi-sdk-internals 444、codemode-settings 394、builtin-extensions 393、project-trust +407、shell-words 382；i18n 三语言各 +605；rpc-manager +394/−72 |
| `components/` | +15,201 / −1,037 | 61 | McpConfig.tsx +2,148、mcp-config-helpers +1,480、McpAddServer +656、PluginsConfig 重写 +392/−399、SettingsUi +554、McpSignIn +308、ProjectTrustDialog +375/−83、DirectoryPicker +178 |
| `app/` | +5,121 / −230 | 31 | `app/settings.css` +1,126/−104（MCP/Settings 面板样式）；`app/api/mcp/route.ts` +613；其余为 mcp/test、mcp/sign-in、project-trust、tools/settings、models/default、open-in-explorer 路由 |
| `hooks/` | +882 / −74 | — | useAgentSession +258（MCP/codemode 事件与 /mcp 命令） |
| `docs/` + `AGENTS.md` | +915 / −231 | 15 | 上游 ADR 0006（430 行）与 docs/agents 拆分 → 文档，n/a |
| 其余 | ~+320 | — | package-lock +222/−685（净缩）、package.json +13、next.config.ts +21（Safari 兼容）、.github +62（demo-pages CI） |

测试占比：`*.test.mjs` + fixtures 合计 **+23,837** 行；非 demo 非测试源码 **+28,317** 行。
即除 demo 外的真实移植面 ≈ 5.3 万行插入（其中近半是随代码落地的测试）。
（备注：v0.9.3 轮有 ~40 个上游测试文件未随移植搬入，主要是 app/api 路由测试与部分
lib/mcp-* 测试——服务端逻辑已改写为 electron services，对应测试或改写或省略。）

## 2. 特别关注：`e77a4e5` chore(deps): upgrade pi to 1.0.0 — **本轮待移植（最大单件）**

- 44 files，+850/−903（代码；不含 package-lock）。分布：lib 24、components 7、docs 6、app 4、package.*。
- 依赖版本：`@earendil-works/pi-{agent-core,ai,coding-agent,tui}` 0.99.1 → **1.0.0**。
- 语义改动（上游提交说明归纳，全部命中我们已移植的 mcp-*/codemode 面）：
  1. MCP OAuth 凭据键改为 `mcp__<name>|<url>`（旧 URL-only 记录被首个读取者接管）；
     sign-in/sign-out 流程、计数与守卫、`signOutMcpServer()`、Settings 已登录提示全部跟随。
  2. `codemode-deferred` 变为 `codemode` 的别名；codemode 描述不再列工具（脚本用
     searchTools() 找）；Settings 删掉该选项与文案，读别名条目按 `codemode` 处理，
     状态键改为校验器副本（`mcpEntryConfigKey()`）。
  3. 首 prompt 只等 `direct` 工具的服务器；codemode 脚本与 tool_search 等其余；
     host 自身的可中止等待同步调整，扩展 `startupWaitMs: 0`。
  4. `auth: { provider }` 发送 pi provider token 而非 OAuth：关闭 OAuth sign-in、Test 传
     provider token、Settings 显示 provider；路由/Settings 拒绝项目文件里的 `auth` 与
     `-`/`_` 仅差的名称。
  5. 粘贴导入器移植校验器新规则，读取 `description`、`oauth.clientName`、
     `oauth.authServerMetadataUrl`，新增 `pi mcp add --description/--oauth-client-name`；
     永不导入 `auth`。Settings › MCP 显示 `description`。
- 移植顺序含义：上游把 6c599e9 / d702bc6 / 0b2d4fa 等 B 波提交落在 0.99.1 代码上，
  e77a4e5 再适配 1.0.0。**按上游顺序先移植 B1/B3 功能提交，e77a4e5 收尾**，
  diff 才能 3-way 落位；先升 SDK 会让后续功能 hunk 全部漂移。
- 依赖映射：`lib/pi-sdk-internals.ts`（已在本仓）需 +2 行适配；`electron/main/services/mcp.ts`
  的 mcp 路由等价逻辑需同步「拒绝项目文件 auth / 名称 `-`_` 冲突」规则。

## 3. 特别关注：`6fcd7d4` Release v0.10.0 — **n/a**

- 仅 2 个文件：`package.json` + `package-lock.json` 的 version `0.9.3` → `0.10.0`。
- 我们独立版本管理（先例：v0.8.11/v0.9.0 的 Release 提交均 n/a）；本地按惯例另行把
  app 版本对齐到 0.10.0。

## 4. app/api 新路由清单（「新路由，需要新 IPC 服务」核实）

对比 `git ls-tree v0.9.3` 与 `upstream/main`，本范围新增 **6 个路由组**——全部落在
Part A（90 个已同步提交）中，**均已 re-home 完成**；Part B 不新增路由（只改既有
`app/api/mcp` 与 `app/api/tools/settings`）。

| 新路由 | 引入提交（关键） | 状态 | 本仓落点 |
|---|---|---|---|
| `app/api/mcp` | `26e409e`（读）；写路径 `00647b0`/`d702bc6` | 已同步（issue 09） | `electron/main/services/mcp.ts` + `pi:mcp:*`（7 channel） |
| `app/api/mcp/test` | `6695979` | 已同步（issue 09） | 同上，Test channel |
| `app/api/mcp/sign-in`（+ `[flowId]`） | `922a9d7` | 已同步（issue 09） | OAuth push channel |
| `app/api/models/default` | `6a1246e` | 已同步（issue 06） | models IPC（defaults 合并进 models 服务） |
| `app/api/open-in-explorer` | `a0c00f3` + `fe288c0` | 已同步（issue 05） | main 进程 shell 打开（`lib/open-in-file-manager.ts` 共享） |

---

# Part A — 已随 v0.9.3 同步轮完成（90 个提交，`v0.9.3..5d4c0b5`）

按波次分组，波内按上游时间序（= 依赖序）。issue 号见 `.scratch/upstream-sync-v0.9.3/`。

## A1 · mcp/codemode 波（38 个，issue 09 + 08）

依赖链：ADR/SDK-internals 基础（85f9cb1）→ 会话内 host（30fe218）→ 只读策略（e299ab9）
→ 展示（cc697e6/a87758e）→ 连接/trust 对齐（d733d43/d1283eb）→ 读取 API（26e409e）
→ 导入器（2ac2a0f）→ Settings 阶梯（8716e70 → 9cf9547 → 92489b7 → 00647b0 → 6695979
→ dff71a0 → 922a9d7 → eeda862 → ce615e7）→ 加固与文案（2ef137c → baaf825 → 207ce36 →
bf9decc → cea11aa → a2a31bd → d85555e → 4213e4b/eb6a4bd → 570f355 → 0dee0f0 → 5d4c0b5）。
codemode 三件套（ba044f9/9dc822e/1c387b4）可与 host 并行但在 Settings 阶梯前。

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 89bd25b | docs(adr): record how MCP and Code mode are supported (ADR 0006) | n/a | 1 | 上游 ADR 文档；设计已体现在本仓移植，本仓 ADR 体系独立（0001–0005） |
| 85f9cb1 | feat(mcp): load the SDK's unexported MCP modules and scrub stdio environments | ported | 6 | 已同步（issue 09）；pi-sdk-internals + mcp-transport 环境清洗 |
| ba044f9 | feat(mcp): load the codemode, tool-search and mcp built-ins in normal sessions | ported | 7 | 已同步（issue 08）；builtin-extensions 注册内置扩展 |
| e299ab9 | feat(mcp): block MCP tools without readOnlyHint in read-only sessions | ported | 7 | 已同步（issue 09）；mcp-read-only-policy（chat-only 会话联动） |
| 30fe218 | feat(mcp): connect mcp.json servers through a per-session MCP host | ported | 10 | 已同步（issue 09 核心）；mcp-host.ts（1,086 行）+ rpc-manager 挂接 |
| 9dc822e | feat(chat): show a codemode call as its script and the tool calls it made | ported | 12 | 已同步（issue 08）；CodemodeToolView + codemode-view lib |
| 1c387b4 | feat(tools): write the Code mode choice through /api/tools/settings | ported | 9 | 已同步（issue 08）；路由写 → `pi:tools:settings:put {codemode}` |
| cc697e6 | feat(chat): label MCP calls server/tool and indent their JSON results | ported | 8 | 已同步（issue 09）；mcp-tool-display |
| 2b93cbc | docs(adr): record that ADR 0006 P1 is in place | n/a | 1 | 上游 ADR 文档 |
| 3dc123b | fix(mcp): idle out servers registered for a prompt that starts no run | ported | 4 | 已同步（issue 09） |
| a87758e | fix(chat): label MCP calls server/tool only from their result's details | ported | 7 | 已同步（issue 09）；依赖 cc697e6 |
| d733d43 | fix(mcp): connect a trusted project's servers as the pi CLI does | ported | 5 | 已同步（issue 09）；对齐 CLI 连接语义 |
| d1283eb | fix(mcp): read project trust fresh before every host sync | ported | 8 | 已同步（issue 09）；project-trust 热读 |
| 26e409e | feat(mcp): list MCP servers from files only | ported | 15 | 已同步（issue 09）；**新路由 app/api/mcp** → `pi:mcp:*` IPC |
| 3e693c7 | feat(trust): list a project's MCP servers in the trust dialog | ported | 15 | 已同步（issue 09）；project-trust 路由扩展 + 信任对话框列出服务器 |
| 2ac2a0f | feat(mcp): parse pasted MCP server configs | ported | 14 | 已同步（issue 09）；mcp-import 家族 + jsonc + shell-words |
| 8716e70 | feat(settings): list MCP servers read-only in Settings › MCP | ported | 16 | 已同步（issue 09）；McpConfig 骨架，依赖 26e409e |
| 9cf9547 | feat(settings): choose Code mode Automatic or Always on in Settings › MCP | ported | 20 | 已同步（issue 09）；依赖 8716e70 |
| 92489b7 | feat(settings): trust a project from Settings › MCP | ported | 25 | 已同步（issue 09）；stacked-dialog + Settings 面板接线 |
| 00647b0 | feat(mcp): switch, remove and undo MCP servers from Settings | ported | 21 | 已同步（issue 09）；mcp-config-file 写路径 + mcp-undo |
| 6695979 | feat(mcp): test a server's connection from Settings | ported | 22 | 已同步（issue 09）；**新路由 app/api/mcp/test** → Test IPC |
| dff71a0 | feat(mcp): report session connection state to Settings | ported | 20 | 已同步（issue 09）；mcp-status 会话连接态 |
| 922a9d7 | feat(mcp): sign in to and out of OAuth servers from Settings | ported | 28 | 已同步（issue 09）；**新路由 app/api/mcp/sign-in(+[flowId])** → OAuth push channel；McpSignIn |
| eeda862 | feat(mcp): add a server by pasting it, and trust a fresh folder in the same step | ported | 28 | 已同步（issue 09）；McpAddServer + mcp-add |
| ce615e7 | feat(chat): open Settings › MCP from /mcp | ported | 22 | 已同步（issue 09）；mcp-command 斜杠命令 |
| cb7003d | docs(adr): record that ADR 0006 P2 is in place | n/a | 5 | 上游 ADR 文档（含 3 个代码文件微调，已随 wave 吸收） |
| 2ef137c | fix(mcp): keep a hostile .pi/mcp.json from stopping the host or Settings | ported | 17 | 已同步（issue 09）；恶意配置隔离 |
| baaf825 | fix(trust): do not trust a fresh folder that holds an unseen project | ported | 10 | 已同步（issue 09）；依赖 eeda862 |
| 207ce36 | fix(mcp): show the command an install link or untrusted project runs | ported | 8 | 已同步（issue 09） |
| bf9decc | fix(mcp): bar a Test's token writes after Sign out, and free the host first | ported | 12 | 已同步（issue 09）；依赖 922a9d7/6695979 |
| cea11aa | fix(settings): keep Settings › MCP truthful and reachable around its edges | ported | 11 | 已同步（issue 09） |
| a2a31bd | refactor(mcp): keep one copy of the escaping, value-walk and chain rules | ported | 15 | 已同步（issue 09）；key-serializer/mcp-config-values 去重 |
| d85555e | fix(mcp): word Add's refusals, check every cwd alike, and say what is true | ported | 19 | 已同步（issue 09） |
| 4213e4b | test(mcp): pin the sign-in re-check, the masks and the hang fixture's exit | ported | 6 | 已同步（issue 09）；测试钉死 |
| eb6a4bd | test(mcp): make the Test route and Connection row tests check what they claim | ported | 3 | 已同步（issue 09） |
| 570f355 | fix(mcp): open a variable box with a name, and keep the Added notice short | ported | 11 | 已同步（issue 09）；Add 流 UX |
| 0dee0f0 | fix(mcp): say less in Settings › MCP, and move Test to the header | ported | 15 | 已同步（issue 09） |
| 5d4c0b5 | fix(mcp): skip the MCP wait for extension commands, and refuse late transports | ported | 8 | 已同步（issue 09）；**本仓当前同步终点** |

## A2 · subagents 波（5 个，issue 07）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 162a749 | fix(subagents): resolve `ext:` selectors against real extension sources | ported | 4 | 已同步（issue 07）；subagents/plugin-updates |
| c8ff7e8 | fix(subagents): key the collected-result mark by run, not session (#987/#989) | ported | 5 | 已同步（issue 07） |
| 00156d5 | fix(subagents): report a run orphaned by a restart as interrupted (#990) | ported | 3 | 已同步（issue 07）；依赖 c8ff7e8 的 run 键 |
| 2a71c57 | fix(subagents): say when a background report comes from a resumed run (#991) | ported | 6 | 已同步（issue 07）；依赖 00156d5 |
| 62542da | refactor(subagents): register the subagent control tools as model-only | ported | 4 | 已同步（issue 07）；subagent-extension |

## A3 · chat/composer 波（16 个，issue 03）

依赖：markdown 系（4a5081a/6a97d0b/faeff03）先行；编辑分支系（7303179 → 94c1f5c → 19774b8）链式。

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| fd037e4 | feat(chat): continue Markdown lists on new lines in the composer (#884) | ported | 3 | 已同步（issue 03）；markdown-list-continuation |
| 69882b9 | fix: group a turn whose anchor falls outside the first history page (#941) | ported | 2 | 已同步（issue 03/05）；ChatWindow |
| 46b5235 | fix(chat): let a long extension dialog title shrink instead of hiding the options (#961) | ported | 2 | 已同步（issue 03） |
| 342fc9a | fix(chat): tell unanswered output truncation to compact instead of retrying (#968) | ported | 13 | 已同步（issue 03/05）；message-display（demo 部分本就 n/a） |
| 2e66e40 | fix(chat): report compaction instead of "waiting for model" during auto-compaction (#1008) | ported | 5 | 已同步（issue 03/05）；chat-phase-label |
| 7303179 | fix(chat): branch a history edit only when it is sent (#1009) | ported | 5 | 已同步（issue 03）；onNavigate 退位 |
| fe288c0 | Review follow-ups for #907, #946 and #968 (#1010) | ported | 16 | 已同步（issue 05/07/03）；open-in-explorer/npm-source/subagents/message-display 跟进 |
| 0bae9b6 | fix(chat): collapse process details once a turn's answer appears (#1011) | ported | 2 | 已同步（issue 03）；与本地 26be91e 默认收起共存 |
| 4a5081a | fix: stop autolink literals at CJK punctuation (#971/#972) | ported | 5 | 已同步（issue 03）；markdown + `@types/mdast` devDep |
| 6a97d0b | fix: preserve currency formatting alongside inline math (#976) | ported | 3 | 已同步（issue 03）；依赖 4a5081a 的 markdown 结构 |
| faeff03 | fix(chat): keep typed line breaks in user messages (#1015) | ported | 5 | 已同步（issue 03） |
| d0bf6be | feat(chat): change the reasoning level while a run streams (#851/#1022) | ported | 4 | 已同步（issue 03）；取代 3f07a5f 的禁用态行为 |
| 19774b8 | feat(chat): fork a session while it is running (#1023) | ported | 12 | 已同步（issue 03）；依赖 7303179/94c1f5c |
| 94c1f5c | fix(chat): preserve drafts when selecting history edits | ported | 5 | 已同步（issue 03）；依赖 7303179 |
| 70470ca | fix(chat): queue extension dialogs and custom panels by request id | ported | 10 | 已同步（issue 03）；extension-ui-queue |
| e17d2cc | fix(chat): drop extension UI requests the server closed while the stream was down | n/a | 6 | v0.9.3 轮裁定：IPC push 天然跨越 renderer 重连，无 SSE 断流语义；dda61b2 仅因它修 CI |

## A4 · models/settings 波（9 个，issue 06 + 04）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 6a1246e | fix: do not persist new-session model picks into global defaults (#871) | ported | 21 | 已同步（issue 06）；**新路由 app/api/models/default** → models IPC；default/startup-preferences |
| bd85004 | fix(models): save a typed provider name with the Save button (#969) | ported | 7 | 已同步（issue 06） |
| 92ae057 | fix(models): do not open the keyboard when the model picker opens on mobile (#1012) | ported | 2 | 已同步（issue 06）；readOnly 提示 |
| d8f89c5 | feat(models): resolve the discovery endpoint from pi's provider catalog (#1006) | ported | 5 | 已同步（issue 06）；models-config/discover 路由逻辑并入 models 服务 |
| 5df8278 | feat(settings): configurable send key (Enter or Ctrl+Enter) (#1001) | ported | 9 | 已同步（issue 04）；useEnterSendMode |
| 197a3e5 | refactor(settings): share settings panel blocks and localize Plugins and Skills | ported | 18 | 已同步（issue 04）；settings-ui-helpers/display-path；eceac13/b9622a1 的基座 |
| eceac13 | feat(settings): Enable all / Disable all for Skills and Plugins (#1020) | ported | 16 | 已同步（issue 04）；`pi:skills:bulk-toggle` + plugins bulk；依赖 197a3e5 |
| b9622a1 | refactor(settings): switch skill and plugin groups from their headings (#1021) | ported | 12 | 已同步（issue 04）；依赖 eceac13 |
| 4de9f77 | fix(settings): enlarge skill and plugin group switches | ported | 3 | 已同步（issue 04）；依赖 b9622a1 |

## A5 · files/worktree 波（8 个，issue 02 + 05）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| a0c00f3 | feat(sidebar): open workspace in the system file manager (#907) | ported | 9 | 已同步（issue 05）；**新路由 app/api/open-in-explorer** → main 进程 shell；open-in-file-manager 共享 lib |
| 4cc0770 | fix: confirm force removal for submodule worktrees (#1007) | ported | 6 | 已同步（issue 03/05）；worktree 确认对话框 |
| 687af27 | fix(files): let the operator open symlinked folders outside the project (#1018) | ported | 12 | 已同步（issue 02 安全）；linked-directory + path-security；allow-link 骑 pifile:// |
| 82d1f54 | fix(worktrees): find the worktree to remove by its real path | ported | 2 | 已同步（issue 02） |
| b3c7255 | fix(files): stop authorizing paths from system messages and non-coding tool results | ported | 3 | 已同步（issue 02 安全）；session-file-references-core |
| 13bc2b0 | fix(files): let Git decide what the file tree hides (#1014) | ported | 6 | 已同步（issue 05）；file-tree-visibility 取代前端自筛 |
| 680db65 | Add directory creation to the folder picker (#981) | ported | 8 | 已同步（issue 05）；directory-browser + **cwd/browse 路由扩展**（既有路由） |
| 433d09e | feat(default-cwd): create dated folders under ~/pi-cwd using the local date (#996) | ported | 7 | 已同步（issue 05）；default-cwd 本地日期 |

## A6 · lib 基础设施 / sessions-agent 波（10 个，issue 05 + 07）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 6f92983 | fix(agent): report the system prompt before a session's first message (#974) | ported | 3 | 已同步（issue 05）；rpc-manager |
| 6b0c6a5 | fix(agent-events): bound the per-client SSE backlog (#997) | ported | 2 | 已同步（issue 05）；SSE 背压语义改为 IPC push 侧等价物 |
| aed0f3c | fix(sessions): treat a wrapper as gone once shutdown starts and bound session_shutdown | ported | 5 | 已同步（issue 05）；README/bin 部分本仓无对应物 |
| b8e0b71 | perf(sse): slim nested tool events and coalesce tool updates | ported | 9 | 已同步（issue 05）；agent-event-wire/stream 瘦身 + 合并 |
| 34c8fdf | fix(sessions): wait for a closing wrapper before reopening its session | ported | 3 | 已同步（issue 05）；依赖 aed0f3c |
| 9ede521 | fix(sessions): reap a run Stop cannot unwind when idle shutdown is disabled (#1017) | ported | 3 | 已同步（issue 05） |
| f5e768e | fix(bash): let Stop end a command whose output a survivor holds open (#1016) | ported | 5 | 已同步（issue 05）；project-command-env |
| 390e70f | fix(ui): keep the mobile composer above the keyboard and give typing more room (#992) | ported | 6 | 已同步（issue 05）；useViewportHeight + globals.css（PWA 测试文件部分 n/a） |
| 73104ba | refactor(tools): stop withExtensionTools from forcing inactive tools on | ported | 5 | 已同步（issue 07）；依赖 18758b7 的暴露语义 |
| 18758b7 | fix(tools): carry only active tools and keep session tools across navigation | ported | 4 | 已同步（issue 07）；rpc-manager resolveActiveToolNames |

## A7 · demo / 兼容 / 文档 n/a（3 个）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 4857da3 | feat(demo): static Pi Web demo for GitHub Pages (#949) | n/a | 272 | demo/ 全量（+58,949 行大头）；`.github/workflows/demo-pages.yml`、README 四语；顺带的 `app/globals.css`/tsconfig/eslint 微调已无影响 |
| 96966e5 | fix(demo): CI typecheck, downloads on Pages, README auto-tab (#950) | n/a | 6 | demo 内部修复 |
| f52fd84 | fix(compat): load on Safari and iOS 16.2 (#1019) | n/a | 7 | Safari/iOS 兼容（gfm-autolink-email-loader.cjs + next.config）；Electron/Chromium 无此问题 |

## A8 · deps（1 个）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 2bb48f5 | chore(deps): upgrade pi to 0.99.1 | ported | 12 | 已同步（issue 01）；pi-types 原样搬入，rpc-manager/session-reader/powershell-settings 适配 |

---

# Part B — 本轮待同步（21 个提交，`5d4c0b5..upstream/main`）

建议移植顺序（波内数字 = 依赖序）：
**B1 MCP/Code mode Settings 二期（1→13）→ B3 settings/models → B2 chat → e77a4e5（SDK 1.0.0，收尾）
→ dda61b2（随 e77a4e5 同批）**；6fcd7d4 仅本地版本对齐。B1 内部严格按上游时间序
（hunk 相邻，倒序必然冲突）。

## B1 · mcp/codemode 波（13 个 — 本轮主工作量）

| # | sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|---|
| 1 | de91212 | fix(mcp): say what to type in Add's value boxes | ported | 8 | 本轮待移植；McpAddServer + mcp-add-helpers + i18n 三语；纯渲染层 |
| 2 | c8fc3c0 | feat(mcp): list every paste format the add pane reads, each with an example | ported | 11 | 本轮待移植；依赖 #1（同文件）；settings.css + SettingsUi.blocks |
| 3 | b183176 | fix(mcp): ask for the server's name right after the paste | ported | 3 | 本轮待移植；依赖 #2；McpAddServer 状态机 |
| 4 | 6c599e9 | feat(mcp): set Code mode's tool list budget in Settings | ported | 19 | 本轮待移植；codemode-settings + `app/api/tools/settings` 扩展 → 扩展 `pi:tools:settings:put` payload（budget）；i18n |
| 5 | 834b6b8 | fix(tools): show the tool descriptions the model is sent | ported | 5 | 本轮待移植；pi-types + rpc-manager + 集成测试；独立可先行 |
| 6 | d702bc6 | feat(mcp): choose each server's exposure in Settings | ported | 20 | 本轮待移植；exposure 由只读变可选；`app/api/mcp` 写路径 → `pi:mcp:*` 写 channel 扩展；依赖 #4（api-types/codemode-settings 同面） |
| 7 | dba11f4 | feat(mcp): link the add pane to four MCP server catalogs | ported | 11 | 本轮待移植；catalogHref 结构化（本地当前仅 github.com/mcp 单链接，已核实） |
| 8 | 0b2d4fa | feat(mcp): choose in Settings whether Code mode takes over the built-in tools | ported | 18 | 本轮待移植；依赖 #4（同改 tools/settings 路由 + codemode-settings）；i18n |
| 9 | 4e1edd8 | fix(mcp): label the official registry link MCP Registry | ported | 2 | 本轮待移植；依赖 #7 |
| 10 | 9d5b077 | fix(mcp): shorten the Code mode pane and bold the chosen option | ported | 6 | 本轮待移植；依赖 #8（Code mode 面板） |
| 11 | 7b3df71 | fix(tools): list only declared tools in the Tools panel under Code mode's In scripts | ported | 6 | 本轮待移植；ToolDefinitionsPanel + tool-presets；依赖 #8（takeover 语义） |
| 12 | e851b03 | feat(mcp): link github.com/mcp from the add pane again | ported | 3 | 本轮待移植；依赖 #7（catalog 集合调整） |
| 13 | 82e5539 | feat(chat): show a codemode script in the box any tool's input uses | ported | 6 | 本轮待移植；CodemodeToolView 扩展到任意工具输入框 + globals.css（注意 file:// 字体栈守卫：port 后 grep font-noto-mono = 0） |

## B2 · chat/composer 波（1 个）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| cfcf2a1 | fix(chat): drop the light theme's own border inside code blocks | ported | 1 | 本轮待移植；MermaidBlock 内 CodeBlock 的 Prism `vs` 主题 border 覆盖；独立小件 |

## B3 · models/settings 波（2 个）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 8800b5a | fix(models): say why a model switch cannot move in visible text | ported | 4 | 本轮待移植；EnabledModelsSection/ModelsConfig 文案；其 docs/adr/0004 hunk 是上游自己的 ADR（编号撞车，本仓 ADR-0004 另有所指）→ 该 hunk n/a |
| 3eb8a9d | feat(settings): choose global or project in one place in every add pane | ported | 14 | 本轮待移植；AgentsConfig/McpAddServer/Plugins/Skills/SettingsUi 统一 global|project 选择；依赖 B1#3（McpAddServer 状态机）与 197a3e5（settings-ui-helpers，已在） |

## B4 · 文档 / 测试 / deps/版本（5 个）

| sha | subject | 状态 | 文件数 | 备注 |
|---|---|---|---|---|
| 9f8447a | docs(agents): move topic notes out of AGENTS.md into docs/agents | n/a | 12 | 上游 AGENTS.md/docs 组织；本仓不搬（先例：v0.9.1 轮 docs(agents) = n/a） |
| 279e228 | docs(agents): correct outdated notes and trim them to their rules | n/a | 22 | 上游文档重写；含 8 个代码文件的**仅注释** hunk（mcp-host/rpc-manager/worktree/mcp-config-file/AppShell/McpConfig/mcp-tool-display/model-catalog-refresh）——可选随 B1 捡，无行为变化 |
| e77a4e5 | chore(deps): upgrade pi to 1.0.0 | ported | 44 | 本轮待移植；详见 §2；**必须最后做**（上游把它排在 B1/B3 功能之后，先升 SDK 会让全部功能 hunk 漂移）；同步 `electron/main/services/mcp.ts` 的 auth/命名拒绝规则 |
| dda61b2 | test: pass on Node 22 CI runners | ported | 4 | 本轮待移植；随 e77a4e5 同批：Node 22 test-runner 对 unref'd timer 的取消（keepAlive interval）+ 5000 层 JSON.stringify 栈溢出改 String.repeat；4 个测试文件中 2 个本仓未搬（mcp-config-key/read.test.mjs），相应 hunk 跳过 |
| 6fcd7d4 | Release v0.10.0 | n/a | 2 | 仅 package.json/lock 版本号；详见 §3；本地另行把 app 版本对齐 0.10.0 |

## i18n 波（说明）

本范围**没有独立 i18n 提交**；全部 locale 键（en/zh-CN/zh-TW 各 +605 行）随各功能提交落地。
约束：本仓 i18n registry 测试强制三语 parity——**Part B 每个带 i18n 的提交移植时三语齐更**
（zh-TW 上游常不全，需我们补全，先例见 v0.8.11 轮）。

---

## 统计

| 分类 | Part A（已同步） | Part B（本轮） | 合计 |
|---|---|---|---|
| ported | 83 | 18 | **101** |
| n/a | 7（4857da3, 96966e5, f52fd84, e17d2cc, 89bd25b, 2b93cbc, cb7003d） | 3（9f8447a, 279e228, 6fcd7d4） | **10** |
| deferred | 0 | 0 | **0** |
| 合计 | 90 | 21 | **111** |

波次提交数：A1 mcp/codemode 38 · A2 subagents 5 · A3 chat/composer 16 · A4 models/settings 9 ·
A5 files/worktree 8 · A6 lib 基础设施 10 · A7 demo/compat 3 · A8 deps 1；
B1 mcp/codemode 13 · B2 chat 1 · B3 models/settings 2 · B4 docs/test/deps 5（含 2 n/a + e77a4e5 + dda61b2 + 6fcd7d4）。

无 deferred：21 个新提交全部可归入 B1–B4 的既有波次；e77a4e5 体量大但属本轮核心目标
（map.md 已定 SDK 0.99.1 → 1.0.0），不另开 ticket。
