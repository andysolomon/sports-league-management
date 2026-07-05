import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface GamecastEmptyStateProps {
  leagueId: string;
  reason: "no_log" | "parse_error";
}

export function gamecastEmptyMessage(reason: GamecastEmptyStateProps["reason"]): string {
  if (reason === "parse_error") {
    return "This game has a play log that could not be read. Try re-simulating the fixture.";
  }
  return "Gamecast is available for simulated games with a stored play-by-play log. Record a result via simulation or open a game that was simmed from the schedule.";
}

export default function GamecastEmptyState({
  leagueId,
  reason,
}: GamecastEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">{gamecastEmptyMessage(reason)}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={`/dashboard/leagues/${leagueId}/schedule`}>
            Back to schedule
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
