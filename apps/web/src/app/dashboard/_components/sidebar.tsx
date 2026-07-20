"use client";

import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  Trophy,
  Settings,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import NavLink from "./nav-link";
import { leagueDirectoryHref } from "@/components/workspace/resource-navigation";
import { buildShellNavItems } from "./shell-nav";

const SHELL_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  teams: Users,
  players: UserCircle,
  seasons: Calendar,
  settings: Settings,
};

interface SidebarProps {
  hasLeagues?: boolean;
  activeLeagueId?: string | null;
  onNavigate?: () => void;
}

export default function Sidebar({
  hasLeagues = true,
  activeLeagueId = null,
  onNavigate,
}: SidebarProps) {
  const navItems = buildShellNavItems(activeLeagueId);
  const visibleNavItems = hasLeagues
    ? navItems
    : navItems.filter((item) => !item.hideWithoutLeague);

  return (
    <div className="flex h-full flex-col px-3 py-[18px]">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Trophy className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        <h2 className="text-base font-bold tracking-[-0.4px] text-text">
          Sports League
        </h2>
      </div>
      <nav
        className="flex flex-1 flex-col gap-0.5"
        role="navigation"
        aria-label="Main navigation"
      >
        {!hasLeagues ? (
          <NavLink
            href={leagueDirectoryHref()}
            icon={PlusCircle}
            onClick={onNavigate}
          >
            League Directory
          </NavLink>
        ) : null}
        {visibleNavItems.map((item) => {
          const Icon = SHELL_ICONS[item.id] ?? LayoutDashboard;
          return (
            <NavLink
              key={item.id}
              href={item.href}
              icon={Icon}
              onClick={onNavigate}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
