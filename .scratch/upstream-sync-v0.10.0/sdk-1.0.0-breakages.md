# SDK 0.99.1 → 1.0.0 破坏性变更分析（pi-agent-electron）

- 分析方法：`npm pack` 两版本的 `@earendil-works/{pi-coding-agent,pi-agent-core,pi-ai,pi-tui,pi-mcp}` 到 `/tmp/pi-sdk-compare` 解包逐文件 diff（package.json exports、`.d.ts`、`.js` 运行时导出、CHANGELOG），对照本仓库 `electron/main`、`electron/preload`、`pi-web/src` 全部 import（含多行与动态 `import()`）。
- 行号约定：**HEAD 行号 = 升级前基准**；括注"现"= 当前工作区行号（工作区已有未提交的适配改动，见 §5）。
- 状态：当前工作区已把 4 个依赖升到 1.0.0 并完成适配，`npm run typecheck`（tsconfig + tsconfig.electron）通过。

---

## 1. CHANGELOG 要点（引用原文）

`pi-coding-agent` CHANGELOG 1.0.0 无独立 Breaking 节，破坏面来自 1.0.0 + 0.99.2 两个版本：

**1.0.0（2026-10-01）**
- "**MCP OAuth hardening** — `oauth.authServerMetadataUrl`, RFC 9207 `iss` checks, credentials per server, and step-up sign-in that keeps granted scopes."
- "MCP OAuth credentials are now stored per server name and URL, so MCP servers with the same URL can sign in with different accounts. Credentials stored by URL alone move to the first server that uses them"（**破坏点：`McpOAuthCredentialStore.forServer/tokens/remove` 增加 name 首参，`mcp-auth.json` 键格式变化**）
- "Changed the default TUI mode to fullscreen"（仅 TUI 默认值，本应用未用 `tuiMode`）
- `quietStartup` 增加 `"header"`（类型从 `boolean` 放宽为 `boolean | "header"`，本应用未用）

**0.99.2（2026-09-30，随 1.0.0 一并生效）**
- "`codemode-deferred` is now an alias for `codemode`"（**破坏点：`McpExposure` 联合类型删除 `"codemode-deferred"`**；`validateMcpServerConfig` 会把别名归一成 `"codemode"` 返回）
- "MCP servers with the default `codemode` exposure no longer appear in the `codemode` description; scripts find them with `searchTools()`"
- "The first prompt no longer waits for MCP servers without `direct` tools. They connect in the background…"（`startupWaitMs` 语义变化：只等 direct 服务器）
- MCP 工具/命名空间名 `-`→`_`（`mcp__my-server__x` → `mcp__my_server__x`），新增 `description` 字段、`oauth.clientName`、`"auth": {"provider": …}`、`mcpNamespace()`

`pi-ai`、`pi-tui`、`pi-agent-core`、`pi-mcp` 包内无 CHANGELOG 文件；其变化以 .d.ts diff 为准（见下）。

---

## 2. 确认安全的符号清单（签名/类型未变）

### @earendil-works/pi-coding-agent（根导出：无删除，仅新增 `QuietStartup`、`resolveCodemodeWorkerSpecifier`）

