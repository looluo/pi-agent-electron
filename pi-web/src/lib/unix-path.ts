/**
 * PATH repair helpers for GUI launches (macOS).
 *
 * When the packaged app is opened from Finder/Dock, the main process
 * inherits launchd's minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) instead
 * of the user's shell PATH. Spawning `npm` (plugin install/update), `git`,
 * and other tools then fails with ENOENT. These helpers rebuild a usable
 * PATH: a synchronous static list of well-known tool directories plus an
 * optional login-shell capture (nvm/pnpm/volta setups configure PATH only
 * in shell init files).
 */

/** Order-preserving union of `:`-separated PATH entries: entries from
 *  `extra` that are missing in `current` are appended at the end. Existing
 *  order is never changed, so nothing already on PATH gets shadowed. */
export function mergePathEntries(current: string, extra: string): string {
  const merged = current.split(":").filter(Boolean);
  const seen = new Set(merged);
  for (const entry of extra.split(":")) {
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    merged.push(entry);
  }
  return merged.join(":");
}

/** Well-known macOS tool directories, in priority order. Filtered by the
 *  caller for existence before merging (cheap stat, keeps PATH clean). */
export function staticMacToolDirs(homedir: string): string[] {
  return [
    "/opt/homebrew/bin", // Apple Silicon Homebrew (node, npm, git, …)
    "/opt/homebrew/sbin",
    "/usr/local/bin", // Intel Homebrew + installer default prefix
    `${homedir}/.volta/bin`, // volta
    `${homedir}/Library/pnpm`, // pnpm standalone (`pnpm setup`)
  ];
}

/** Extract the PATH line from `env` output of a login shell. Takes the last
 *  match (profile noise may echo earlier `PATH=` lines); tolerates banners
 *  around it. Returns null when no plausible PATH is present. */
export function parseShellEnvPath(envOutput: string): string | null {
  const matches = envOutput.match(/^PATH=(.*)$/gm);
  if (!matches) return null;
  const path = matches[matches.length - 1].slice("PATH=".length).trim();
  if (!path || !path.includes("/")) return null;
  return path;
}
