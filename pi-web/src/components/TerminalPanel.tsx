"use client";

import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useI18n } from "@/hooks/useI18n";
import { setTerminalTheme, useTerminalTheme } from "@/hooks/useTerminalTheme";
import { subscribeFontPreferences } from "@/hooks/useFontPreferences";
import { readFontWeight } from "@/lib/font-preferences";
import { createTerminalWriter, createWorkspaceTerminal, killTerminal } from "@/lib/terminal-client";
import { bridge } from "@/lib/pi-ipc";
import type { TerminalEvent } from "@/lib/terminal-manager";
import { TERMINAL_XTERM_THEMES } from "@/lib/terminal-theme";
import type { TerminalTab } from "./terminal-tab-state";

interface Props {
  tab: TerminalTab;
  active: boolean;
  onRestart: () => void;
  onClosed: () => void;
  onCloseError: () => void;
}

export function TerminalPanel({ tab, active, onRestart, onClosed, onCloseError }: Props) {
  const { t } = useI18n();
  const { id, cwd, restored } = tab;
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const startRef = useRef<Promise<void>>(Promise.resolve());
  const writerRef = useRef<ReturnType<typeof createTerminalWriter> | null>(null);
  const callbacksRef = useRef({ onClosed, onCloseError });
  callbacksRef.current = { onClosed, onCloseError };
  const [status, setStatus] = useState<"connecting" | "ready" | "exited" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);
  const theme = useTerminalTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let subscription: { ready: Promise<{ status: number; body: { replay?: { type: "output"; data: string; offset: number; reset?: boolean } | null; exited?: boolean; exitCode?: number | null; error?: string } }>; stop(): void } | null = null;
    let offset: number | undefined;
    let connected = false;
    let exited = false;
    let inputFailed = false;
    setStatus("connecting");
    setError(null);
    setExitCode(null);

    const readTerminalFont = () => {
      const style = getComputedStyle(container);
      return {
        fontFamily: style.getPropertyValue("--font-mono").trim() || "monospace",
        // Base weights stop at 600, so xterm's default bold (700) stays heavier.
        fontWeight: readFontWeight(style.getPropertyValue("--font-mono-weight")),
      };
    };
    const terminal = new Terminal({
      cursorBlink: true,
      ...readTerminalFont(),
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 8000,
      // xterm uses a custom scrollbar rather than the global CSS scrollbar.
      overviewRuler: { width: 5 },
      screenReaderMode: true,
      disableStdin: true,
      theme: TERMINAL_XTERM_THEMES[themeRef.current],
    });
    terminalRef.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "v") return false;
      if ((event.ctrlKey || event.metaKey) && key === "c" && terminal.hasSelection()) return false;
      return true;
    });

    const writer = createTerminalWriter(id, (reason) => {
      if (disposed) return;
      inputFailed = true;
      terminal.options.disableStdin = true;
      setError(reason.message);
      setStatus("error");
    });
    writerRef.current = writer;
    const onData = terminal.onData((data) => {
      if (connected && !exited && !inputFailed) writer.write(data);
    });
    const fitAndResize = () => {
      if (!container.offsetWidth || !container.offsetHeight) return;
      fit.fit();
    };
    const onResize = terminal.onResize(({ cols, rows }) => {
      if (connected && !exited && !inputFailed) writer.resize(cols, rows);
    });
    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(container);
    const updateFont = () => {
      if (disposed) return;
      const font = readTerminalFont();
      terminal.options.fontFamily = font.fontFamily;
      terminal.options.fontWeight = font.fontWeight;
      fitAndResize();
    };
    const unsubscribeFonts = subscribeFontPreferences(updateFont);

    const applyEvent = (event: TerminalEvent) => {
      if (event.type === "output") {
        if (event.reset) terminal.reset();
        else if (offset !== undefined && event.offset <= offset) return;
        terminal.write(event.data);
        offset = event.offset;
      } else {
        exited = true;
        connected = false;
        terminal.options.disableStdin = true;
        subscription?.stop();
        subscription = null;
        setExitCode(event.type === "exit" ? event.exitCode : null);
        setStatus("exited");
      }
    };

    const connect = () => {
      if (disposed || exited) return;
      subscription?.stop();
      const sub = bridge().terminalSubscribe(id, offset, (frame) => {
        if (frame.event === "output") {
          applyEvent({ type: "output", data: String(frame.data.data), offset: Number(frame.data.offset), ...(frame.data.reset ? { reset: true } : {}) });
        } else if (frame.event === "exit") {
          applyEvent({ type: "exit", exitCode: Number(frame.data.exitCode) });
        } else {
          applyEvent({ type: "closed" });
        }
      });
      subscription = sub;
      sub.ready.then((result) => {
        if (disposed) return;
        if (result.status !== 200) {
          subscription = null;
          sub.stop();
          setError(result.body.error ?? `terminal connect failed (${result.status})`);
          setStatus("error");
          return;
        }
        if (result.body.replay) applyEvent(result.body.replay);
        if (result.body.exited) {
          applyEvent({ type: result.body.exitCode === null || result.body.exitCode === undefined ? "closed" : "exit", exitCode: result.body.exitCode ?? 0 });
          return;
        }
        connected = true;
        if (inputFailed) return;
        terminal.options.disableStdin = false;
        setStatus("ready");
        fitAndResize();
        writer.resize(terminal.cols, terminal.rows);
        if (container.offsetWidth && container.offsetHeight) terminal.focus();
      }).catch((reason: Error) => {
        if (disposed) return;
        setError(reason.message);
        setStatus("error");
      });
    };

    startRef.current = (async () => {
      fitAndResize();
      if (restored || reconnectKey > 0) {
        // Restoring a tab must never silently launch a replacement shell;
        // the subscription 404 surfaces as the error state instead.
      } else {
        await createWorkspaceTerminal(cwd, terminal.cols, terminal.rows, id);
      }
      connect();
    })().catch((reason: Error) => {
      if (disposed) return;
      setError(reason.message);
      setStatus("error");
    });

    return () => {
      disposed = true;
      subscription?.stop();
      void writer.stop();
      resizeObserver.disconnect();
      unsubscribeFonts();
      onData.dispose();
      onResize.dispose();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [id, cwd, restored, reconnectKey]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = TERMINAL_XTERM_THEMES[theme];
  }, [theme]);

  useEffect(() => {
    if (active) terminalRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!tab.closing) return;
    let cancelled = false;
    if (terminalRef.current) terminalRef.current.options.disableStdin = true;
    void (async () => {
      await startRef.current;
      writerRef.current?.stop();
      killTerminal(id);
      if (!cancelled) callbacksRef.current.onClosed();
    })().catch((reason: Error) => {
      if (cancelled) return;
      setError(reason.message);
      setStatus("error");
      callbacksRef.current.onCloseError();
    });
    return () => { cancelled = true; };
  }, [id, tab.closing]);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const themeLabel = nextTheme === "light" ? "terminal.lightTheme" : "terminal.darkTheme";

  return (
    <section className="terminal-panel" data-terminal-theme={theme} aria-label={t("terminal.title")}>
      <header className="terminal-panel-header">
        <div className="terminal-panel-path">
          <span className={`terminal-status-dot is-${status}`} title={t(`terminal.${status}`)} />
          <span title={cwd}>{cwd}</span>
        </div>
        <div className="terminal-panel-actions">
          {status === "error" && (
            <button type="button" onClick={() => setReconnectKey((key) => key + 1)} disabled={Boolean(tab.closing)} title={t("terminal.reconnect")} aria-label={t("terminal.reconnect")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />
              </svg>
            </button>
          )}
          <button type="button" onClick={() => setTerminalTheme(nextTheme)} title={t(themeLabel)} aria-label={t(themeLabel)}>
            {nextTheme === "light" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button type="button" onClick={onRestart} disabled={Boolean(tab.closing)} title={t("terminal.restart")} aria-label={t("terminal.restart")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.34 5.66" /><polyline points="20 4 20 11 13 11" />
            </svg>
          </button>
        </div>
      </header>
      <div>
        {error && <div className="terminal-panel-error" role="alert">{error}</div>}
        {status === "exited" && <div className="terminal-panel-exit" role="status">{exitCode === null ? t("terminal.exited") : t("terminal.exitCode", { code: exitCode })}</div>}
      </div>
      <div className="terminal-xterm"><div ref={containerRef} className="terminal-xterm-host" /></div>
    </section>
  );
}
