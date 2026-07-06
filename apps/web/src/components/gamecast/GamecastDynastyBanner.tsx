import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface GamecastDynastyBannerProps {
  leagueId: string;
}

export default function GamecastDynastyBanner({
  leagueId,
}: GamecastDynastyBannerProps) {
  return (
    <div
      className="border-b border-border bg-card px-5 py-4"
      data-testid="gamecast-dynasty-banner"
    >
      <p className="text-sm font-medium text-foreground">Season decided</p>
      <p className="mt-1 text-caption-12 text-text-muted">
        Advance to the next season from the league dynasty panel.
      </p>
      <Button asChild size="sm" className="mt-3">
        <Link href={`/dashboard/leagues/${leagueId}#dynasty-panel`}>
          Go to dynasty panel
        </Link>
      </Button>
    </div>
  );
}
