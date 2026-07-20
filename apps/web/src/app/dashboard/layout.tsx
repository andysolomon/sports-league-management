import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "./_components/sidebar";
import MobileHeader from "./_components/mobile-header";
import { LeagueSwitcher } from "./_components/league-switcher";
import { MigrateLocalPrompt } from "./_components/migrate-local-prompt";
import { CommandPalette } from "./_components/command-palette";
import { CommandTrigger } from "./_components/command-trigger";
import { HistoryBackButton } from "./_components/history-back-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DensityToggle } from "@/components/density-toggle";
import { resolveActiveLeague } from "@/lib/active-league";
import {
  isActiveLeagueResourcePath,
  normalizeDashboardReturnPath,
} from "@/lib/active-league-cookie";
import { currentDashboardPath } from "@/lib/active-league-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const { leagues, activeLeagueId, preferenceStatus } = userId
    ? await resolveActiveLeague(userId)
    : { leagues: [], activeLeagueId: null, preferenceStatus: "none" as const };
  const dashboardPath = await currentDashboardPath();

  if (
    userId &&
    preferenceStatus === "stale" &&
    !isActiveLeagueResourcePath(dashboardPath)
  ) {
    redirect(
      `/dashboard/active-league?returnTo=${encodeURIComponent(
        normalizeDashboardReturnPath(dashboardPath),
      )}`,
    );
  }

  const hasLeagues = leagues.length > 0;

  return (
    <div className="flex min-h-screen bg-bg">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      {/* Desktop sidebar — prototype shell: 248px rail on --bg */}
      <aside className="hidden w-[248px] shrink-0 border-r border-border bg-bg lg:block">
        <Sidebar hasLeagues={hasLeagues} activeLeagueId={activeLeagueId} />
      </aside>

      {/* min-w-0 lets this flex child shrink below its content's intrinsic
          width — without it, wide tables push the page wider than the phone
          viewport and overflow-x-auto containers never engage. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header with hamburger */}
        <MobileHeader leagues={leagues} activeLeagueId={activeLeagueId} />

        {/* Desktop header — league switcher + command left; density/theme/account right */}
        <header className="hidden h-14 shrink-0 items-center justify-between gap-3.5 border-b border-border bg-bg px-[22px] lg:flex">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <LeagueSwitcher leagues={leagues} activeLeagueId={activeLeagueId} />
            <HistoryBackButton />
            <CommandTrigger />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <DensityToggle />
            <ThemeToggle />
            <UserButton />
          </div>
        </header>

        <CommandPalette leagues={leagues} activeLeagueId={activeLeagueId} />

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          <MigrateLocalPrompt />
          {children}
        </main>
      </div>
    </div>
  );
}