| 符号 | 底层文件 diff | 结论 |
|---|---|---|
| `getAgentDir` / `getPackageDir` / `CONFIG_DIR_NAME` / `VERSION` | config.d.ts 仅 codemode-worker 函数改名（`getCodemodeWorkerUrl`→`getCodemodeWorkerSpecifier`，根未导出、未用） | ✅ 安全 |
| `SettingsManager` | 仅 `quietStartup`/`getQuietStartup`/`setQuietStartup` 放宽为 `QuietStartup`；本应用不调用这些 | ✅ 安全 |
| `SessionManager` / `SessionEntry` 等 | session-manager.d.ts **0 diff** | ✅ |
| `ModelRuntime` | 仅新增私有成员 | ✅ |
| `DefaultPackageManager`（+`PackageSource`/`ResolvedPaths`/`ResolvedResource`） | package-manager.d.ts **0 diff** | ✅ |
| `DefaultResourceLoader`（+`ResourceDiagnostic`） | resource-loader.d.ts **0 diff** | ✅ |
| `createAgentSessionFromServices` / `createAgentSessionServices`（+`AgentSessionServices` 等） | sdk.d.ts、agent-session-services.d.ts、agent-session-runtime.d.ts **0 diff** | ✅ |
| `resolveModelScopeWithDiagnostics` / `ScopedModel` | model-resolver.d.ts **0 diff** | ✅ |
| `ProjectTrustStore` / `hasTrustRequiringProjectResources` / `ProjectTrustStoreEntry` | trust-manager.d.ts **0 diff** | ✅ |
| `initTheme` / `Theme` | theme.d.ts **0 diff** | ✅ |
| `parseFrontmatter` | frontmatter.d.ts **0 diff** | ✅ |
| `createCodemodeExtension` / `createToolSearchExtension` | **0 diff** | ✅ |
| `createMcpExtension`（+`McpExtensionOptions`/`McpTransportFactory`） | 仅文档 + 新增导出（`MCP_SERVERS_SECTION` 等）+ `startupWaitMs` 语义注释；options 成员（loadConfig/createTransport/credentials/logPath/openUrl/updateConfig/startupWaitMs）不变 | ✅ |
| `createBashToolDefinition` / `createLocalBashOperations` / `BashOperations` | tools/index.d.ts **0 diff** | ✅ |
| `defineTool` 及全部 extension 类型（`ExtensionAPI`/`ExtensionContext`/`ExtensionFactory`/`InlineExtension`/`ToolInfo`/`ToolDefinition`/`ToolExposure`/`LoadExtensionsResult`） | extensions/index.d.ts **0 diff** | ✅ |
| `AgentSession` | 新增可选 `usesDefaultTools` 配置项（additive） | ✅ |
| `JsonAgentSessionEvent` / `SlashCommandInfo` / `AgentSessionEvent` | modes/index.d.ts **0 diff** | ✅ |
| `McpServerEntry` / `LoadedMcpConfig` / `loadMcpConfig`(内部) | 形状不变（`McpServerConfig` 新增可选 `description`/`clientName`/`authServerMetadataUrl`/`auth`，additive） | ✅ |
| 动态 `import()`：electron/main/services/export.ts:28 `getPackageDir` | 同上 | ✅ |

⚠️ 类型变化但本应用未用：`McpExposure` 删除 `"codemode-deferred"`（见 §3）；`quietStartup` 放宽。

### @earendil-works/pi-ai
- 根 index.d.ts、compat.d.ts（`completeSimple`/`AssistantMessage`）、providers/all.d.ts（`getBuiltinProviders`）**逐字节相同**。
- `Type`、`Api`、`Model`、`AuthEvent`、`AuthPrompt`、`Credential`、`ImageContent`、`TextContent`、`Context`、`SimpleStreamOptions`、`getSupportedThinkingLevels`、`normalizeContext` 全部 ✅。仅新增 `./models` 子路径导出。

### @earendil-works/pi-agent-core
- 用的只有类型 `Agent` / `AgentMessage` / `ThinkingLevel`：仍在（agent.d.ts / types.d.ts 不变）✅。
- 被删：`uuidv7`、pi-telemetry 再导出、`./node`、`./harness/*`、`./experimental/pico3` 子路径导出（本应用均未用；包体积因此 812KB→61KB）。

### @earendil-works/pi-tui
- `KeybindingsManager`、`TUI_KEYBINDINGS`：keybindings.d.ts **0 diff** ✅。仅新增 `isAppleTerminalSession` 导出。

