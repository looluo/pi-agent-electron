import { useMemo } from "react";

/**
 * Vite shim for next/navigation.
 *
 * AppShell reads searchParams once on mount (deep-link restore) and uses
 * router.replace to reflect session selection into the URL. The shim makes
 * the initial URL readable and keeps replace() writing to the address bar;
 * in-app React state remains the source of truth for navigation.
 */


/**
 * file:// documents reject replaceState to "/" (it resolves to the drive root,
 * a different origin). Keep query-only URLs (the only shape AppShell writes)
 * and no-op everything else — in-app state remains the navigation source.
 */
function rewriteUrl(href: string): void {
  if (href.startsWith("?")) {
    window.history.replaceState(null, "", href);
  }
}

export function useSearchParams(): URLSearchParams {
  // Stable per-mount snapshot: mount-time URL is the only read that matters.
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

export function useRouter(): {
  replace: (href: string, options?: { scroll?: boolean }) => void;
  push: (href: string, options?: { scroll?: boolean }) => void;
  back: () => void;
} {
  return {
    replace: (href) => {
      rewriteUrl(href);
    },
    push: (href) => {
      rewriteUrl(href);
    },
    back: () => window.history.back(),
  };
}

export function usePathname(): string {
  return window.location.pathname;
}
