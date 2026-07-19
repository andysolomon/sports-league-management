"use client";

import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  Layers,
  Trophy,
  Upload,
  CreditCard,
  PlusCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import NavLink from "./nav-link";
import { leagueHomeHref } from "@/components/workspace/resource-navigation";

interface NavItem {
  label: string;
  icon: LucideIcon;
  hideWithoutLeague?: boolean;
  getHref: (activeLeagueId?: string | null) => string;
}

const navItems: NavItem[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    hideWithoutLeague: true,
    getHref: (activeLeagueId) =>
      activeLeagueId ? leagueHomeHref(activeLeagueId) : "/dashboard",
  },
  {
    label: "Teams",
    icon: Users,
    hideWithoutLeague: true,
    getHref: () => "/dashboard/teams",
  },
  {
    label: "Players",
    icon: UserCircle,
    hideWithoutLeague: true,
    getHref: () => "/dashboard/players",
  },
  {
    label: "Seasons",
    icon: Calendar,
    hideWithoutLeague: true,
    getHref: () => "/dashboard/seasons",
  },
  {
    label: "Divisions",
    icon: Layers,
    hideWithoutLeague: true,
    getHref: () => "/dashboard/divisions",
  },
  { label: "Import", icon: Upload, getHref: () => "/dashboard/import" },
  { label: "Billing", icon: CreditCard, getHref: () => "/dashboard/billing" },
];

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
            href="/dashboard/leagues"
            icon={PlusCircle}
            onClick={onNavigate}
          >
            League Directory
          </NavLink>
        ) : null}
        {visibleNavItems.map((item) => {
          const href = item.getHref(activeLeagueId);
          return (
            <NavLink
              key={item.label}
              href={href}
              icon={item.icon}
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
