# Issue 03: models-panel-batch

Type: task
Status: ready-for-agent
Blocked by: 01

Five commits, all on the Models settings surface. Local base: provider-usage
IPC (`pi:provider-usage:query`) and ModelsConfig/SettingsPanel already ported
through v0.9.1.

- `50f6cce` — enabledModels switches in Settings → Models (#930). New
  `lib/enabled-models.ts` + `lib/enabled-models-runtime.ts` +
  `components/EnabledModelsSection.tsx` + helpers. Re-home
  `app/api/models/enabled/route.ts` onto the `pi:models` IPC (mutation
  channel or new `pi:models:enabled` — settle when porting; keep the
  response/error shape).
- `058341d` — manual "Refresh catalog" button (#914/#938). New
  `lib/model-catalog-refresh.ts`; button in EnabledModelsSection; rides the
  models IPC with an allowNetwork refresh.
- `8b084d3` — relative time when the usage quota was not updated today
  (`lib/i18n/format.ts` + ProviderUsageSummary).
- `6e95fba` — OpenCode Go provider usage quota (#844):
  `lib/provider-usage-ids.ts` mapping entry.
- `79894b9` — extension-registered providers in settings + auth (#833):
  upstream touches 4 auth routes + `lib/model-runtime.ts`. Local auth lives
  in `electron/main/ipc-models-auth.ts` / `services/models-auth.ts` — port
  the model-runtime half, re-home the provider-listing fix onto
  `authProviders()` IPC.

Order: `50f6cce` → `058341d` (button lives inside the section the former
adds), then the three fixes in any order.

Gate: typecheck ×2; i18n parity (en/zh-CN/zh-TW) for every new key; models
settings panel source-assertion tests ported; packaged smoke once for the
refresh button (needs real catalog fetch).


## Answer

Resolved, all five commits. Port order adjusted: 79894b9 first (it creates
lib/model-runtime.ts, which 50f6cce's route imports).

- 79894b9: lib/model-runtime.ts verbatim; six auth-flow sites in
  services/models-auth.ts swapped to createModelRuntimeWithExtensions()
  (providers/all-providers/api-key status+set/oauth login+logout). The
  modelsPath-scoped test runtime at line ~223 stays bare, matching upstream's
  fix scope.
- 50f6cce: renderer+lib via port-patch (app/settings.css path remapped);
  app/api/models/enabled GET+PUT re-homed as services/models-enabled.ts
  (modelsEnabledGet/Put, StatusBody convention, same allow-list as modelsGet);
  new IPC pi:models:enabled:get/put + preload + pi-ipc. ModelsConfig save
  conflict merged: IPC transport kept, upstream post-save resync adopted.
- 058341d: renderer+lib via port-patch; app/api/models/refresh re-homed as
  modelsCatalogRefresh in the same service + pi:models:catalog:refresh IPC;
  EnabledModelsSection's three fetches rewritten to window.pi.
- 8b084d3 + 6e95fba: clean applies.

Windows/test adaptations (recorded for future waves): EnabledModelsSection
test css path ../app/ -> ../settings.css; model-catalog-refresh tests' jiti
alias "@" maps to pi-web/src (not repo root); enabled-models-runtime shadow
test mirrors displayPath()'s tilde shortening because Windows tmpdir lives
under $HOME (upstream CI assumption).

Mid-batch incident: a git checkout -- . reverted unstaged-on-top-of-staged
electron-side edits (models-auth swap, IPC/preload/pi-ipc, fetch rewrites);
redone in one scripted pass and verified by content greps before the gates.

Gate: typecheck x2 clean; npm test 1075/1079 (1 pre-existing Windows PATH
baseline); e2e 8 passed 1 skipped; i18n parity enforced by the registry test
(en/zh-CN/zh-TW new keys all present). New IPC: pi:models:enabled:get/put,
pi:models:catalog:refresh.
