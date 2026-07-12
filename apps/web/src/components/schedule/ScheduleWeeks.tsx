"use client";

/*
 * WSM-000239 — lifecycle-aware accordion timeline for the schedule page.
 *
 * Presentation-only: the server page does ALL data fetching and renders each
 * week's fixture table (and per-week action buttons) into slots; this
 * component just composes them into a controlled multi-open accordion.
 * `initialOpenKeys` comes from the same pure helper the server used
 * (initialOpenWeekKeys), so the first client render matches the server HTML.
 */

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScheduleWeekView {
  /** Stable accordion value from weekKey(): "week-<n>" | "unscheduled". */
  key: string;
  /** "Week <n>" | "Unscheduled" — the trigger's accessible name starts with this. */
  label: string;
  status: "completed" | "upcoming" | "mixed";
  /** Muted per-week summary shown in the trigger, e.g. "2 of 4 final". */
  summary?: string;
  /** Per-week action controls (e.g. Sim week) — rendered OUTSIDE the trigger button. */
  actions?: ReactNode;
  /**
   * The week's fixture table. For mixed weeks this is the REMAINING
   * (scheduled/live) games only — always visible while the week is open.
   */
  content: ReactNode;
  /** Mixed weeks: completed games, shown inside the nested collapsed subsection. */
  completedContent?: ReactNode;
  /** Mixed weeks: how many games sit in the completed subsection. */
  completedCount?: number;
}

export interface ScheduleWeeksProps {
  weeks: ScheduleWeekView[];
  /** Initial open accordion values — completed weeks closed, others open. */
  initialOpenKeys: string[];
}

export default function ScheduleWeeks({
  weeks,
  initialOpenKeys,
}: ScheduleWeeksProps) {
  const [openKeys, setOpenKeys] = useState<string[]>(initialOpenKeys);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenKeys(weeks.map((week) => week.key))}
        >
          Expand all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpenKeys([])}
        >
          Collapse all
        </Button>
      </div>
      <Accordion
        type="multiple"
        value={openKeys}
        onValueChange={setOpenKeys}
        className="space-y-4"
      >
        {weeks.map((week) => (
          <AccordionItem
            key={week.key}
            value={week.key}
            // Keeps the e2e weekCard() helper working: week containers were
            // previously ui/Card elements, which carry data-slot="card".
            data-slot="card"
            data-week-status={week.status}
            className="rounded-lg border border-border bg-card px-4 last:border-b"
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <AccordionTrigger>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span>{week.label}</span>
                    {week.summary ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {week.summary}
                      </span>
                    ) : null}
                  </span>
                </AccordionTrigger>
              </div>
              {week.actions ? (
                <div className="flex shrink-0 items-center gap-1">
                  {week.actions}
                </div>
              ) : null}
            </div>
            <AccordionContent>
              {week.status === "mixed" ? (
                <div className="space-y-3">
                  {week.content}
                  <CompletedSubsection
                    weekLabel={week.label}
                    count={week.completedCount ?? 0}
                  >
                    {week.completedContent}
                  </CompletedSubsection>
                </div>
              ) : (
                week.content
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

/*
 * Nested disclosure for the completed games inside a mixed week. Collapsed by
 * default; a plain <button> keeps it keyboard operable, with aria-expanded /
 * aria-controls wired to an always-present (hidden) content region.
 */
function CompletedSubsection({
  weekLabel,
  count,
  children,
}: {
  weekLabel: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`Completed games — ${weekLabel} (${count})`}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open ? "rotate-180" : "",
          )}
        />
        Completed ({count})
      </button>
      <div id={contentId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
