# Replace the Tauri wrapper with an Electron desktop app

Status: accepted (supersedes ADR-0001)

The Tauri wrapper spawns a Node sidecar that serves Pi Web over loopback HTTP, which forces runtime-bundle extraction, port picking, orphan-process handling, and leaves a machine-reachable socket in front of the pi SDK. We will rebuild the desktop app on Electron instead: the pi SDK runs in the Electron main process, the renderer communicates through typed Electron IPC, and no HTTP port is opened anywhere.

## Consequences

The app is desktop-only with a single form factor — browser and LAN access (`dev:lan`) are deliberately dropped. Closing the window stops the app and any in-flight runs, matching the previous desktop behavior. Distribution remains a single copyable Windows `.exe`, now via Electron packaging; the WebView2 Runtime prerequisite disappears because Electron bundles Chromium. The download is larger than the Tauri build, and the update story is decided separately.
