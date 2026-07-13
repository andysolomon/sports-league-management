import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DensityToggle } from "@/components/density-toggle";
import { LocalModeBanner } from "./_components/local-mode-banner";

/**
 * Shell for the free no-login local-only tier (WSM-000137, #258). This subtree is
 * a PUBLIC route (see middleware) and is entirely client-rendered against the
 * browser-local provider — no Clerk, no Convex. Kept separate from `/dashboard`
 * so the authed SSR app is untouched (RFC §4, Option A).
 */
export default function LocalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link href="/local" className="text-sm font-semibold text-foreground">
          sprtsmng <span className="text-muted-foreground">· local</span>
        </Link>
        <div className="flex items-center gap-2">
          <DensityToggle />
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href="/sign-up">Create a free account</Link>
          </Button>
        </div>
      </header>
      <LocalModeBanner />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
