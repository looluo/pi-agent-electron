// Focused probe: why do file-browser icons not render in the packaged app?
// Launches the packaged exe on a CDP port with a throwaway profile (does NOT
// touch the running instance's profile) and inspects .catppuccin-file-icon.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const EXE = "release/mac-arm64/Pi Agent App.app/Contents/MacOS/Pi Agent App";
const DEBUG_PORT = Number(process.env.PROBE_PORT ?? 9347);
const profile = mkdtempSync(join(tmpdir(), "iconprobe-"));

async function waitForCdp() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page;
    } catch { /* not up yet */ }
    await delay(500);
  }
  throw new Error("CDP page target never appeared");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false });
  let seq = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return new Promise((resolve) => ws.on("open", () => resolve({ ws, call })));
}

const child = spawn(EXE, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
], { stdio: "ignore", detached: false });

try {
  const page = await waitForCdp();
  const { ws, call } = await connect(page.webSocketDebuggerUrl);
  const evalJs = (expression) => call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });

  await evalJs(`(async () => {
    for (let i = 0; i < 80; i += 1) {
      if (document.querySelector('button[aria-label]')) return true;
      await new Promise((res) => setTimeout(res, 250));
    }
    return false;
  })()`);

  // Wait for the file explorer rows (async workspace listing) before probing.
  await evalJs(`(async () => {
    for (let i = 0; i < 60; i += 1) {
      if (document.querySelector('.catppuccin-file-icon')) return true;
      await new Promise((res) => setTimeout(res, 250));
    }
    return false;
  })()`);

  const info = await evalJs(`(async () => {
    const imgLoads = (src) => new Promise((res) => {
      const i = new Image();
      const t = setTimeout(() => res(false), 4000);
      i.onload = () => { clearTimeout(t); res(i.naturalWidth > 0); };
      i.onerror = () => { clearTimeout(t); res(false); };
      i.src = src;
    });
    const imgLoadsDetailed = (src) => new Promise((res) => {
      const i = new Image();
      const t = setTimeout(() => res('timeout'), 6000);
      i.onload = () => { clearTimeout(t); res(i.naturalWidth > 0 ? 'load' : 'empty'); };
      i.onerror = (e) => { clearTimeout(t); res('error'); };
      i.src = src;
    });
    const icons = [...document.querySelectorAll('.catppuccin-file-icon')];
    const el = icons[0];
    const cs = el ? getComputedStyle(el) : null;
    const rawVar = el ? el.style.getPropertyValue('--catppuccin-icon-light').trim() : null;
    const mask = cs ? ((cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage) || '') : null;
    const stripUrl = (v) => {
      if (!v.startsWith('url(')) return v;
      const inner = v.slice(4, -1);
      return inner.replace(/^["']|["']$/g, '');
    };
    const computedSrc = mask ? stripUrl(mask) : null;
    const docResolved = rawVar ? new URL(rawVar.slice(5, -2), document.baseURI).href : null;
    const loads = computedSrc ? await imgLoadsDetailed(computedSrc) : null;
    const retry = computedSrc ? await imgLoadsDetailed(computedSrc) : null;
    const fetchProbe = computedSrc ? await fetch(computedSrc).then((r) => r.status).catch((e) => String(e)) : null;
    const docLoads = docResolved ? await imgLoadsDetailed(docResolved) : null;
    const identical = computedSrc === docResolved;
    const box = el ? el.getBoundingClientRect() : null;
    return {
      url: location.href,
      mounted: icons.length,
      rawVar,
      computedMask: computedSrc,
      computedMaskLoads: loads,
      computedMaskRetry: retry,
      fetchStatus: fetchProbe,
      identicalStrings: identical,
      lenComputed: computedSrc ? computedSrc.length : null,
      lenDoc: docResolved ? docResolved.length : null,
      docResolved,
      docResolvedLoads: docLoads,
      rect: box ? { w: box.width, h: box.height } : null,
      maskImage: cs ? cs.maskImage : null,
      backgroundColor: cs ? cs.backgroundColor : null,
      // sample what the explorer rows look like
      sampleRow: (() => {
        const row = icons[0]?.closest('[class*="flex"],li,div');
        return row ? row.textContent.slice(0, 60) : null;
      })(),
    };
  })()`);
  console.log(JSON.stringify(info.result.value, null, 2));

  // Visual proof: clip a screenshot around the first icon row and analyze
  // pixels — a blanked mask paints a solid dim square; a loaded mask paints
  // the folder glyph (mixed pixels). PNG decode via zlib + manual IHDR/IDAT.
  const geom = await evalJs(`(() => {
    const el = document.querySelector('.catppuccin-file-icon');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, dpr: window.devicePixelRatio };
  })()`);
  const g = geom.result.value;
  const pad = 2;
  const shot2 = await call("Page.captureScreenshot", {
    format: "png",
    clip: {
      x: Math.max(0, g.x - pad), y: Math.max(0, g.y - pad),
      width: g.w + pad * 2, height: g.h + pad * 2,
      scale: 1,
    },
  });
  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/icon-clip.png", Buffer.from(shot2.data, "base64"));
  console.log("clip: /tmp/icon-clip.png");

  ws.close();
} finally {
  child.kill("SIGKILL");
}
