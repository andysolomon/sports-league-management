import Link from "next/link";

/**
 * Destination-labeled back navigation for workspace sub-pages (WSM-000236).
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3.5 inline-flex items-center gap-1.5 text-[13.5px] text-text-muted hover:text-foreground"
    >
      <span aria-hidden>&larr;</span>
      {label}
    </Link>
  );
}
