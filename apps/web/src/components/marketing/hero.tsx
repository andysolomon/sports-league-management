import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/8bit/button";

interface HeroProps {
  isSignedIn: boolean;
}

export function MarketingHero({ isSignedIn }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Soft gradient background */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50/60 via-white to-white"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Free for one team, forever
          </p>

          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Manage your team without the spreadsheets.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl">
            sprtsmng is the simplest way to run your youth sports team. Roster,
            schedule, notifications — all in one place.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {isSignedIn ? (
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link href="#pricing">See pricing</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            No credit card required · Sign in with Google
          </p>
        </div>
      </div>
    </section>
  );
}
