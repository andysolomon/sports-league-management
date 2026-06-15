"use client";

import { AlertCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Compact injury/inactive indicator for a roster row (WSM-000098).
 *
 * Renders NOTHING for available players, so the table stays clean. For any
 * non-active status it shows a small icon next to the player name; tapping or
 * clicking opens a Radix popover (dismissable via Escape / outside-click) with
 * the status designation. The hit area expands to 44px only on coarse pointers
 * (phones/tablets) so desktop rows stay dense — the same pointer-coarse
 * strategy the Button primitive uses for touch targets.
 */
export function RosterStatusIndicator({ status }: { status: string }) {
  // "Active" (the default) is clean — only flag genuine unavailability.
  if (status.trim().toLowerCase() === "active") return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Status: ${status}. Show details.`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-amber-600 transition-colors hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-64">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{status}</p>
      </PopoverContent>
    </Popover>
  );
}
