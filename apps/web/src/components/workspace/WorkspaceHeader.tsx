import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkspaceHeaderSize = "top-level" | "sub-hub";

/**
 * Shared workspace page header: title, optional inline status, context line,
 * and right-aligned actions (WSM-000236).
 */
export function WorkspaceHeader({
  title,
  status,
  sub,
  actions,
  size = "top-level",
}: {
  title: string;
  status?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  size?: WorkspaceHeaderSize;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className={cn(
              "font-extrabold tracking-[-0.06em] text-foreground",
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
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
