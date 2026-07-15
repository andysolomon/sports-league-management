"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-bg px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          hideCloseButton
          className="w-[248px] border-r border-border bg-bg p-0"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            hasLeagues={leagues.length > 0}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      {leagues.length > 0 ? (
        <LeagueSwitcher leagues={leagues} activeLeagueId={activeLeagueId} />
      ) : (
        <h1 className="text-base font-bold tracking-[-0.4px] text-text">
          Sports League
        </h1>
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        <CommandTrigger variant="icon" />
        <DensityToggle />
        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}
