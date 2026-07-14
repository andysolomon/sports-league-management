import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Sidebar from "./_components/sidebar";
import MobileHeader from "./_components/mobile-header";
import { LeagueSwitcher } from "./_components/league-switcher";
import { MigrateLocalPrompt } from "./_components/migrate-local-prompt";
import { CommandPalette } from "./_components/command-palette";
import { CommandTrigger } from "./_components/command-trigger";
import { Breadcrumbs } from "./_components/breadcrumbs";
import { ThemeToggle } from "@/components/theme-toggle";
import { DensityToggle } from "@/components/density-toggle";
import { resolveActiveLeague } from "@/lib/active-league";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const { leagues, activeLeagueId } = userId
    ? await resolveActiveLeague(userId)
    : { leagues: [], activeLeagueId: null };

  return (
    <div className="flex min-h-screen bg-bg">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      {/* Desktop sidebar — prototype shell: 212px rail on --bg */}
      <aside className="hidden w-[212px] shrink-0 border-r border-border bg-bg lg:block">
        <Sidebar />
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
            <CommandTrigger />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <DensityToggle />
            <ThemeToggle />
            <UserButton />
          </div>
        </header>

        <CommandPalette leagues={leagues} />

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          <Breadcrumbs />
          <MigrateLocalPrompt />
          {children}
        </main>
      </div>
    </div>
  );
}
