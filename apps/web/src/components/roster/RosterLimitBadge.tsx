import { Badge } from "@/components/ui/badge";

export interface RosterLimitBadgeProps {
  activeCount: number;
  rosterLimit: number | null;
}

export default function RosterLimitBadge({
  activeCount,
  rosterLimit,
}: RosterLimitBadgeProps) {
  if (rosterLimit === null) {
    return (
      <Badge variant="secondary" className="font-mono">
        {activeCount} active
      </Badge>
    );
  }

  const atLimit = activeCount >= rosterLimit;
  return (
    <Badge
      variant={atLimit ? "destructive" : "secondary"}
      className="font-mono"
      aria-label={`${activeCount} of ${rosterLimit} roster slots used`}
    >
      {activeCount} / {rosterLimit}
    </Badge>
  );
}
