#!/usr/bin/env node
/**
 * Formal check of the file-authorization gate for `pifile://` traffic.
 * See ../SKILL.md. Runs the REAL code (loaded from pi-web/src/lib via jiti,
 * the same loader the repo's own tests use) against generated inputs and an
 * independent oracle. Deterministic: fixed seed by default.
 *
 * Usage: node .claude/skills/verify-file-authorization/scripts/check.mjs [--seed N] [--cases N]
 * Exit codes: 0 all properties hold, 1 at least one property broken (counterexamples printed).
 */
import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..", "..", "..", "..");
const LIB = join(ROOT, "pi-web", "src", "lib");

const jiti = createJiti(import.meta.url, { interopDefault: true, moduleCache: false });
const pathSecurity = await jiti.import(join(LIB, "path-security.ts"));
const pathsLib = await jiti.import(join(LIB, "paths.ts"));

const { isPathWithinRoots, hasParentDirectorySegment, isExistingPathWithinRoots } = pathSecurity;
const { filePathFromApiSegments, isWindowsAbsolutePath, toSlashPath } = pathsLib;

// ------------------------------------------------------------------ options

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && /^\d+$/.test(argv[i + 1]) ? Number(argv[i + 1]) : dflt;
};
const SEED = opt("seed", 20261115);
const CASES = opt("cases", 3000);

// Deterministic PRNG (mulberry32) — same seed, same inputs, same verdicts.
let state = SEED >>> 0;
function rnd() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const maybe = (p) => rnd() < p;

// ------------------------------------------------------------------ oracle
// Deliberately implemented differently from pi-web/src/lib/path-security.ts:
// segment-array prefix comparison instead of string startsWith on a
// separator-appended root. It encodes the SAME documented spec:
//   containment holds iff, under the resolver family picked by Windows
//   absoluteness of either side (case-folded only in the Windows family),
//   the target's resolved segments equal the root's or have them as a
//   proper prefix.

function prefixSegments(r, t) {
  if (r.length === 0) return true; // "/" (or a UNC root): everything in the family is inside
  if (r.length > t.length) return false;
  return r.every((s, i) => s === t[i]);
}

function windowsRootKind(resolved) {
  if (resolved.startsWith("\\\\")) return "unc";
  if (/^[a-zA-Z]:/.test(resolved)) return "drive";
  return "bare";
}

function oracleWithin(target, root) {
  const useWindows = isWindowsAbsolutePath(target) || isWindowsAbsolutePath(root);
  if (!useWindows) {
    const t = path.posix.resolve(target).split("/").filter(Boolean);
    const r = path.posix.resolve(root).split("/").filter(Boolean);
    return prefixSegments(r, t);
  }
  const resolvedTarget = path.win32.resolve(target);
  const resolvedRoot = path.win32.resolve(root);
  const kindTarget = windowsRootKind(resolvedTarget);
  const kindRoot = windowsRootKind(resolvedRoot);
  if (kindTarget !== kindRoot) return false; // drive vs UNC vs bare root: different locations
  const fold = (s) => s.toLowerCase();
  const t = resolvedTarget.split("\\").filter(Boolean).map(fold);
  const r = resolvedRoot.split("\\").filter(Boolean).map(fold);
  return prefixSegments(r, t);
}

function oracleHasDotDot(target) {
  const useWindows = isWindowsAbsolutePath(target);
  const parts = useWindows ? target.split(/[\\/]/) : target.split("/");
  return parts.includes("..");
}

// ------------------------------------------------------------------ inputs

const NAME_POOL = ["a", "sub", "src", "lib", "x y", "中文", "a..b", "..hidden", "CON", "nul", "file.txt", "deep", "PI-VERIFY"];
const ROOT_POOL = [
  "/srv/app", "/srv/app/sub", "/srv/application", "/srv/ap", "/home/u/proj", "/home/u/proj2",
  "/home/u/PROJ", "C:\\work\\repo", "C:/work/repo", "c:\\work\\repo", "D:\\data", "\\\\srv\\share",
  "/tmp/x", "repo", "./rel", "/", "//",
];

