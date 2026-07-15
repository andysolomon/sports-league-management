"use client";

import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  Layers,
  Trophy,
  Compass,
  Upload,
  CreditCard,
  PlusCircle,
} from "lucide-react";
import NavLink from "./nav-link";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/leagues", label: "Leagues", icon: Trophy },
  { href: "/dashboard/discover", label: "Discover", icon: Compass },
  { href: "/dashboard/teams", label: "Teams", icon: Users },
  { href: "/dashboard/players", label: "Players", icon: UserCircle },
  { href: "/dashboard/seasons", label: "Seasons", icon: Calendar },
  { href: "/dashboard/divisions", label: "Divisions", icon: Layers },
  { href: "/dashboard/import", label: "Import", icon: Upload },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

const hiddenWithoutLeagueHrefs = new Set([
  "/dashboard",
  "/dashboard/leagues",
  "/dashboard/teams",
  "/dashboard/players",
  "/dashboard/seasons",
  "/dashboard/divisions",
]);

interface SidebarProps {
  hasLeagues?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ hasLeagues = true, onNavigate }: SidebarProps) {
  const visibleNavItems = hasLeagues
    ? navItems
    : navItems.filter((item) => !hiddenWithoutLeagueHrefs.has(item.href));

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
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            onClick={onNavigate}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
