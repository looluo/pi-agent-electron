import { useMemo } from "react";

/**
 * Vite shim for next/navigation.
 *
 * AppShell reads searchParams once on mount (deep-link restore) and uses
 * router.replace to reflect session selection into the URL. The shim makes
 * the initial URL readable and keeps replace() writing to the address bar;
 * in-app React state remains the source of truth for navigation.
 */

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
      window.history.replaceState(null, "", href === "/" ? "/" : href);
    },
    push: (href) => {
      window.history.replaceState(null, "", href === "/" ? "/" : href);
    },
    back: () => window.history.back(),
  };
}

export function usePathname(): string {
  return window.location.pathname;
}
