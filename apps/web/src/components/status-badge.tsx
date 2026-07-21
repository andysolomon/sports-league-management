import { Badge, type BadgeProps } from "@/components/ui/badge";

const statusVariantMap: Record<string, BadgeProps["variant"]> = {
  // Player statuses
  Active: "success",
  Injured: "warning",
  Inactive: "secondary",
  // Season / generic statuses
  Planned: "outline",
  Upcoming: "outline",
  "In Progress": "default",
  Completed: "success",
  Cancelled: "destructive",
  // Game (fixture) statuses
  Scheduled: "outline",
  Final: "secondary",
};

/**
 * Resolve a status string to its badge variant + display label. Matching is
 * case-insensitive so non-canonical casing (e.g. a synthetic roster's
 * lowercase "active") still maps to the right variant and renders the
 * canonical label ("Active"). Unknown statuses pass through unchanged with a
 * neutral variant.
 */
export function resolveStatusBadge(status: string): {
  variant: BadgeProps["variant"];
  label: string;
} {
  const canonicalKey = Object.keys(statusVariantMap).find(
    (key) => key.toLowerCase() === status.toLowerCase(),
  );
  return {
    variant: canonicalKey ? statusVariantMap[canonicalKey] : "secondary",
    label: canonicalKey ?? status,
  };
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { variant, label } = resolveStatusBadge(status);
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