function genTarget() {
  const base = maybe(0.7) ? pick(ROOT_POOL) : pick(["/srv/app", "/home/u/proj", "C:\\work\\repo", ""]);
  const parts = [];
  const n = Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    if (maybe(0.15)) parts.push("..");
    else if (maybe(0.08)) parts.push(".");
    else parts.push(pick(NAME_POOL));
  }
  let joined = [base, ...parts].filter((p) => p !== "").join(maybe(0.25) ? "\\" : "/");
  if (maybe(0.1)) joined = joined.toUpperCase();
  if (maybe(0.05)) joined = "/" + joined;
  return joined;
}

function genSegments() {
  const mode = rnd();
  const parts = [];
  const n = 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) parts.push(maybe(0.1) ? ".." : pick(NAME_POOL.filter((s) => !s.includes("/"))));
  if (mode < 0.15) return ["C:", ...parts];
  if (mode < 0.3) return ["C:\\" + pick(["repo", "work"]), ...parts];
  return parts;
}

// ------------------------------------------------------------------ checks

const failures = [];
function fail(property, message) {
  failures.push({ property, message });
  process.stdout.write(`  [FAIL] ${property}: ${message}\n`);
}

process.stdout.write(`file-authorization check (seed ${SEED}, ${CASES} generated cases per family)\n`);

// F1+F2: exact agreement with the independent oracle — soundness (never allow
// what is outside) and availability (never deny what is inside), both families.
// KNOWN-FINDING-1 (documented in ../SKILL.md): the code accepts a UNC target
// (\\server\share\...) under a bare `\` root (a posix "/" or "//" root
// re-resolved through win32), because every UNC string starts with "\".
// Those counterexamples are counted and reported, but do not fail the run.
let f12 = 0;
let known1 = 0;
for (let i = 0; i < CASES; i++) {
  const target = genTarget();
  const root = pick(ROOT_POOL);
  const got = isPathWithinRoots(target, new Set([root]));
  const want = oracleWithin(target, root);
  f12++;
  if (got !== want) {
    const kindTarget = windowsRootKind(path.win32.resolve(target));
    const kindRoot = windowsRootKind(path.win32.resolve(root));
    if (got && !want && kindTarget === "unc" && kindRoot === "bare") {
      known1++;
      if (known1 === 1) {
        process.stdout.write(`  [known] KNOWN-FINDING-1: target=${JSON.stringify(target)} root=${JSON.stringify(root)} allowed (UNC under bare root; see ../SKILL.md)\n`);
      }
      continue;
    }
    const harm = got
      ? `ALLOWED a path outside the root — a pifile:// request for it would pass the lexical gate`
      : `DENIED a path inside the root — legitimate file traffic breaks`;
    fail("F1/F2 containment", `target=${JSON.stringify(target)} root=${JSON.stringify(root)}: code=${got} oracle=${want} (${harm})`);
    if (failures.length > 8) break;
  }
}
if (failures.length === 0) {
  process.stdout.write(`  [ok] F1/F2 lexical containment agrees with the oracle on ${f12} generated (target, root) pairs${known1 ? `, apart from KNOWN-FINDING-1 (${known1} cases)` : ""}\n`);
}

// F3: `..` rejection — a `..` segment must always be flagged (realpath collapses
// it before following links, the filesystem applies it after — issue #748), and
// plain names that merely contain dots must never be flagged.
let f3 = 0;
for (let i = 0; i < CASES; i++) {
  const target = genTarget();
  const got = hasParentDirectorySegment(target);
  const want = oracleHasDotDot(target);
  f3++;
  if (got !== want) {
    fail("F3 dotdot-segment", `target=${JSON.stringify(target)}: code=${got} oracle=${want} (${got ? "flags a path with no .. segment (availability)" : "misses a .. segment (symlink escape class, #748)"})`);
    if (failures.length > 8) break;
  }
}
if (failures.length === 0) process.stdout.write(`  [ok] F3 '..'-segment detection agrees with the oracle on ${f3} generated targets\n`);

