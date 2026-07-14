"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trophy, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/active-league-cookie";

interface LeagueOption {
  id: string;
  name: string;
}

/**
 * Global league switcher (WSM-000103). Sets the active-league preference cookie
 * and refreshes so server components re-scope to the chosen league. Renders
 * nothing when the user has no leagues.
 */
export function LeagueSwitcher({
  leagues,
  activeLeagueId,
}: {
  leagues: LeagueOption[];
  activeLeagueId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (leagues.length === 0) return null;

  const active = leagues.find((l) => l.id === activeLeagueId) ?? null;

  function select(id: string) {
    if (id === activeLeagueId) return;
    // Preference cookie — read by server components on the next request.
    document.cookie = `${ACTIVE_LEAGUE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 min-w-0 items-center gap-2 rounded-control border border-border bg-surface-2 px-3 text-[13px] font-semibold text-text transition-colors hover:bg-surface-3 disabled:opacity-60"
        disabled={isPending}
        aria-label="Switch league"
      >
        <Trophy className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.9} />
        <span className="max-w-[10rem] truncate">
          {active?.name ?? "Select league"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Active league</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={activeLeagueId ?? ""}
          onValueChange={select}
        >
          {leagues.map((league) => (
            <DropdownMenuRadioItem key={league.id} value={league.id}>
              {league.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
