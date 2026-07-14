"use client";

/*
 * WSM-000239 — lifecycle-aware accordion timeline for the schedule page.
 * WSM-000250 — visual polish to the leagues-seasons prototype treatment:
 * left-chevron accordion weeks with a games-count subtitle and a played
 * status chip, full-bleed fixture tables, and a regular-season progress
 * line beside Expand/Collapse all.
 *
 * Presentation-only: the server page does ALL data fetching and renders each
 * week's fixture table (and per-week action buttons) into slots; this
 * component just composes them into a controlled multi-open accordion.
 * `initialOpenKeys` comes from the same pure helper the server used
 * (initialOpenWeekKeys), so the first client render matches the server HTML.
 */

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScheduleWeekView {
  /** Stable accordion value from weekKey(): "week-<n>" | "unscheduled". */
  key: string;
  /** "Week <n>" | "Unscheduled" — the trigger's accessible name starts with this. */
  label: string;
  status: "completed" | "upcoming" | "mixed";
  /** Muted per-week subtitle shown in the trigger, e.g. "4 games". */
  summary?: string;
  /** Total games in the week — drives the "x/y played" status chip. */
  totalCount: number;
  /** Completed (final or cancelled) games in the week. */
  completedCount: number;
  /** Per-week action controls (e.g. Sim week) — rendered OUTSIDE the trigger button. */
  actions?: ReactNode;
  /**
   * The week's fixture table. For mixed weeks this is the REMAINING
   * (scheduled/live) games only — always visible while the week is open.
   */
  content: ReactNode;
  /** Mixed weeks: completed games, shown inside the nested collapsed subsection. */
  completedContent?: ReactNode;
}

export interface ScheduleWeeksProps {
  weeks: ScheduleWeekView[];
  /** Initial open accordion values — completed weeks closed, others open. */
  initialOpenKeys: string[];
  /** Regular-season progress for the "x/y regular-season games played" line. */
  progress?: { final: number; total: number };
}

/*
 * Week status chip — prototype tone slot. Deliberately NOT the words
 * "Scheduled"/"Final": those exact texts are asserted per-row by e2e
 * (sim-scopes, gamecast) and a week-level duplicate would trip strict mode.
 */
const CHIP_VARIANT = {
  completed: "secondary",
  mixed: "warning",
  upcoming: "outline",
} as const;

export default function ScheduleWeeks({
  weeks,
  initialOpenKeys,
  progress,
}: ScheduleWeeksProps) {
  const [openKeys, setOpenKeys] = useState<string[]>(initialOpenKeys);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {progress && progress.total > 0 ? (
          <p className="text-[13px] text-muted-foreground">
            <span className="font-mono tabular-nums">
              {progress.final}/{progress.total}
            </span>{" "}
            regular-season games played
          </p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setOpenKeys(weeks.map((week) => week.key))}
          >
            Expand all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setOpenKeys([])}
          >
            Collapse all
          </Button>
        </div>
      </div>
      <Accordion
        type="multiple"
        value={openKeys}
        onValueChange={setOpenKeys}
        className="space-y-3"
      >
        {weeks.map((week) => (
          <AccordionItem
            key={week.key}
            value={week.key}
            // Keeps the e2e weekCard() helper working: week containers were
            // previously ui/Card elements, which carry data-slot="card".
            data-slot="card"
            data-week-status={week.status}
            className="overflow-hidden rounded-lg border border-border bg-card last:border-b"
          >
            <div className="flex items-center gap-2 pr-3">
              {/* The shadcn trigger appends its own right chevron as a direct-
                  child svg — hide it and rotate a left chevron instead (the
                  custom one lives inside the span so the [&>svg] selectors
                  never touch it). */}
              <AccordionTrigger className="group min-w-0 flex-1 justify-start px-4 py-3.5 hover:no-underline focus-visible:ring-inset focus-visible:ring-offset-0 [&>svg]:hidden">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90"
                  />
                  <span className="text-[15px] font-bold tracking-tight">
                    {week.label}
                  </span>
                  {week.summary ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      {week.summary}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      badgeVariants({ variant: CHIP_VARIANT[week.status] }),
                      "font-mono text-[11px] font-medium tabular-nums",
                    )}
                  >
                    {week.completedCount}/{week.totalCount} played
                  </span>
                </span>
              </AccordionTrigger>
              {week.actions ? (
                <div className="flex shrink-0 items-center gap-1">
                  {week.actions}
                </div>
              ) : null}
            </div>
            <AccordionContent className="border-t border-border pb-0">
              {week.status === "mixed" ? (
                <div>
                  {week.content}
                  <CompletedSubsection
                    weekLabel={week.label}
                    count={week.completedCount}
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
 * aria-controls wired to an always-present (hidden) content region. The
 * aria-label ("Completed games — Week N (n)") is an e2e-pinned accessible name.
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
    <div className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`Completed games — ${weekLabel} (${count})`}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open ? "rotate-90" : "",
          )}
        />
        Completed games ({count})
      </button>
      <div
        id={contentId}
        hidden={!open}
        className="border-t border-border"
      >
        {children}
      </div>
    </div>
  );
}
