"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ChatWindow } from "./ChatWindow";
import type { ChatInputHandle } from "./ChatInput";
import { useI18n } from "@/hooks/useI18n";
import type { SessionInfo } from "@/lib/types";

type ChatProps = ComponentProps<typeof ChatWindow>;

interface Props extends Pick<ChatProps, "modelsRefreshKey" | "onOpenFile" | "onOpenSubagent" | "onToolEnd" | "onFilesUploaded" | "initialPrompt" | "onInitialPromptConsumed" | "soundEnabled" | "onSoundToggle" | "playDoneSound" | "unlockAudio" | "holdAudio" | "quoteSelectionEnabled" | "onSessionForked" | "onOpenSettings"> {
  sessionId: string;
  running: boolean;
}

const RETRY_MS = 1000;

/**
 * A subagent's or side chat's right-panel tab: the chat, scoped to that
 * session. It is never the page's main chat: no URL, no sidebar row, and the
 * page's global shortcuts stay with the main chat. Info is fetched here because
 * a tab opens by id, and again while a run just started has no session to read.
 */
export function SessionChatPanel({ sessionId, running, ...chatProps }: Props) {
  const { t } = useI18n();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error">("loading");
  // Edit from here, dropped files and a failed send's text all reach the composer through this.
  const chatInputRef = useRef<ChatInputHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        // Fork transport: the pi:sessions:get IPC carries upstream's GET route.
        const res = await window.pi.sessionsGet(sessionId);
        if (cancelled) return;
        const data = (res ?? {}) as { notFound?: boolean; info?: SessionInfo };
        if (data.notFound) {
          setState("missing");
          if (running) retry = setTimeout(() => void load(), RETRY_MS);
          return;
        }
        if (data.info) setInfo(data.info);
        else setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [sessionId, running]);

  if (info) {
    return <ChatWindow {...chatProps} session={info} sessionRunning={running} newSessionCwd={null} newSessionDraftKey={null} chatInputRef={chatInputRef} panel />;
  }
  return (
    <div role={state === "error" ? "alert" : undefined} style={{ padding: "24px 16px", color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>
      {t(state === "loading" || running ? "sessionPanel.loading" : state === "missing" ? "sessionPanel.missing" : "sessionPanel.error")}
    </div>
  );
}
