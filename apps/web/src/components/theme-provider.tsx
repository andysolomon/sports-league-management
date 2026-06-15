"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * App theme provider (WSM-000136 P1). Wraps next-themes so the `dark`/`light`
 * class is applied to <html>. Dark is the default and design target; light is
 * retained and reachable via the toggle. System preference is disabled so the
 * default is deterministic (and visual-regression snapshots stay dark).
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
