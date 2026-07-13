"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./sidebar";
import { LeagueSwitcher } from "./league-switcher";
import { CommandTrigger } from "./command-trigger";
import { ThemeToggle } from "@/components/theme-toggle";
import { DensityToggle } from "@/components/density-toggle";

interface LeagueOption {
  id: string;
  name: string;
}

export default function MobileHeader({
  leagues,
  activeLeagueId,
}: {
  leagues: LeagueOption[];
  activeLeagueId: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      {leagues.length > 0 ? (
        <LeagueSwitcher leagues={leagues} activeLeagueId={activeLeagueId} />
      ) : (
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      )}
      <div className="flex items-center gap-1">
        <CommandTrigger variant="icon" />
        <DensityToggle />
        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}
