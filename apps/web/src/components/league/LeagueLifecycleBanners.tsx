import { Trophy } from "lucide-react";
import type { LeagueLifecycleBanner } from "@/lib/league-lifecycle-banners";
import { Card, CardContent } from "@/components/ui/card";
import AdvanceToPlayoffsButton from "@/components/playoffs/AdvanceToPlayoffsButton";

export interface LeagueLifecycleBannersProps {
  banner: LeagueLifecycleBanner;
  leagueId: string;
  seasonId: string;
}

export function LeagueLifecycleBanners({
  banner,
  leagueId,
  seasonId,
}: LeagueLifecycleBannersProps) {
  if (banner.kind === "champion") {
    return (
      <Card
        className="mb-6 border-primary/40"
        data-testid="league-lifecycle-banner"
      >
        <CardContent className="flex items-start gap-3 p-5">
          <Trophy className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-primary">
              Season complete
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {banner.teamName ?? "Champion"} win {banner.seasonName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Advance to the next season, or review this one.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6" data-testid="league-lifecycle-banner">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Regular season complete</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {banner.progressFinal} of {banner.progressTotal} games final · seed
              the bracket to begin the playoffs.
            </p>
          </div>
        </div>
        {banner.state === "start" ? (
          <AdvanceToPlayoffsButton
            leagueId={leagueId}
            seasonId={seasonId}
            triggerLabel="Start playoffs"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Waiting for playoffs to start.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
