import { stat } from "fs/promises";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { app } from "electron";
import type { AssistantMessage } from "@earendil-works/pi-ai/compat";
import { completeSimple } from "@earendil-works/pi-ai/compat";
import { createAgentSessionServices, getAgentDir, ModelRuntime, type SettingsManager } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import {
  loadModelsWithCache,
  withModelRuntimeError,
  withSafeModelLoadFailure,
  type ModelsData,
} from "@/lib/models-cache";
import { resolveVisibleModels, selectInitialModelScope } from "@/lib/model-scope";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import { projectTrustReloadOptions } from "@/lib/project-trust";
import { readModelsConfig, writeModelsConfig } from "@/lib/models-config-store";
import { buildApiKeyProviderList, buildOAuthProviderList } from "@/lib/provider-listing";
import { collectProviderListingInputs } from "@/lib/provider-listing-runtime";
import { invalidateModelsCache } from "@/lib/models-cache";
import { removeStoredCredentialIfType, storeProviderCredential } from "@/lib/provider-credential-store";
import { resolveModelDiscoveryAuth } from "@/lib/model-discovery-auth";
import { buildModelsListUrl, parseDiscoveredModels } from "@/lib/model-discovery";
import {
  flattenModelsDevCatalog,
  recommendModelCatalogPreset,
  searchModelCatalog,
  type ModelCatalogEntry,
} from "@/lib/model-catalog";
import { getPiWebReleaseUrl, isNewerStableVersion } from "@/lib/app-update";
import type { AuthEvent, AuthPrompt } from "@earendil-works/pi-ai";

/**
 * Ports of app/api/{models, models-config, models-config/test,
 * models-config/discover, models-config/catalog, auth/*, app-update}.
 */

type StatusBody = { status: number; body: Record<string, unknown> };

const modelNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareModelEntries(
  a: { id: string; name: string; provider: string },
  b: { id: string; name: string; provider: string },
): number {
  return modelNameCollator.compare(a.name || a.id, b.name || a.id)
    || modelNameCollator.compare(a.provider, b.provider)
    || modelNameCollator.compare(a.id, b.id);
}

async function loadModels(cwd: string): Promise<ModelsData> {
  const nameMap = new Map<string, string>();
  let modelList: { id: string; name: string; provider: string }[] = [];
  let defaultModel: { provider: string; modelId: string } | null = null;
  const thinkingLevels: Record<string, string[]> = {};
  const thinkingLevelMaps: Record<string, Record<string, string | null>> = {};

  const agentDir = getAgentDir();
  const trustReloadOptions = projectTrustReloadOptions(cwd, agentDir);
  const services = await createAgentSessionServices({
    cwd,
    agentDir,
    ...(trustReloadOptions ? { resourceLoaderReloadOptions: trustReloadOptions } : {}),
  });
  const modelError = services.modelRuntime.getError();
  const settings: SettingsManager = services.settingsManager;
  const scope = await resolveVisibleModels(
    services.modelRuntime,
    settings.getEnabledModels(),
  );
  const { visible, thinkingLevelPins, warnings } = scope;
  modelList = visible.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
  })).sort(compareModelEntries);
  for (const m of visible) {
    const key = `${m.provider}:${m.id}`;
    nameMap.set(key, m.name);
    thinkingLevels[key] = getSupportedThinkingLevels(m);
    if (m.thinkingLevelMap) thinkingLevelMaps[key] = m.thinkingLevelMap;
  }

  const defaultProvider = settings.getDefaultProvider();
  const defaultModelId = settings.getDefaultModel();
  const initial = selectInitialModelScope(scope, {
    ...(defaultProvider && defaultModelId
      ? { defaultModel: { provider: defaultProvider, modelId: defaultModelId } }
      : {}),
  });
  if (initial.model) {
    defaultModel = { provider: initial.model.provider, modelId: initial.model.id };
  }

  return withModelRuntimeError(
    {
      models: Object.fromEntries(nameMap),
      modelList,
      defaultModel,
      thinkingLevels,
      thinkingLevelMaps,
      thinkingLevelPins,
      ...(warnings.length > 0 ? { modelScopeWarnings: warnings } : {}),
    },
    modelError,
  );
}

