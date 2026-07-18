import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ResourceHeaderKind, ResourceSiblingLink } from "./resource-navigation";

/**
 * Resource Header (WSM-000571, ASR-7, ASR-18, ASR-19, ASR-20).
 *
 * Replaces breadcrumb trails and destination-generated "Back to …" rows with
 * a stable header that identifies the resource, links the canonical Home,
 * exposes sibling subpage navigation, and marks the active sibling via
 * `aria-current="page"`. The Resource Header is presentation-only — it
 * never fetches data, so access checks remain the caller's responsibility.
 */
export function ResourceHeader({
  kind,
  name,
  href,
  subtitle,
  status,
  context,
  actions,
  siblings,
  currentHref,
  className,
}: {
  kind: ResourceHeaderKind;
  name: string;
  href: string;
  subtitle?: string;
  status?: React.ReactNode;
  context?: React.ReactNode;
  actions?: React.ReactNode;
  siblings?: ResourceSiblingLink[];
  currentHref?: string;
  className?: string;
}) {
  const [currentPath] = (currentHref ?? "").split("?");
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
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <Link
            href={href}
            className="font-semibold text-foreground hover:underline"
          >
            {name}
          </Link>
          {subtitle ? (
            <>
              <span aria-hidden>·</span>
              <span>{subtitle}</span>
            </>
          ) : null}
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
              const isActive = currentPath === siblingPath;
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
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}