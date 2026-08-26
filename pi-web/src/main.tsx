import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/hooks/useI18n";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./settings.css";

// Dev-only shim: Vite applies `define` only at build time for client code,
// so `process.env.NEXT_PUBLIC_*` reads must not throw during development.
if (typeof window !== "undefined" && typeof (window as { process?: unknown }).process === "undefined") {
  (window as { process: unknown }).process = { env: {} };
}

// Mirrors the retired Next.js app/page.tsx composition.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  </StrictMode>,
);