const EMPTY_MODELS: ModelsData = {
  models: {},
  modelList: [],
  defaultModel: null,
  thinkingLevels: {},
  thinkingLevelMaps: {},
  thinkingLevelPins: {},
};

/** GET /api/models?cwd= */
export async function modelsGet(requestedCwd: string | null): Promise<StatusBody> {
  const cwd = resolve(requestedCwd || process.cwd());

  let cwdStat;
  try {
    cwdStat = await stat(cwd);
  } catch {
    return { status: 400, body: { error: `Directory does not exist: ${cwd}` } };
  }
  if (!cwdStat.isDirectory()) {
    return { status: 400, body: { error: `Not a directory: ${cwd}` } };
  }
  const allowedRoots = await getAllowedFileRoots();
  if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
    return { status: 403, body: { error: "Access denied" } };
  }

  try {
    return { status: 200, body: await loadModelsWithCache(cwd, () => loadModels(cwd)) as unknown as Record<string, unknown> };
  } catch {
    return { status: 200, body: withSafeModelLoadFailure(EMPTY_MODELS) as unknown as Record<string, unknown> };
  }
}

/** GET /api/models-config */
export function modelsConfigGet(): Record<string, unknown> {
  return readModelsConfig() as unknown as Record<string, unknown>;
}

