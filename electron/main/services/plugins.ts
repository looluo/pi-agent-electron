import { existsSync, readFileSync, statSync } from "fs";
import { basename, dirname, extname, join, relative, sep } from "path";
import {
  DefaultPackageManager,
  getAgentDir,
  SettingsManager,
  type PackageSource,
  type ResolvedPaths,
  type ResolvedResource,
} from "@earendil-works/pi-coding-agent";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import { checkPluginUpdates, isPluginSourceCheckable } from "@/lib/plugin-updates";
import { getProjectTrustStatus } from "@/lib/project-trust";
import { waitForPathRepair } from "./shell-path";
import type {
  PluginDiagnostic,
  PluginPackageInfo,
  PluginResourceCounts,
  PluginResourceInfo,
  PluginResourceKind,
  PluginScope,
  PluginStandaloneExtensionInfo,
  PluginsResponse,
} from "@/lib/api-types";

type PluginAction = "install" | "remove" | "update" | "disable" | "enable";

function emptyCounts(): PluginResourceCounts {
  return { extensions: 0, skills: 0, prompts: 0, themes: 0 };
}

function toPluginScope(scope: string): PluginScope {
  return scope === "project" ? "project" : "global";
}

function keyFor(source: string, scope: PluginScope): string {
  return `${scope}\0${source}`;
}

function getPackageSource(entry: PackageSource): string {
  return typeof entry === "string" ? entry : entry.source;
}

function isDisabledPackage(entry: PackageSource): boolean {
  if (typeof entry === "string") return false;
  return (
    Array.isArray(entry.extensions) && entry.extensions.length === 0 &&
    Array.isArray(entry.skills) && entry.skills.length === 0 &&
    Array.isArray(entry.prompts) && entry.prompts.length === 0 &&
    Array.isArray(entry.themes) && entry.themes.length === 0
  );
}

function getDisabledPackages(settingsManager: SettingsManager): Map<string, boolean> {
  const disabled = new Map<string, boolean>();
  for (const entry of settingsManager.getGlobalSettings().packages ?? []) {
    disabled.set(keyFor(getPackageSource(entry), "global"), isDisabledPackage(entry));
  }
  for (const entry of settingsManager.getProjectSettings().packages ?? []) {
    disabled.set(keyFor(getPackageSource(entry), "project"), isDisabledPackage(entry));
  }
  return disabled;
}

function setPackageDisabled(
  settingsManager: SettingsManager,
  source: string,
  scope: PluginScope,
  disabled: boolean,
): boolean {
  const current = scope === "project"
    ? settingsManager.getProjectSettings().packages ?? []
    : settingsManager.getGlobalSettings().packages ?? [];
  let changed = false;
  const next = current.map((entry): PackageSource => {
    if (getPackageSource(entry) !== source) return entry;
    changed = true;
    if (disabled) {
      return {
        ...(typeof entry === "string" ? { source: entry } : entry),
        extensions: [],
        skills: [],
        prompts: [],
        themes: [],
      };
    }
    return getPackageSource(entry);
  });
  if (!changed) return false;
  if (scope === "project") settingsManager.setProjectPackages(next);
  else settingsManager.setPackages(next);
  return true;
}

function addCount(counts: PluginResourceCounts, kind: keyof PluginResourceCounts): void {
  counts[kind] += 1;
}

function getResourceName(path: string, kind: PluginResourceKind): string {
  const file = basename(path);
  const ext = extname(file);
  if (kind === "skill" && file.toLowerCase() === "skill.md") return basename(dirname(path));
  if ((kind === "extension" || kind === "theme" || kind === "prompt") && ext) {
    if (kind === "extension" && /^index\.(ts|js)$/.test(file)) return basename(dirname(path));
    return file.slice(0, -ext.length);
  }
  return file;
}

