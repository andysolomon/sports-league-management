import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Destination-labeled back navigation for workspace sub-pages (WSM-000236).
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3.5 inline-flex items-center gap-1.5 text-[13.5px] text-text-muted hover:text-foreground"
    >
      <ArrowLeft className="h-[15px] w-[15px] shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
