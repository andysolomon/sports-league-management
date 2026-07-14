import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Context breadcrumbs for league/season workspace pages (WSM-000236).
 * The last item renders as plain text; earlier items are links.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-text-muted"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 ? (
              <ChevronRight
                className="h-[13px] w-[13px] shrink-0 text-text-subtle"
                aria-hidden
              />
            ) : null}
            {isLast || !item.href ? (
              <span className="text-foreground">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