/** PUT /api/models-config */
export function modelsConfigPut(body: Record<string, unknown>): StatusBody {
  try {
    writeModelsConfig(body);
    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}

// ---------------------------------------------------------------------------
// models-config/test
// ---------------------------------------------------------------------------

const TEST_TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/** POST /api/models-config/test */
export async function modelsTest(body: Record<string, unknown>): Promise<StatusBody> {
  let tempDir: string | undefined;
  try {
    const providerName = typeof body.providerName === "string" ? body.providerName.trim() : "";
    if (!providerName) return { status: 400, body: { ok: false, error: "providerName is required" } };
    if (!isRecord(body.provider)) return { status: 400, body: { ok: false, error: "provider is required" } };
    if (!isRecord(body.model)) return { status: 400, body: { ok: false, error: "model is required" } };

    const modelId = typeof body.model.id === "string" ? (body.model.id as string).trim() : "";
    if (!modelId) return { status: 400, body: { ok: false, error: "Model ID is required" } };

    tempDir = mkdtempSync(join(tmpdir(), "pi-web-model-test-"));
    const modelsPath = join(tempDir, "models.json");
    writeFileSync(modelsPath, JSON.stringify({
      providers: {
        [providerName]: {
          ...body.provider,
          models: [{ ...body.model, id: modelId }],
        },
      },
    }, null, 2), "utf8");

    const modelRuntime = await ModelRuntime.create({ modelsPath });
    const loadError = modelRuntime.getError();
    if (loadError) return { status: 200, body: { ok: false, error: loadError } };

    const model = modelRuntime.getModel(providerName, modelId);
    if (!model) return { status: 200, body: { ok: false, error: `Model not found: ${providerName}/${modelId}` } };

    const resolved = await modelRuntime.getAuth(model);
    if (!resolved?.auth.apiKey) {
      return { status: 200, body: { ok: false, error: `No API key found for "${providerName}"` } };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
    let status: number | undefined;
    const startedAt = Date.now();

    try {
      const message = await completeSimple(model, {
        messages: [{
          role: "user",
          content: "Reply with OK only.",
          timestamp: Date.now(),
        }],
      }, {
        apiKey: resolved.auth.apiKey,
        headers: resolved.auth.headers,
        maxTokens: 16,
        timeoutMs: TEST_TIMEOUT_MS,
        maxRetries: 0,
        cacheRetention: "none",
        signal: controller.signal,
        onResponse: (response) => { status = response.status; },
      });

      const latencyMs = Date.now() - startedAt;
      if (message.stopReason === "error" || message.stopReason === "aborted") {
        return {
          status: 200,
          body: {
            ok: false,
            error: message.errorMessage ?? (controller.signal.aborted ? "Test timed out" : "Model returned an error"),
            latencyMs,
            status,
          },
        };
      }

      return {
        status: 200,
        body: {
          ok: true,
          latencyMs,
          status,
          responseText: getAssistantText(message).slice(0, 300),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return { status: 500, body: { ok: false, error: error instanceof Error ? error.message : String(error) } };
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// models-config/discover
// ---------------------------------------------------------------------------

const DISCOVERY_TIMEOUT_MS = 20_000;

function hasHeader(headers: Headers, name: string): boolean {
  return headers.has(name);
}

function buildHeaders(api: string, apiKey: string | undefined, configured: Record<string, string>): Headers {
  const headers = new Headers(configured);
  if (!hasHeader(headers, "accept")) headers.set("Accept", "application/json");
  if (!apiKey) return headers;

  if (api === "anthropic-messages") {
    if (!hasHeader(headers, "x-api-key")) headers.set("x-api-key", apiKey);
    if (!hasHeader(headers, "anthropic-version")) headers.set("anthropic-version", "2023-06-01");
  } else if (api === "google-generative-ai") {
    if (!hasHeader(headers, "x-goog-api-key")) headers.set("x-goog-api-key", apiKey);
  } else if (!hasHeader(headers, "authorization")) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  return headers;
}

/** POST /api/models-config/discover */
export async function modelsDiscover(body: Record<string, unknown>): Promise<StatusBody> {
  try {
    const providerName = typeof body.providerName === "string" ? body.providerName.trim() : "";
    if (!providerName) return { status: 400, body: { error: "providerName is required" } };
    if (!isRecord(body.provider)) return { status: 400, body: { error: "provider is required" } };

    const provider = body.provider as { baseUrl?: unknown; apiKey?: unknown; api?: unknown; [key: string]: unknown };
    const baseUrl = typeof provider.baseUrl === "string" ? provider.baseUrl.trim() : "";
    if (!baseUrl) return { status: 400, body: { error: "Base URL is required" } };
    const api = typeof provider.api === "string" && provider.api ? provider.api : "openai-completions";

    let endpoint: URL;
    try {
      endpoint = buildModelsListUrl(baseUrl, api);
    } catch {
      return { status: 400, body: { error: "Base URL is invalid" } };
    }

    const auth = await resolveModelDiscoveryAuth(providerName, provider);
    if (typeof provider.apiKey === "string" && provider.apiKey.trim() && !auth.apiKey) {
      return { status: 400, body: { error: `No API key found for "${providerName}"` } };
    }

    const response = await fetch(endpoint, {
      headers: buildHeaders(api, auth.apiKey, auth.headers),
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
    const responseText = await response.text();
    if (!response.ok) {
      return {
        status: 502,
        body: {
          error: responseText.slice(0, 500) || `Upstream returned HTTP ${response.status}`,
          status: response.status,
        },
      };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return { status: 502, body: { error: "Upstream model list was not valid JSON" } };
    }
    const models = parseDiscoveredModels(payload);
    if (models.length === 0) {
      return { status: 502, body: { error: "No models found in the upstream response" } };
    }

    return { status: 200, body: { models, endpoint: endpoint.toString() } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof DOMException && error.name === "TimeoutError" ? 504 : 500;
    return { status, body: { error: message } };
  }
}

// ---------------------------------------------------------------------------
// models-config/catalog
// ---------------------------------------------------------------------------

const MODELS_DEV_URL = "https://models.dev/api.json";
const CATALOG_TTL_MS = 60 * 60 * 1000;
const CATALOG_FETCH_TIMEOUT_MS = 15_000;

interface CatalogCache {
  entries: ModelCatalogEntry[];
  expiresAt: number;
  inFlight?: Promise<ModelCatalogEntry[]>;
}

declare global {
  var __piModelsDevCatalogCache: CatalogCache | undefined;
}

function getCatalogCache(): CatalogCache {
  return globalThis.__piModelsDevCatalogCache ??= { entries: [], expiresAt: 0 };
}

async function fetchCatalog(): Promise<ModelCatalogEntry[]> {
  const response = await fetch(MODELS_DEV_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`models.dev returned HTTP ${response.status}`);
  const entries = flattenModelsDevCatalog(await response.json());
  if (entries.length === 0) throw new Error("models.dev returned an empty catalog");
  return entries;
}

async function loadCatalog(): Promise<ModelCatalogEntry[]> {
  const cache = getCatalogCache();
  if (cache.entries.length > 0 && cache.expiresAt > Date.now()) return cache.entries;
  if (!cache.inFlight) {
    cache.inFlight = fetchCatalog().then((entries) => {
      cache.entries = entries;
      cache.expiresAt = Date.now() + CATALOG_TTL_MS;
      return entries;
    }).finally(() => {
      cache.inFlight = undefined;
    });
  }
  try {
    return await cache.inFlight;
  } catch (error) {
    if (cache.entries.length > 0) return cache.entries;
    throw error;
  }
}

/** GET /api/models-config/catalog?q=&provider=&limit= */
export async function modelsCatalog(query: string, provider: string, limit: number, baseUrl = ""): Promise<StatusBody> {
  try {
    const entries = await loadCatalog();
    const models = searchModelCatalog(entries, query, provider, limit);
    const recommendation = recommendModelCatalogPreset(entries, query, provider, baseUrl);
    return { status: 200, body: { models, recommendation, source: MODELS_DEV_URL } };
  } catch (error) {
    return { status: 502, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

/** GET /api/auth/providers */
export async function authProviders(): Promise<Record<string, unknown>> {
  const modelRuntime = await ModelRuntime.create();
  const providers = buildOAuthProviderList(await collectProviderListingInputs(modelRuntime));
  return { providers };
}

/** GET /api/auth/all-providers */
export async function authAllProviders(): Promise<Record<string, unknown>> {
  const modelRuntime = await ModelRuntime.create();
  const providers = buildApiKeyProviderList(await collectProviderListingInputs(modelRuntime));
  return { providers };
}

/** GET /api/auth/api-key/[provider] */
export async function apiKeyStatus(provider: string): Promise<StatusBody> {
  const modelRuntime = await ModelRuntime.create();
  const status = modelRuntime.getProviderAuthStatus(provider);
  const displayName = modelRuntime.getProvider(provider)?.name ?? provider;
  const models = modelRuntime.getModels(provider).length;
  return { status: 200, body: { provider, displayName, configured: status.configured, source: status.source, models } };
}

/** POST /api/auth/api-key/[provider] { apiKey } */
export async function apiKeySet(provider: string, apiKey: unknown): Promise<StatusBody> {
  try {
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return { status: 400, body: { error: "apiKey is required" } };
    }
    const modelRuntime = await ModelRuntime.create();
    const apiKeyAuth = modelRuntime.getProvider(provider)?.auth.apiKey;
    if (!apiKeyAuth?.login) {
      throw new Error(`${provider} does not support API key login`);
    }
    let keySubmitted = false;
    const credential = await apiKeyAuth.login({
      signal: new AbortController().signal,
      notify: () => {},
      prompt: async (prompt) => {
        if (prompt.type === "select") {
          const keyOption = prompt.options.find((option) => option.id === "api-key" || option.id === "bearer-token");
          if (keyOption) return keyOption.id;
          throw new Error(`${provider} requires interactive authentication setup`);
        }
        if (!keySubmitted && prompt.type === "secret") {
          keySubmitted = true;
          return apiKey.trim();
        }
        throw new Error(`${provider} requires additional authentication settings`);
      },
    });
    await storeProviderCredential(provider, credential);
    invalidateModelsCache();
    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}

/** DELETE /api/auth/api-key/[provider] */
export async function apiKeyDelete(provider: string): Promise<StatusBody> {
  try {
    const removal = await removeStoredCredentialIfType(provider, "api_key");
    if (removal.status === "type_mismatch") {
      return { status: 409, body: { error: `${provider} is authenticated with OAuth, not an API key` } };
    }
    invalidateModelsCache();
    return { status: 200, body: { success: true } };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}

/** POST /api/auth/logout/[provider] */
export async function authLogout(provider: string): Promise<StatusBody> {
  const modelRuntime = await ModelRuntime.create();
  if (!modelRuntime.getProvider(provider)?.auth.oauth) {
    return { status: 400, body: { error: `Unknown provider: ${provider}` } };
  }
  const removal = await removeStoredCredentialIfType(provider, "oauth");
  if (removal.status === "type_mismatch") {
    return { status: 409, body: { error: `${provider} is authenticated with an API key, not OAuth` } };
  }
  invalidateModelsCache();
  return { status: 200, body: { ok: true } };
}

// ---------------------------------------------------------------------------
// auth login (push channel replaces SSE)
// ---------------------------------------------------------------------------

// In-memory registry: loginToken -> resolve/reject for the manualCodeInput promise
declare global {
  var __piLoginCallbacks: Map<string, { resolve: (v: string) => void; reject: (e: Error) => void }> | undefined;
}

function getCallbackRegistry() {
  if (!globalThis.__piLoginCallbacks) globalThis.__piLoginCallbacks = new Map();
  return globalThis.__piLoginCallbacks;
}

/** POST /api/auth/login/[provider] (manual code reply) */
export async function authLoginCode(provider: string, token: string, code: string): Promise<StatusBody> {
  if (!token || !code) {
    return { status: 400, body: { error: "token and code required" } };
  }
  const registry = getCallbackRegistry();
  const callbacks = registry.get(token);
  if (!callbacks) {
    return { status: 404, body: { error: "No pending login for token" } };
  }
  if (!token.startsWith(`${provider}-`)) {
    return { status: 400, body: { error: "Token does not match provider" } };
  }
  callbacks.resolve(code);
  registry.delete(token);
  return { status: 200, body: { ok: true, provider } };
}

export type AuthLoginFrame = { event: string; data: Record<string, unknown> };

/**
 * Port of the login SSE stream as a push session. Frames carry the same
 * payload shapes the renderer already handles (auth/prompt_request/
 * select_request/device_code/progress/success/cancelled/error).
 */
export async function authLoginStart(
  provider: string,
  push: (frame: AuthLoginFrame) => void,
  registerCleanup: (cleanup: () => void) => void,
): Promise<void> {
  const modelRuntime = await ModelRuntime.create();
  if (!modelRuntime.getProvider(provider)?.auth.oauth) {
    push({ event: "error", data: { type: "error", message: `Unknown provider: ${provider}` } });
    return;
  }

  const registry = getCallbackRegistry();
  const activeTokens = new Set<string>();
  let pendingManualRequest: { token: string; promise: Promise<string> } | undefined;

  const createClientInputRequest = () => {
    const token = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeTokens.add(token);

    const promise = new Promise<string>((resolvePromise, rejectPromise) => {
      registry.set(token, {
        resolve: (value) => {
          activeTokens.delete(token);
          registry.delete(token);
          resolvePromise(value);
        },
        reject: (error) => {
          activeTokens.delete(token);
          registry.delete(token);
          rejectPromise(error);
        },
      });
    });

    return { token, promise };
  };

  const getManualInputRequest = () => {
    if (!pendingManualRequest) {
      pendingManualRequest = createClientInputRequest();
      pendingManualRequest.promise
        .finally(() => {
          pendingManualRequest = undefined;
        })
        .catch(() => {});
    }
    return pendingManualRequest;
  };

  const cleanup = () => {
    for (const token of activeTokens) {
      registry.get(token)?.reject(new Error("Login cancelled"));
      registry.delete(token);
    }
    activeTokens.clear();
  };
  registerCleanup(cleanup);

  const abort = new AbortController();
  abort.signal.addEventListener("abort", cleanup);
  registerCleanup(() => abort.abort());

  try {
    await modelRuntime.login(provider, "oauth", {
      prompt: async (prompt: AuthPrompt) => {
        const request = prompt.type === "manual_code"
          ? getManualInputRequest()
          : createClientInputRequest();
        if (prompt.type === "select") {
          push({
            event: "select_request",
            data: {
              type: "select_request",
              message: prompt.message,
              options: prompt.options,
              token: request.token,
            },
          });
        } else {
          push({
            event: "prompt_request",
            data: {
              type: "prompt_request",
              message: prompt.message,
              placeholder: prompt.placeholder ?? null,
              token: request.token,
            },
          });
        }
        return request.promise;
      },
      notify: (event: AuthEvent) => {
        if (event.type === "auth_url") {
          const request = getManualInputRequest();
          push({
            event: "auth",
            data: {
              type: "auth",
              url: event.url,
              instructions: event.instructions ?? null,
              token: request.token,
            },
          });
        } else if (event.type === "device_code") {
          push({
            event: "device_code",
            data: {
              type: "device_code",
              userCode: event.userCode,
              verificationUri: event.verificationUri,
              intervalSeconds: event.intervalSeconds ?? null,
              expiresInSeconds: event.expiresInSeconds ?? null,
            },
          });
        } else {
          push({ event: "progress", data: { type: "progress", message: event.message } });
        }
      },
      signal: abort.signal,
    });

    invalidateModelsCache();
    push({ event: "success", data: { type: "success" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg !== "Login cancelled") {
      push({ event: "error", data: { type: "error", message: msg } });
    } else {
      push({ event: "cancelled", data: { type: "cancelled" } });
    }
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// app-update — GitHub Releases source (spec Q13)
// ---------------------------------------------------------------------------

const RELEASES_LATEST_URL = "https://api.github.com/repos/looluo/pi-agent2/releases/latest";
const UPDATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const UPDATE_FETCH_TIMEOUT_MS = 5_000;

interface AppUpdateCache {
  value?: Record<string, unknown>;
  expiresAt: number;
  inFlight?: Promise<Record<string, unknown>>;
}

declare global {
  var __piAppUpdateCache: AppUpdateCache | undefined;
}

function getUpdateCache(): AppUpdateCache {
  return globalThis.__piAppUpdateCache ??= { expiresAt: 0 };
}

async function fetchLatestRelease(): Promise<Record<string, unknown>> {
  const response = await fetch(RELEASES_LATEST_URL, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(UPDATE_FETCH_TIMEOUT_MS),
  });
  if (response.status === 404) {
    // No releases published yet — report up-to-date instead of erroring.
    return { currentVersion: app.getVersion(), latestVersion: "", updateAvailable: false, releaseUrl: null };
  }
  if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`);

  const body = await response.json() as { tag_name?: unknown; html_url?: unknown };
  const tag = typeof body.tag_name === "string" ? body.tag_name.replace(/^v/, "") : "";
  const releaseUrl = typeof body.html_url === "string" ? body.html_url : null;
  if (!tag) throw new Error("Release has no tag_name");

  return {
    currentVersion: app.getVersion(),
    latestVersion: tag,
    updateAvailable: isNewerStableVersion(tag, app.getVersion()),
    releaseUrl: releaseUrl ?? getPiWebReleaseUrl(tag),
  };
}

export async function appUpdateStatus(): Promise<StatusBody> {
  const cache = getUpdateCache();
  if (cache.value && cache.expiresAt > Date.now()) return { status: 200, body: cache.value };
  if (!cache.inFlight) {
    cache.inFlight = fetchLatestRelease().then((value) => {
      cache.value = value;
      cache.expiresAt = Date.now() + UPDATE_CACHE_TTL_MS;
      return value;
    }).finally(() => {
      cache.inFlight = undefined;
    });
  }
  try {
    return { status: 200, body: await cache.inFlight };
  } catch (error) {
    if (cache.value) return { status: 200, body: cache.value };
    return { status: 502, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
