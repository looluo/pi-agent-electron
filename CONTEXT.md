# Pi Agent

Pi Agent is a Windows desktop application for the pi coding agent: a forked web-style UI rendered in an Electron window, with the pi SDK running in the Electron main process.

## Language

**Pi Agent App**:
The user-facing product name shown in the desktop window and interface titles.
_Avoid_: pi-web, Pi Agent, upstream title

**Pi Web**:
The upstream project (`agegr/pi-web`) whose UI this app forked at v0.8.9. Refers to upstream only, never to code in this repo.
_Avoid_: vendored copy, our frontend

**Renderer**:
The forked React UI layer that renders the interface and handles user interaction. Runs sandboxed with no direct Node or filesystem access.
_Avoid_: frontend, pi-web copy, client

**Main process**:
The Electron Node process that hosts the pi SDK and performs all filesystem, shell, and session work on the renderer's behalf.
_Avoid_: backend, server, sidecar

**Portable directory**:
A versioned folder the user unzips and runs — no installer, no registry footprint, replaced wholesale on upgrade. It bundles its own Chromium and Node, so no WebView2 Runtime or external prerequisite is required.
_Avoid_: installer, single-file exe, standalone executable, app bundle