// F4: realpath containment on a real tree (this is fs truth, not a model):
// inside → allow; symlink pointing outside → deny; sibling with shared prefix →
// deny; nonexistent path → deny; root recorded via a symlinked temp path
// (macOS /tmp → /private/tmp) still authorizes its children.
const runDir = mkdtempSync(join(tmpdir(), "pi-fv-"));
try {
  const root = join(runDir, "root");
  const outside = join(runDir, "outside");
  const sibling = join(runDir, "rootX");
  mkdirSync(join(root, "sub"), { recursive: true });
  mkdirSync(outside, { recursive: true });
  mkdirSync(sibling, { recursive: true });
  writeFileSync(join(root, "sub", "file.txt"), "inside");
  writeFileSync(join(outside, "secret.txt"), "outside");
  symlinkSync(outside, join(root, "link"));

  const cases = [
    ["inside plain file", join(root, "sub", "file.txt"), true],
    ["root itself", root, true],
    ["shared-prefix sibling", join(sibling, "f"), false],
    ["symlink inside root pointing outside", join(root, "link"), false],
    ["dotdot after link", join(root, "link", "..", "outside", "secret.txt"), false],
    ["nonexistent path inside root", join(root, "nope", "missing.txt"), false],
    ["path outside every root", join(outside, "secret.txt"), false],
  ];
  let f4 = 0;
  for (const [name, target, want] of cases) {
    const got = isExistingPathWithinRoots(target, new Set([root]));
    f4++;
    if (got !== want) {
      fail("F4 realpath containment", `${name}: target=${JSON.stringify(target)} root=${JSON.stringify(root)}: code=${got} expected=${want}`);
    }
  }
  if (failures.length === 0) process.stdout.write(`  [ok] F4 realpath containment on a real tree with a symlink escape attempt (${f4} cases)\n`);
} finally {
  rmSync(runDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

// F5: URL segment reconstruction — the path built from renderer-controlled
// pifile://local/<segments> is always absolute (or Windows-absolute), and for
// plain segments it reconstructs exactly the documented join (incl. bare `C:` → `C:/`).
let f5 = 0;
for (let i = 0; i < CASES; i++) {
  const segments = genSegments();
  const got = filePathFromApiSegments(segments);
  const slashJoined = toSlashPath(segments.join("/"));
  let want;
  if (/^[a-zA-Z]:$/.test(slashJoined)) want = `${slashJoined}/`;
  else if (isWindowsAbsolutePath(slashJoined)) want = slashJoined;
  else want = "/" + segments.join("/").replace(/^\/+/, "");
  const absolute = got.startsWith("/") || isWindowsAbsolutePath(got);
  f5++;
  if (!absolute || got !== want) {
    fail("F5 segment reconstruction", `segments=${JSON.stringify(segments)}: got=${JSON.stringify(got)} want=${JSON.stringify(want)} absolute=${absolute}`);
    if (failures.length > 8) break;
  }
}
if (failures.length === 0) process.stdout.write(`  [ok] F5 segment reconstruction on ${f5} generated segment arrays\n`);

// ------------------------------------------------------------------ verdict

if (failures.length > 0) {
  process.stdout.write(`VERDICT: BROKEN — ${failures.length} counterexample(s) beyond the documented findings. The property is violated by the current code.\n`);
  process.exit(1);
}
if (known1 > 0) {
  process.stdout.write(`VERDICT: HOLDS apart from KNOWN-FINDING-1 (${known1} generated cases, documented in ../SKILL.md). Exit 3, not 0, so the finding stays visible.\n`);
  process.exit(3);
}
process.stdout.write(`VERDICT: HOLDS — every generated input stayed inside the documented promise.\n`);
process.exit(0);