function getRelativePath(resource: ResolvedResource): string {
  const baseDir = resource.metadata.baseDir;
  if (!baseDir) return resource.path;
  const rel = relative(baseDir, resource.path);
  // Normalize to forward slashes so API output is stable across platforms
  // (Node's path.relative returns backslashes on Windows).
  return rel && !rel.startsWith("..") ? rel.split(sep).join("/") : resource.path;
}

function getConfiguredVersion(source: string): string | undefined {
  const npmSpec = source.startsWith("npm:") ? source.slice(4) : undefined;
  if (npmSpec) {
    const lastAt = npmSpec.lastIndexOf("@");
    const packageNameEnd = npmSpec.startsWith("@") ? npmSpec.indexOf("/", 1) : 0;
    if (lastAt > packageNameEnd) return npmSpec.slice(lastAt + 1) || undefined;
    return undefined;
  }

  if (source.startsWith("git:") || /^[a-z]+:\/\//.test(source)) {
    const lastAt = source.lastIndexOf("@");
    const lastSlash = source.lastIndexOf("/");
    const lastColon = source.lastIndexOf(":");
    if (lastAt > Math.max(lastSlash, lastColon)) return source.slice(lastAt + 1) || undefined;
  }
  return undefined;
}

function readPackageMetadata(installedPath?: string): { packageName?: string; version?: string; description?: string } {
  if (!installedPath) return {};
  try {
    const stats = statSync(installedPath);
    const packageJsonPath = stats.isDirectory()
      ? join(installedPath, "package.json")
      : join(dirname(installedPath), "package.json");
    if (!existsSync(packageJsonPath)) return {};
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
      version?: unknown;
      description?: unknown;
    };
    return {
      packageName: typeof parsed.name === "string" ? parsed.name : undefined,
      version: typeof parsed.version === "string" ? parsed.version : undefined,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
    };
  } catch {
    return {};
  }
}

function toResourceInfo(resource: ResolvedResource, kind: PluginResourceKind): PluginResourceInfo {
  return {
    kind,
    name: getResourceName(resource.path, kind),
    path: resource.path,
    relativePath: getRelativePath(resource),
  };
}

function collectResource(
  resource: ResolvedResource,
  kind: keyof PluginResourceCounts,
  countsByPackage: Map<string, PluginResourceCounts>,
  resourcesByPackage: Map<string, PluginResourceInfo[]>,
  totals: PluginResourceCounts,
): void {
  if (!resource.enabled || resource.metadata.origin !== "package") return;
  const source = resource.metadata.source;
  const scope = toPluginScope(resource.metadata.scope);
  const key = keyFor(source, scope);
  const counts = countsByPackage.get(key) ?? emptyCounts();
  addCount(counts, kind);
  addCount(totals, kind);
  countsByPackage.set(key, counts);
  const resources = resourcesByPackage.get(key) ?? [];
  const resourceKind = kind === "extensions"
    ? "extension"
    : kind === "skills"
      ? "skill"
      : kind === "prompts"
        ? "prompt"
        : "theme";
  resources.push(toResourceInfo(resource, resourceKind));
  resourcesByPackage.set(key, resources);
}

function collectResources(paths: ResolvedPaths): {
  countsByPackage: Map<string, PluginResourceCounts>;
  resourcesByPackage: Map<string, PluginResourceInfo[]>;
  standaloneExtensions: PluginStandaloneExtensionInfo[];
  totals: PluginResourceCounts;
} {
  const countsByPackage = new Map<string, PluginResourceCounts>();
  const resourcesByPackage = new Map<string, PluginResourceInfo[]>();
  const totals = emptyCounts();
  for (const resource of paths.extensions) collectResource(resource, "extensions", countsByPackage, resourcesByPackage, totals);
  for (const resource of paths.skills) collectResource(resource, "skills", countsByPackage, resourcesByPackage, totals);
  for (const resource of paths.prompts) collectResource(resource, "prompts", countsByPackage, resourcesByPackage, totals);
  for (const resource of paths.themes) collectResource(resource, "themes", countsByPackage, resourcesByPackage, totals);
  const standaloneExtensions = paths.extensions
    .filter((resource) => resource.metadata.origin === "top-level")
    .map((resource): PluginStandaloneExtensionInfo => ({
      ...toResourceInfo(resource, "extension"),
      kind: "extension",
      scope: toPluginScope(resource.metadata.scope),
      enabled: resource.enabled,
    }));
  totals.extensions += standaloneExtensions.filter((extension) => extension.enabled).length;
  return { countsByPackage, resourcesByPackage, standaloneExtensions, totals };
}

