import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { setDisableModelInvocation } from "@/lib/skill-frontmatter";
import type { SkillInstallScope, SkillSearchResult } from "@/lib/api-types";
import { loadSkillsWithInstallInfo } from "@/lib/skills-service";
import { getAllowedFileRoots, isExistingFilePathAllowed } from "@/lib/file-access";
import { runNpx } from "@/lib/npx";
import { getProjectTrustStatus } from "@/lib/project-trust";
import { checkSkillUpdates, buildSkillUpdateArgs } from "@/lib/skill-updates";

/**
 * Ports of app/api/skills/{route,check,install,search,update}.
 */

type StatusBody = { status: number; body: Record<string, unknown> };

const ANSI_RE = /\x1B\[[0-9;]*m/g;
const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;
const SEARCH_API_BASE = process.env.SKILLS_API_URL || "https://skills.sh";

interface SkillsApiSkill {
  id?: string;
  name?: string;
  source?: string;
  installs?: number;
}

interface SkillsApiResponse {
  skills?: SkillsApiSkill[];
}

function parseLimit(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(num)));
}

function formatInstalls(count?: number): string {
  if (!count || count <= 0) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M installs`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K installs`;
  return `${count} install${count === 1 ? "" : "s"}`;
}

function parseSearchOutput(raw: string): SkillSearchResult[] {
  const clean = raw.replace(ANSI_RE, "");
  const results: SkillSearchResult[] = [];
  const lines = clean.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const pkgMatch = line.match(/^([\w.\-]+\/[\w.\-@:]+)\s+([\d.,]+[KMB]?\s+installs)$/);
    if (pkgMatch) {
      const urlLine = lines[i + 1]?.trim().replace(/^└\s*/, "");
      results.push({
        package: pkgMatch[1],
        installs: pkgMatch[2],
        url: urlLine?.startsWith("https://") ? urlLine : "",
      });
    }
  }
  return results;
}

