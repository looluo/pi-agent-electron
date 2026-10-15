# Issue 09: mcp-wave

Type: task
Status: resolved

ADR 0006 P1/P2. Part 1 (this batch): the lib core + session wiring.

- lib cluster from upstream: mcp-host, mcp-transport, pi-sdk-internals,
  mcp-config-file/read/values, mcp-add, mcp-import-*, mcp-sign-in/out,
  mcp-test, mcp-undo, mcp-status, mcp-secrets, mcp-read-only-policy,
  mcp-entry-request, mcp-server/tool-display, mcp-command, mcp-json-error,
  builtin-extensions (codemode/tool-search/mcp as replaceable built-ins),
  project-trust (fresh-folder trust semantics + trust.json decision
  fields), skills-service, key-serializer, jsonc, shell-words, api-types.
- rpc-manager wiring (30fe218 family): prompts that may start a run wait
  for the session's MCP host (prepareForPrompt, wait/none by
  mcpPromptPreparation over extension-command candidates); Stop withdraws
  the wait; the host disposes after extension binding on shutdown and in
  destroy(); createReadOnlyMcpPolicyExtension rides the normal-session
  factories; get_tools filters withdrawn tools (73104ba tail).
- 50/50 mcp-host tests, builtin-extensions suites, project-trust 26/26.

Known skips (4 integration tests, documented in-file): extension-registered
server connections over stdio hang under this repo's Node 26 — upstream CI
pins 22.19. Host logic is unit-covered; the mcp.json path passes.

Part 2 (app surface): the four mcp routes re-homed onto seven typed IPC
channels (pi:mcp:overview/action/test + sign-in start/status/paste/cancel)
via electron/main/services/mcp.ts — a faithful translation of the route
layer (refusals carry status+reason; every file write rides the locked
writer). The renderer keeps upstream's helpers wholesale: mcp-bridge-fetch
serves the helpers' /api/mcp* FetchLike calls from the typed bridge (and
falls back to global fetch under the node test harness, so upstream's
mocked tests pass unmodified). McpConfig/McpSignIn/McpAddServer +
SettingsPanel's MCP section and the trust-dialog MCP listing landed
(projectTrustGet now answers the MCP listing beside the status). A
renderer-build hazard was caught and fixed: projectTrustReloadKey must
live in settings-ui-helpers (browser-safe), not lib/project-trust (node
SDK graph).
