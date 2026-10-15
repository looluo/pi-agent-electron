# 05: slice 4: skills / plugins / export / misc

Status: resolved

Blocked by: 03

- Port skills (list/toggle/install via npx/search/check/update), plugins (SettingsManager + DefaultPackageManager), session export (write temp file + shell.openPath), home route
Gate: skills install + toggle visible in UI; session export opens HTML

## Comments

Resolved in ee2f478. slice4-probe 7/7: skills list (35, DefaultResourceLoader parity), agent-browser dormancy toggle round-trip (surgical frontmatter edit verified both directions), update check with real version data, skills search (skills.sh reachable via API), plugins list, session export writes patched HTML and opens via shell.openPath. Finding: the files allow-list derives from existing session cwds — a worktree/目录 with no sessions yet is unauthorized until cwdValidate (or a first session) runs; the UI always calls cwdValidate on selection so this is transparent in-product, but probes/scripts must call it first. skills.sh search worked here (unlike models.dev); install/update exercise npx+network and belong to ticket 07's live matrix.