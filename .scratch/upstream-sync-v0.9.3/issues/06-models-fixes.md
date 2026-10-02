# Issue 06: models-fixes

Type: task
Status: resolved
Blocked by: —

499aa4f (models.json read like pi; never save over an unreadable file),
d8f89c5 (discovery endpoint from pi's provider catalog, #1006), bd85004
(typed provider name saved with the Save button, #969), 92ae057 (no
keyboard when the mobile model picker opens), 6a1246e (new-session model
picks never persist into global defaults, #871).

## Answer

Resolved. Adaptations:

- ModelsConfig keeps the window.pi.modelsConfigGet transport (upstream's
  fetch error-shape hunk dropped); model-loading.test keeps the bridge
  mock and gains SavedDefaultThinkingLevel.
- 6a1246e deletes the no-op startup-preferences module (fork had it from
  r2); its rpc-manager import and obsolete source-assertion test removed,
  replaced by upstream's "never writes the global model defaults" test.
- The route-side savedDefaultThinkingLevel re-homed onto the pi:models
  IPC response (models-auth.ts: getDefaultThinkingLevel alongside the
  resolved default; EMPTY_MODELS gains the null).

Gate: typecheck clean; npm test 1375/1377 (2 win32 skips); e2e 12/12.
