import Link from "next/link";
import { Button } from "@/components/ui/8bit/button";
import { Monogram } from "./monogram";

interface HeaderProps {
  isSignedIn: boolean;
}

export function MarketingHeader({ isSignedIn }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground"
          aria-label="sprtsmng home"
        >
          <Monogram size={32} />
          <span className="text-lg font-bold tracking-tight">sprtsmng</span>
        </Link>

        <nav
          className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex"
          aria-label="Primary"
        >
          <Link href="#features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="#how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="#pricing" className="hover:text-foreground">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-sm font-medium text-foreground hover:text-foreground sm:inline"
              >
                Sign in
              </Link>
              <Button asChild size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