### @earendil-works/pi-mcp（传递依赖，0.99.1→1.0.0）
- package.json 除版本外 **0 diff**（exports 不变，`StdioTransport` 仍在 `dist/transports/stdio.js`）；transports/stdio.d.ts、client.d.ts **0 diff**；仅 oauth/* 新增（RFC 9207 `iss`、`stepUpScope`、`authorizationServerMetadataUrl`；`IssuerMismatchError` 构造参数 `received: string | undefined`——本应用不构造它）。

---

## 3. 需要改的调用点（HEAD 行号 + 改法；工作区已完成，附现况）

### A. `McpOAuthCredentialStore` 增加 name 首参（编译 + 运行时破坏，共 6 处）

SDK 变化：`forServer(name, serverUrl)`、`tokens(name, serverUrl)`、`remove(name, serverUrl)`；runtime.js 以 `entry.name` 调用。

1. **pi-web/src/lib/mcp-sign-out.ts:93-94** — `GuardedCredentialStore.forServer(serverUrl)` 覆写 → 改为 `forServer(name: string, serverUrl: string)` + `super.forServer(name, serverUrl)`。（现 110-111，已改）
2. **pi-web/src/lib/mcp-sign-in.ts:241** — `store: (url) => new internals.McpOAuthCredentialStore().forServer(url)` → `(name, url) => ….forServer(name, url)`。（现 242，已改）
3. **pi-web/src/lib/mcp-sign-in.ts:153** — `McpSignInDeps.store(url: string)` 声明 → `store(name: string, url: string)`；调用点 **:490** `deps.store(flow.target.url)` → `deps.store(flow.target.name, flow.target.url)`（`McpSignInTarget extends McpTestTarget` 自带 `name`）。（现 154、491，已改）
4. **pi-web/src/lib/mcp-sign-in.ts:669-674** — `signOutMcpServer(url, agentDir, internals)` 增加 `name` 参数；内部 `.remove(url)` → `.remove(name, url)`。（现 672-681，已改）
5. **electron/main/services/mcp.ts:349**（HEAD 325）— 调用点改 `signOutMcpServer(name, url, agentDir, internals)`（`signOutServer` 作用域内已有 `name`）。（已改）
6. **pi-web/src/lib/pi-sdk-internals.ts:148-152** — 本地 `McpOAuthSettings` 接口可选补齐 `clientName?: string`、`authServerMetadataUrl?: URL`（与 SDK 保持同构；`McpOAuthCredentialStore = NonNullable<McpExtensionOptions["credentials"]>` 类型别名自动跟随新签名，无需改）。（可选，未改也不破坏）

### B. `McpExposure` 删除 `"codemode-deferred"`（编译破坏，共 4 个文件 6 处）

7. **pi-web/src/lib/mcp-host.ts:168** — `SCRIPT_EXPOSURES = new Set<McpExposure>(["codemode", "codemode-deferred"])` → 去掉该字面量（`loadMcpConfig` 的校验器已把别名归一为 `"codemode"`）。（已改）
8. **pi-web/src/lib/mcp-test.ts:77** — `EXPOSURES` 集合同上去掉 `"codemode-deferred"`。（现 78，已改）
9. **pi-web/src/lib/mcp-import-core.ts:1101** — `MCP_EXPOSURES: readonly McpExposure[]` 去掉该字面量；如仍要接受旧值作为输入别名，另加 `MCP_EXPOSURE_ALIASES: Record<string, McpExposure> = { "codemode-deferred": "codemode" }`。（现 1110，已按此改）
10. **pi-web/src/components/mcp-config-helpers.ts:281-292、463、(现)511** — `MCP_EXPOSURE_KEYS` / `MCP_EXPOSURE_SHORT_KEYS` 两个 `Record<McpExposure, string>`、`MCP_EXPOSURE_OPTIONS` 数组、`exposure === "codemode-deferred"` 比较全部去掉该成员（读取侧已被校验器归一，展示层不会再见到它）。（已改，现 285-312）

### C. `mcp-auth.json` 键格式变化（运行时行为破坏，1 处）

11. **pi-web/src/lib/mcp-config-read.ts:355-368、464-465**（现 309-349）— 键从 `String(new URL(url))` 变为 `` `${mcpNamespace(name)}|${String(new URL(url))}` ``（旧键首次加载时被迁移）。`readAuthState`/`signInKey` 只按 URL 键匹配会把新格式键的已登录服务器显示成未登录。改法：匹配两键（`key ?? legacyKey`），本地实现 `mcpNamespace(name)`（`name.replace(/-/g, "_")`）。（已按此改，现 `authStateOf` + `mcpNamespace`）

**统计：必须修改的调用点 11 处（A 组 5 处编译+运行时、B 组 4 文件 6 处编译、C 组 1 处行为），另 1 处（A6）可选补齐。** 均已在当前工作区完成，typecheck 通过。

---

## 4. 内部模块路径与成员变化（pi-web/src/lib/pi-sdk-internals.ts 权威清单）

六个按文件 URL 加载的内部模块在 1.0.0 中**路径全部未变**，成员全部仍在：

| 模块（SDK_MODULES） | 路径 | 变化 |
|---|---|---|
| mcpExtension | `dist/extensions/mcp/index.js` | ✅ `createMcpExtension` 不变（pi-sdk-internals 用它做同实例校验） |
| mcpRuntime | `dist/extensions/mcp/runtime.js` | `McpServerConnection` ✅（构造 options 新增可选 `providerToken`、`log`；我们读的全部成员 entry/state/error/tools/hasResources/resources/resourceTemplates/instructions/challenge/name/timeoutMs/oauthUrl/oauthSettings()/getClient()/reconnect()/signOut()/close() 不变）；`createDefaultTransport(entry, cwd, authProvider)` ✅ 签名不变；`McpServerLog` 不变 |
| mcpConfig | `dist/extensions/mcp/config.js` | `loadMcpConfig` / `addMcpServerConfig` / `updateMcpServerConfig` / `removeMcpServerConfig` ✅ 签名全部不变 |
| mcpOAuth | `dist/extensions/mcp/oauth.js` | ⚠️ `McpOAuthCredentialStore.forServer/tokens/remove` 增加 name 首参（§3.A）；`McpSignInCancelledError`、`signInMcpServer(options)` ✅ 签名不变（`McpOAuthSettings` 新增可选 `clientName`/`authServerMetadataUrl`）；构造器仍 `(backend?, lockDir?)`，`new ()` 可用 |
| mcpServers | `dist/core/mcp-servers.js` | `validateMcpServerConfig(name, raw)` ✅（形参更名 value→raw；**语义**：返回别名归一后的副本）；`getMcpToolExposure(config, toolName)` ✅；新增 `mcpNamespace` 导出 |
| configValues | `dist/core/resolve-config-value.js` | `resolveConfigValueOrThrow` / `resolveHeadersOrThrow` / `getConfigValueEnvVarNames` / `isCommandConfigValue` ✅ 全部不变 |
| （动态解析）mcpClient | `@earendil-works/pi-mcp` 根入口 | ✅ `StdioTransport` 仍在、options 形状不变；pi-mcp 1.0.0 exports 与 0.99.1 相同 |

结论：**内部 mcp 模块兼容**——路径、`isClass`/`typeof function` 契约、`sharesStdioTransport` 探针全部照旧；唯一破坏是 credential store 的三个双参方法（§3.A 已适配）。`pi-sdk-internals.test.mjs` 契约测试无需改动。

---

## 5. 其他需要知晓的行为变化（不改代码）

- MCP 连接转后台：首 prompt 只等 `direct` 服务器，其余等脚本/搜索实际用到时（`startupWaitMs` 语义变化，见 extensions/mcp/index.d.ts 注释）。
- `codemode`/`codemode-deferred` 服务器不再列进 codemode description，改列在 `mcp_servers` 系统提示段（`MCP_SERVERS_SECTION`）；工具/命名空间名 `-`→`_`。
- MCP OAuth：凭证按 name+URL 分账号存储；step-up sign-in 保留已授权 scope；`iss`（RFC 9207）校验。
- `SettingsManager`：`quietStartup` 可为 `"header"`；`AgentSessionConfig.usesDefaultTools`（可选新增）；TUI 默认全屏（本应用不受影响）。
- `pi-agent-core` 删除 `./node`、`./harness/*` 等子路径导出（未用）。

## 6. 依赖版本

工作区 package.json 已改（未提交）：`@earendil-works/{pi-agent-core,pi-ai,pi-coding-agent,pi-tui}` `0.99.1` → `1.0.0`；`pi-mcp` 由 pi-coding-agent 传递引入 `^1.0.0`。node_modules 已安装 1.0.0。