async function readPlugins(cwd: string): Promise<PluginsResponse> {
  const agentDir = getAgentDir();
  const projectTrust = getProjectTrustStatus(cwd, agentDir);
  const settingsManager = SettingsManager.create(cwd, agentDir, {
    projectTrusted: projectTrust.trusted,
  });
  const packageManager = new DefaultPackageManager({
    cwd,
    agentDir,
    settingsManager,
  });

  const diagnostics: PluginDiagnostic[] = [];
  let countsByPackage = new Map<string, PluginResourceCounts>();
  let resourcesByPackage = new Map<string, PluginResourceInfo[]>();
  let standaloneExtensions: PluginStandaloneExtensionInfo[] = [];
  let totals = emptyCounts();
  const disabledByPackage = getDisabledPackages(settingsManager);

  try {
    const resolved = await packageManager.resolve(async (source) => {
      diagnostics.push({
        type: "warning",
        source,
        message: "Package is configured but not installed yet.",
      });
      return "skip";
    });
    ({ countsByPackage, resourcesByPackage, standaloneExtensions, totals } = collectResources(resolved));
  } catch (error) {
    diagnostics.push({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const packages = packageManager.listConfiguredPackages().map((pkg) => {
    const scope = toPluginScope(pkg.scope);
    const key = keyFor(pkg.source, scope);
    const disabled = disabledByPackage.get(key) ?? false;
    const counts = countsByPackage.get(key) ?? emptyCounts();
    const resources = resourcesByPackage.get(key) ?? [];
    const resourceCount = counts.extensions + counts.skills + counts.prompts + counts.themes;
    const packageMetadata = readPackageMetadata(pkg.installedPath);
    if (!pkg.installedPath) {
      diagnostics.push({
        type: "warning",
        source: pkg.source,
        message: "Configured package path was not found.",
      });
    }
    return {
      source: pkg.source,
      scope,
      canCheckForUpdates: isPluginSourceCheckable(pkg.source),
      filtered: pkg.filtered,
      disabled,
      installedPath: pkg.installedPath,
      packageName: packageMetadata.packageName,
      version: packageMetadata.version,
      configuredVersion: getConfiguredVersion(pkg.source),
      description: packageMetadata.description,
      counts,
      resources,
      status: disabled ? "disabled" : resourceCount > 0 ? "loaded" : pkg.installedPath ? "installed" : "missing",
    } satisfies PluginPackageInfo;
  });

  return {
    packages,
    standaloneExtensions,
    totals,
    diagnostics,
    projectResourcesLoaded: projectTrust.trusted,
  };
}

function readScope(scope: unknown): PluginScope {
  return scope === "project" ? "project" : "global";
}

export async function pluginsList(cwd: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!cwd) return { status: 400, body: { error: "cwd required" } };

  try {
    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }
    return { status: 200, body: await readPlugins(cwd) as unknown as Record<string, unknown> };
  } catch (error) {
    return { status: 500, body: { error: String(error) } };
  }
}

// POST /api/plugins body: { action, source?, scope?, cwd }
/** Port of the upstream bulk toggle (eceac13 route): disable or re-enable
 *  the given packages of one scope with a single settings write. Returns the
 *  sources that scope does not configure, and with `keepEntrySettings` the
 *  ones left enabled because disabling would drop their filters. */
function setPackagesDisabled(
  settingsManager: SettingsManager,
  sources: readonly string[],
  scope: PluginScope,
  disabled: boolean,
  { keepEntrySettings = false }: { keepEntrySettings?: boolean } = {},
): { missing: Set<string>; kept: Set<string> } {
  const current = scope === "project"
    ? settingsManager.getProjectSettings().packages ?? []
    : settingsManager.getGlobalSettings().packages ?? [];
  const missing = new Set(sources);
  const kept = new Set<string>();
  let changed = false;
  const next = current.map((entry): PackageSource => {
    const source = getPackageSource(entry);
    if (!sources.includes(source)) return entry;
    missing.delete(source);
    if (isDisabledPackage(entry) === disabled) return entry;
    if (disabled && keepEntrySettings && hasEntrySettings(entry)) {
      kept.add(source);
      return entry;
    }
    changed = true;
    if (disabled) {
      return {
        ...(typeof entry === "string" ? { source: entry } : entry),
        extensions: [],
        skills: [],
        prompts: [],
        themes: [],
      };
    }
    if (typeof entry === "string") return source;
    const rest = { ...entry };
    delete rest.extensions;
    delete rest.skills;
    delete rest.prompts;
    delete rest.themes;
    return Object.keys(rest).length > 1 ? rest : source;
  });
  if (changed) {
    if (scope === "project") settingsManager.setProjectPackages(next);
    else settingsManager.setPackages(next);
  }
  return { missing, kept };
}

/** An enabled entry that is an object: it filters the package's resources, or
 *  sets `autoload`. Disabling replaces its resource lists, and Pi Web keeps no
 *  copy, so enabling it again cannot bring the filters back. */
function hasEntrySettings(entry: PackageSource): boolean {
  return typeof entry === "object" && !isDisabledPackage(entry);
}

const FILTERED_PACKAGE_ERROR =
  "Has resource filters, which disabling would remove; use the package's own switch";

/** The bulk form of enable/disable behind the panel's "Enable all" /
 *  "Disable all": one result per package, so one refusal (untrusted project,
 *  removed package, filtered package) does not stop the rest. */
async function setPackageListDisabled(
  settingsManager: SettingsManager,
  packages: readonly { source: string; scope: PluginScope }[],
  disabled: boolean,
  projectTrusted: boolean,
): Promise<{ source: string; scope: PluginScope; error?: string }[]> {
  const errors = new Map<string, string>();
  for (const scope of ["global", "project"] as const) {
    const sources = packages.filter((pkg) => pkg.scope === scope).map((pkg) => pkg.source);
    if (sources.length === 0) continue;
    if (scope === "project" && !projectTrusted) {
      for (const source of sources) {
        errors.set(keyFor(source, scope), "Project resources must be trusted before modifying project plugins");
      }
      continue;
    }
    // "Disable all" must not wipe filters the operator set up by hand.
    const { missing, kept } = setPackagesDisabled(settingsManager, sources, scope, disabled, {
      keepEntrySettings: true,
    });
    for (const source of missing) errors.set(keyFor(source, scope), "Package is not configured");
    for (const source of kept) errors.set(keyFor(source, scope), FILTERED_PACKAGE_ERROR);
  }
  await settingsManager.flush();
  const settingsErrors = new Map<string, string>();
  for (const { scope, path, error } of settingsManager.drainErrors()) {
    if (!settingsErrors.has(scope)) settingsErrors.set(scope, path ? `${path}: ${error.message}` : error.message);
  }
  return packages.map((pkg) => {
    const error = settingsErrors.get(pkg.scope) ?? errors.get(keyFor(pkg.source, pkg.scope));
    return error ? { ...pkg, error } : { ...pkg };
  });
}

function readPackageList(value: unknown): { source: string; scope: PluginScope }[] | null {
  if (!Array.isArray(value)) return null;
  const packages = new Map<string, { source: string; scope: PluginScope }>();
  for (const item of value) {
    const source = typeof item?.source === "string" ? item.source.trim() : "";
    if (!source) return null;
    const scope = readScope(item.scope);
    packages.set(keyFor(source, scope), { source, scope });
  }
  return [...packages.values()];
}

export async function pluginsAction(body: {
  action?: PluginAction;
  source?: string;
  scope?: PluginScope;
  cwd?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    // install/update/remove spawn `npm`; do not race the startup PATH repair
    // (GUI launches: npm may only be reachable after the login-shell capture).
    await waitForPathRepair();
    if (!body.cwd) return { status: 400, body: { error: "cwd required" } };
    if (!body.action) return { status: 400, body: { error: "action required" } };
    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(body.cwd, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }

    const agentDir = getAgentDir();
    const projectTrust = getProjectTrustStatus(body.cwd, agentDir);
    const settingsManager = SettingsManager.create(body.cwd, agentDir, {
      projectTrusted: projectTrust.trusted,
    });
    const scope = readScope(body.scope);
    if (scope === "project" && !projectTrust.trusted) {
      return {
        status: 403,
        body: { error: "Project resources must be trusted before modifying project plugins" },
      };
    }
    const packageManager = new DefaultPackageManager({
      cwd: body.cwd,
      agentDir,
      settingsManager,
    });
    const source = body.source?.trim();
    const local = scope === "project";

    // Bulk enable/disable (upstream eceac13): one result per package.
    if (body.action === "enable" || body.action === "disable") {
      const packages = readPackageList((body as { packages?: unknown }).packages);
      if (!packages) return { status: 400, body: { error: "packages must be a list of {source, scope}" } };
      const results = await setPackageListDisabled(
        settingsManager,
        packages,
        body.action === "disable",
        projectTrust.trusted,
      );
      const plugins = await readPlugins(body.cwd) as unknown as Record<string, unknown>;
      return { status: 200, body: { ...plugins, results } };
    }

    if (body.action === "install") {
      if (!source) return { status: 400, body: { error: "source required" } };
      await packageManager.installAndPersist(source, { local });
    } else if (body.action === "remove") {
      if (!source) return { status: 400, body: { error: "source required" } };
      await packageManager.removeAndPersist(source, { local });
    } else if (body.action === "update") {
      if (!source && !projectTrust.trusted && packageManager.listConfiguredPackages().some((pkg) => pkg.scope === "project")) {
        return {
          status: 403,
          body: { error: "Project resources must be trusted before updating project plugins" },
        };
      }
      await packageManager.update(source);
    } else if (body.action === "disable") {
      if (!source) return { status: 400, body: { error: "source required" } };
      setPackageDisabled(settingsManager, source, scope, true);
      await settingsManager.flush();
    } else if (body.action === "enable") {
      if (!source) return { status: 400, body: { error: "source required" } };
      setPackageDisabled(settingsManager, source, scope, false);
      await settingsManager.flush();
    } else {
      return { status: 400, body: { error: `Unsupported action: ${body.action}` } };
    }

    return { status: 200, body: await readPlugins(body.cwd) as unknown as Record<string, unknown> };
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

/** Port of app/api/plugins/check (POST) — plugin update check. */
export async function pluginsCheck(body: {
  cwd?: string;
  source?: string;
  scope?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    // `npm view` below resolves Node from PATH; wait for the PATH repair.
    await waitForPathRepair();
    const cwd = typeof body.cwd === "string" ? body.cwd : "";
    if (!cwd) return { status: 400, body: { error: "cwd required" } };
    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }

    const source = typeof body.source === "string" ? body.source : undefined;
    const scope = body.scope === "global" || body.scope === "project" ? body.scope : undefined;
    if ((source && !scope) || (!source && scope)) {
      return { status: 400, body: { error: "source and scope must be provided together" } };
    }

    const updates = await checkPluginUpdates(cwd, source && scope ? { source, scope: scope as PluginScope } : undefined);
    if (source && scope && updates.length === 0) {
      return { status: 404, body: { error: "Configured package not found" } };
    }

    return { status: 200, body: { updates: updates as unknown as Record<string, unknown>[] } };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}
