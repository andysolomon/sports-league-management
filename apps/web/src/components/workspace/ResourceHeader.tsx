"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isActiveHref,
  type ResourceHeaderKind,
  type ResourceSiblingLink,
} from "./resource-navigation";

/**
 * Resource Header (WSM-000571, ASR-7, ASR-18, ASR-19, ASR-20).
 *
 * Title-first: the page states its own name as an `h1`, with a muted,
 * non-interactive context line naming the owning resources. Ancestry is
 * orientation only — it is deliberately not a breadcrumb trail, so no segment
 * is a link and no separator chevrons are rendered. Moving up happens through
 * the topbar League switcher, the topbar Back control, and the primary nav.
 *
 * Sibling subpages render as a pill row with the active pill marked via
 * `aria-current="page"`. The Resource Header is presentation-only — it never
 * fetches data, so access checks remain the caller's responsibility.
 *
 * `usePathname()` drives active-sibling highlighting automatically; callers
 * don't need to thread the current URL.
 */
export function ResourceHeader({
  kind,
  title,
  homeHref,
  context,
  status,
  actions,
  siblings,
  currentHref,
  className,
}: {
  kind: ResourceHeaderKind;
  /** The page's own name — the league/team/player/season name on a Home page,
   *  otherwise the subpage label ("Schedule", "Roster", "Join requests"). */
  title: string;
  /** Canonical Home for this resource. Only used to resolve which sibling is
   *  the Home entry, so it is required only when `siblings` are supplied. */
  homeHref?: string;
  /** Muted orientation line, e.g. "2028 · Cobb County Football". Plain text —
   *  do not pass links; ancestry here is not a navigation affordance. */
  context?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  siblings?: ResourceSiblingLink[];
  /** Optional override; defaults to the live pathname (path-segment compare). */
  currentHref?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const comparePath = (currentHref ?? pathname ?? "").split("?")[0] ?? "";
  const homePath = homeHref?.split("?")[0] ?? null;
  const dataTestId = `resource-header-${kind}`;

  return (
    <header
      data-testid={dataTestId}
      aria-label={`${kind} header`}
      className={cn(
        "flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4",
        className,
      )}
    >
      {/* `min-w-*` rather than `min-w-0`: action clusters on pages like Schedule
          are wide enough to squeeze a `flex-1` sibling to zero, which made the
          title overflow across them. A floor forces the actions to wrap to
          their own line instead. */}
      <div className="min-w-[260px] flex-1 basis-[260px]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-[28px] font-extrabold leading-[1.05] tracking-[-1px] text-foreground">
            {title}
          </h1>
          {status}
        </div>
        {context ? (
          <div className="mt-2 text-[14.5px] text-text-muted">{context}</div>
        ) : null}
        {siblings && siblings.length > 0 ? (
          <nav
            aria-label={`${kind} sections`}
            className="mt-3 flex flex-wrap gap-1"
          >
            {siblings.map((sibling) => {
              const [siblingPath] = sibling.href.split("?");
              const isHomeSibling = siblingPath === homePath;
              const isActive =
                comparePath === siblingPath ||
                (!isHomeSibling && isActiveHref(comparePath, sibling.href));
              return (
                <Link
                  key={sibling.href}
                  href={sibling.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-surface-2 text-foreground"
                      : "text-text-muted hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {sibling.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 md:ml-auto md:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
