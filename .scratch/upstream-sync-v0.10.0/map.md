# Upstream sync v0.9.3 → v0.10.0 map

Upstream `agegr/pi-web` v0.9.3..v0.10.0 (111 commits; `demo/` GitHub-Pages form
factor is n/a per ADR-0003). Version targets: app 0.9.3 → 0.10.0, pi SDK
0.99.1 → 1.0.0.

## Notes

- Census: `commit-census.md` (per-commit ported/n-a/deferred + waves).
- SDK breakage report: `sdk-1.0.0-breakages.md`.
- Port mechanics per `docs/upstream-sync.md` (port-patch.sh, renderer →
  `pi-web/src/`, routes → `electron/main/services/` IPC, fetch → `window.pi.*`).

## Decisions-so-far

- Range correction: v0.9.3 wave already landed through 5d4c0b5; this sync = 21 commits.
- Port order follows upstream parentage, not census labels: 3eb8a9d before b183176.
- Our i18n files are a curated subset; every commit's locale hunks are merged manually (registry parity test guards the result).
- SDK 1.0.0 (e77a4e5) applied last; the 7 type errors it introduced on 0.99.1 all resolved by the dep bump itself.
- Local resolvedSdkPackageDir fix (a72c538) kept; upstream does not touch it.

## Fog

- Waves and issue breakdown pending census.
