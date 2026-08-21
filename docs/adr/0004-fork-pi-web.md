# Fork Pi Web instead of tracking it as a subtree

Status: accepted (supersedes ADR-0002)

Moving to an Electron host (ADR-0003) requires rewriting the renderer's transport layer (fetch/EventSource → IPC) and replacing the Next.js build, which is incompatible with keeping the `pi-web/` subtree source unmodified. We will fork Pi Web at v0.8.9 and own the code from here on; `Pi Agent App` branding is applied directly in the forked source instead of by wrapper-side patching.

## Consequences

Subtree pulls from `agegr/pi-web` stop entirely. Upstream improvements now arrive only by manual cherry-pick, and drift will accumulate — this is accepted as the cost of controlling the transport and build layers. The renderer is restructured as a Vite SPA and the `app/api/` route handlers are re-homed as main-process services behind IPC.
