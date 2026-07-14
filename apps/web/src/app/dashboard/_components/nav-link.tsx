"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  icon?: LucideIcon;
  onClick?: () => void;
  children: React.ReactNode;
}

export default function NavLink({
  href,
  icon: Icon,
  onClick,
  children,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive =
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-[38px] w-full items-center gap-2.5 rounded-control px-3 text-label-14 font-semibold transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />}
      {children}
    </Link>
  );
}
