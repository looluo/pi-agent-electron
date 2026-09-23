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