async function searchSkillsApi(query: string, limit: number): Promise<SkillSearchResult[]> {
  const url = `${SEARCH_API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`skills.sh search failed: HTTP ${res.status}`);

  const data = (await res.json()) as SkillsApiResponse;
  return (data.skills ?? [])
    .map((skill) => {
      const name = skill.name?.trim();
      const source = skill.source?.trim();
      const slug = skill.id?.trim();
      if (!name || (!source && !slug)) return null;

      const pkg = `${source || slug}@${name}`;
      return {
        package: pkg,
        installs: formatInstalls(skill.installs),
        url: slug ? `${SEARCH_API_BASE}/${slug}` : "",
      };
    })
    .filter((skill): skill is SkillSearchResult => skill !== null)
    .sort((a, b) => parseInstallCount(b.installs) - parseInstallCount(a.installs));
}

function parseInstallCount(installs: string): number {
  const match = installs.match(/^([\d.]+)([KMB])?\s+installs?$/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const multiplier = match[2] === "B" ? 1_000_000_000 : match[2] === "M" ? 1_000_000 : match[2] === "K" ? 1_000 : 1;
  return value * multiplier;
}

/** GET /api/skills?cwd= */
export async function skillsList(cwd: string | null): Promise<StatusBody> {
  if (!cwd) return { status: 400, body: { error: "cwd required" } };
  try {
    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }
    return { status: 200, body: await loadSkillsWithInstallInfo(cwd) as unknown as Record<string, unknown> };
  } catch (e) {
    return { status: 500, body: { error: String(e) } };
  }
}

/** PATCH /api/skills — surgical disable-model-invocation toggle. */
export async function skillsToggle(filePath: string, disableModelInvocation: boolean): Promise<StatusBody> {
  try {
    if (!filePath) return { status: 400, body: { error: "filePath required" } };
    if (!existsSync(filePath)) return { status: 404, body: { error: "file not found" } };
    const allowedRoots = new Set(await getAllowedFileRoots());
    allowedRoots.add(getAgentDir());
    // Globally installed skills live in ~/.agents/skills and are symlinked into
    // the agent's skills dir; isExistingFilePathAllowed resolves the symlink, so
    // the real target sits outside getAgentDir(). Allow the global skills root
    // too (the SDK always treats ~/.agents/skills as trusted).
    const globalSkillsDir = path.join(homedir(), ".agents", "skills");
    if (existsSync(globalSkillsDir)) allowedRoots.add(globalSkillsDir);
    if (!isExistingFilePathAllowed(filePath, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }

    const content = readFileSync(filePath, "utf8");
    const updated = setDisableModelInvocation(content, disableModelInvocation);
    writeFileSync(filePath, updated, "utf8");
    return { status: 200, body: { success: true } };
  } catch (e) {
    return { status: 500, body: { error: String(e) } };
  }
}

/** POST /api/skills/check */
export async function skillsCheck(body: Record<string, unknown>): Promise<StatusBody> {
  try {
    const cwd = typeof body.cwd === "string" ? body.cwd : "";
    if (!cwd) return { status: 400, body: { error: "cwd required" } };
    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }

    const pkg = typeof body.package === "string" ? body.package : undefined;
    const scope = body.scope === "global" || body.scope === "project"
      ? body.scope as SkillInstallScope
      : undefined;
    if ((pkg && !scope) || (!pkg && scope)) {
      return { status: 400, body: { error: "package and scope must be provided together" } };
    }

    const { skills } = await loadSkillsWithInstallInfo(cwd);
    const installs = skills
      .map((skill) => skill.install)
      .filter((install): install is NonNullable<typeof install> => Boolean(install))
      .filter((install) => !pkg || (install.package === pkg && install.scope === scope));

    if (pkg && installs.length === 0) {
      return { status: 404, body: { error: "Installed skill not found" } };
    }

    const updates = await checkSkillUpdates(installs, {
      githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    });
    return { status: 200, body: { updates } };
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}

/** POST /api/skills/install */
export async function skillsInstall(body: Record<string, unknown>): Promise<StatusBody> {
  try {
    const pkg = typeof body.package === "string" ? body.package : undefined;
    const scope = typeof body.scope === "string" ? body.scope : undefined;
    const cwd = typeof body.cwd === "string" ? body.cwd : undefined;
    if (!pkg?.trim()) return { status: 400, body: { error: "package required" } };

    const isGlobal = scope !== "project";
    if (!isGlobal) {
      if (!cwd) return { status: 400, body: { error: "cwd required for project install" } };
      const allowedRoots = await getAllowedFileRoots();
      if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
        return { status: 403, body: { error: "Access denied" } };
      }
      if (!getProjectTrusted(cwd)) {
        return {
          status: 403,
          body: { error: "Project resources must be trusted before installing project skills" },
        };
      }
    }
    const args = ["skills", "add", pkg.trim(), "-y", "--agent", "pi"];
    if (isGlobal) args.push("-g");

    const { stdout, stderr } = await runNpx(args, {
      timeout: 60000,
      cwd: !isGlobal && cwd ? cwd : undefined,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const output = (stdout + stderr).replace(ANSI_RE, "");
    const success = /Installation complete|Installed \d+ skill/.test(output);
    if (!success) {
      return { status: 500, body: { error: output.slice(-300) || "Install failed" } };
    }
    return { status: 200, body: { success: true, output } };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = ((err.stdout ?? "") + (err.stderr ?? "")).replace(ANSI_RE, "");
    return { status: 500, body: { error: output || (err.message ?? String(e)) } };
  }
}

function getProjectTrusted(cwd: string): boolean {
  return getProjectTrustStatus(cwd, getAgentDir()).trusted;
}

/** POST /api/skills/search */
export async function skillsSearch(query: string, rawLimit: unknown): Promise<StatusBody> {
  try {
    if (!query?.trim()) return { status: 400, body: { error: "query required" } };
    const limit = parseLimit(rawLimit);

    try {
      const results = await searchSkillsApi(query.trim(), limit);
      return { status: 200, body: { results } };
    } catch {
      const { stdout, stderr } = await runNpx(["skills", "find", query.trim()], {
        timeout: 20000,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      const results = parseSearchOutput(stdout + stderr).slice(0, limit);
      return { status: 200, body: { results } };
    }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const raw = (err.stdout ?? "") + (err.stderr ?? "");
    const results = raw ? parseSearchOutput(raw) : [];
    if (results.length > 0) return { status: 200, body: { results } };
    return { status: 500, body: { error: err.message ?? String(e) } };
  }
}

/** POST /api/skills/update */
export async function skillsUpdate(body: Record<string, unknown>): Promise<StatusBody> {
  try {
    const cwd = typeof body.cwd === "string" ? body.cwd : "";
    const pkg = typeof body.package === "string" ? body.package : "";
    const scope = body.scope === "global" || body.scope === "project"
      ? body.scope as SkillInstallScope
      : undefined;
    if (!cwd || !pkg || !scope) {
      return { status: 400, body: { error: "cwd, package, and scope are required" } };
    }
    const allowedRoots = await getAllowedFileRoots();
    if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
      return { status: 403, body: { error: "Access denied" } };
    }

    const { skills } = await loadSkillsWithInstallInfo(cwd);
    const skill = skills.find(
      (item) => item.install?.package === pkg && item.install.scope === scope,
    );
    if (!skill?.install) {
      return { status: 404, body: { error: "Installed skill not found" } };
    }
    if (!skill.install.canCheckForUpdates) {
      return { status: 400, body: { error: "This skill cannot be updated automatically" } };
    }

    const { stdout, stderr } = await runNpx(buildSkillUpdateArgs(skill.install), {
      timeout: 60_000,
      cwd: scope === "project" ? cwd : undefined,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const refreshed = await loadSkillsWithInstallInfo(cwd);
    const updatedSkill = refreshed.skills.find(
      (item) => item.install?.package === pkg && item.install.scope === scope,
    );
    return {
      status: 200,
      body: {
        success: true,
        skill: updatedSkill,
        output: `${stdout}${stderr}`.slice(-500),
      },
    };
  } catch (error: unknown) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    const output = `${detail.stdout ?? ""}${detail.stderr ?? ""}`;
    return { status: 500, body: { error: output || detail.message || String(error) } };
  }
}
