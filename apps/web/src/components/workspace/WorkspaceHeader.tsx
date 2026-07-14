import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkspaceHeaderSize = "top-level" | "sub-hub";

/**
 * Shared workspace page header: title, optional inline status, context line,
 * optional inline nav row, and right-aligned actions (WSM-000236, WSM-000247).
 *
 * Matches the prototype hub header (`PageHeader` / season-hub header in the
 * leagues-seasons handoff): 800-weight title at 30px (28px for sub-hubs) with
 * -1px letter spacing, 14.5px muted context line, and the peer-nav link row
 * living inside the header block directly under the context line.
 */
export function WorkspaceHeader({
  title,
  status,
  sub,
  nav,
  actions,
  size = "top-level",
}: {
  title: string;
  status?: ReactNode;
  sub?: ReactNode;
  nav?: ReactNode;
  actions?: ReactNode;
  size?: WorkspaceHeaderSize;
}) {
  return (
    <header className="mb-[22px] flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className={cn(
              "font-extrabold leading-[1.05] tracking-[-1px] text-foreground",
              size === "sub-hub" ? "text-[28px]" : "text-[30px]",
            )}
          >
            {title}
          </h1>
          {status}
        </div>
        {sub ? (
          <div className="mt-2 text-[14.5px] text-text-muted">{sub}</div>
        ) : null}
        {nav}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
