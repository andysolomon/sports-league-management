"use client";

import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  Layers,
  Trophy,
  CreditCard,
} from "lucide-react";
import NavLink from "./nav-link";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/leagues", label: "Leagues", icon: Trophy },
  { href: "/dashboard/teams", label: "Teams", icon: Users },
  { href: "/dashboard/players", label: "Players", icon: UserCircle },
  { href: "/dashboard/seasons", label: "Seasons", icon: Calendar },
  { href: "/dashboard/divisions", label: "Divisions", icon: Layers },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <h2 className="text-lg font-semibold text-gray-900">Sports League</h2>
      </div>
      <nav className="flex-1 space-y-1 px-2" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => (
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
