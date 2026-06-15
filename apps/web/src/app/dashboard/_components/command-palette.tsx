"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Compass,
  Users,
  UserCircle,
  Calendar,
  Layers,
  Upload,
  CreditCard,
  Shield,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** Window event that any trigger button dispatches to open the single palette. */
export const COMMAND_PALETTE_EVENT = "command-palette:open";

export function openCommandPalette() {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/leagues", label: "Leagues", icon: Trophy },
  { href: "/dashboard/discover", label: "Discover", icon: Compass },
  { href: "/dashboard/teams", label: "Teams", icon: Users },
  { href: "/dashboard/players", label: "Players", icon: UserCircle },
  { href: "/dashboard/seasons", label: "Seasons", icon: Calendar },
  { href: "/dashboard/divisions", label: "Divisions", icon: Layers },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/roles", label: "Roles & permissions", icon: Shield },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

interface LeagueOption {
  id: string;
  name: string;
}

/**
 * Global ⌘K command palette (WSM-000136 P2). Mounted ONCE in the dashboard
 * layout; opens on ⌘K / Ctrl+K or a `command-palette:open` window event (so
 * header buttons can trigger the same instance). Jumps to nav destinations and
 * the user's leagues.
 */
export function CommandPalette({ leagues }: { leagues: LeagueOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
          {NAV.map((item) => (
            <CommandItem
              key={item.href}
              value={`go ${item.label}`}
              onSelect={() => go(item.href)}
            >
              <item.icon />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {leagues.length > 0 && (
          <CommandGroup heading="Leagues">
            {leagues.map((league) => (
              <CommandItem
                key={league.id}
                value={`league ${league.name}`}
                onSelect={() => go(`/dashboard/leagues/${league.id}`)}
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
