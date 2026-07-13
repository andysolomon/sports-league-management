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
    <div className="flex min-h-screen">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 border-r border-border bg-card lg:block">
        <Sidebar />
      </aside>

      {/* min-w-0 lets this flex child shrink below its content's intrinsic
          width — without it, wide tables push the page wider than the phone
          viewport and overflow-x-auto containers never engage. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header with hamburger */}
        <MobileHeader leagues={leagues} activeLeagueId={activeLeagueId} />

        {/* Desktop header — the league switcher is the focus anchor (WSM-000103) */}
        <header className="hidden items-center justify-between border-b border-border px-8 py-4 lg:flex">
          <div className="flex items-center gap-3">
            <LeagueSwitcher leagues={leagues} activeLeagueId={activeLeagueId} />
            <CommandTrigger />
          </div>
          <div className="flex items-center gap-2">
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
