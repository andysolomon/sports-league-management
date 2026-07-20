"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserCircle,
  Calendar,
  Upload,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { leagueActivationHref } from "@/components/workspace/resource-navigation";
import { buildPaletteNavItems } from "./shell-nav";

/** Window event that any trigger button dispatches to open the single palette. */
export const COMMAND_PALETTE_EVENT = "command-palette:open";

export function openCommandPalette() {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}

const PALETTE_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  "league-directory": Trophy,
  teams: Users,
  players: UserCircle,
  seasons: Calendar,
  import: Upload,
  billing: CreditCard,
};

interface LeagueOption {
  id: string;
  name: string;
}

/**
 * Global ⌘K command palette (WSM-000136 P2 / issue #577). Mounted ONCE in the
 * dashboard layout; opens on ⌘K / Ctrl+K or a `command-palette:open` window
 * event. Emits only canonical Home destinations (ASR-23) and activates the
 * Active League when a League is selected (ASR-1).
 */
export function CommandPalette({
  leagues,
  activeLeagueId = null,
}: {
  leagues: LeagueOption[];
  activeLeagueId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const navItems = useMemo(
    () => buildPaletteNavItems(activeLeagueId),
    [activeLeagueId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a page or league"
    >
      <CommandInput placeholder="Search pages and leagues…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {navItems.map((item) => {
            const Icon = PALETTE_ICONS[item.id] ?? LayoutDashboard;
            return (
              <CommandItem
                key={item.id}
                value={`go ${item.label}`}
                onSelect={() => go(item.href)}
              >
                <Icon />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {leagues.length > 0 && (
          <CommandGroup heading="Leagues">
            {leagues.map((league) => (
              <CommandItem
                key={league.id}
                value={`league ${league.name}`}
                onSelect={() => go(leagueActivationHref(league.id))}
              >
                <Trophy />
                {league.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
