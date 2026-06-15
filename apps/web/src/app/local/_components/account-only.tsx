import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Marks a capability that inherently needs a server (org sharing, multi-user
 * roles, public viewer links, Discover forks, cloud backup) as account-only —
 * the "clearly marked" half of AC #2 (RFC §7). Rendered as a dashed upgrade chip
 * linking to sign-up, so the boundary doubles as the upgrade funnel rather than
 * a dead end. Local-capable features are simply present in the shell; these are
 * the ones intentionally not.
 */
export function AccountOnly({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  return (
    <Link
      href="/sign-up"
      className="group flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2.5 transition-colors hover:border-primary hover:bg-card"
    >
      <span>
        <span className="block text-sm font-medium text-foreground">
          {feature}
        </span>
        {description && (
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <Badge
        variant="outline"
        className="shrink-0 gap-1 text-muted-foreground group-hover:text-primary"
      >
        <Lock className="h-3 w-3" />
        Free account
      </Badge>
    </Link>
  );
}
