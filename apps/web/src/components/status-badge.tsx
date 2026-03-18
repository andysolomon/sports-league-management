import { Badge, type BadgeProps } from "@/components/ui/badge";

const statusVariantMap: Record<string, BadgeProps["variant"]> = {
  Active: "success",
  Injured: "warning",
  Inactive: "secondary",
  Planned: "outline",
  "In Progress": "default",
  Completed: "success",
  Cancelled: "destructive",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusVariantMap[status] ?? "secondary";
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}
