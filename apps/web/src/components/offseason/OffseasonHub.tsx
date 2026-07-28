import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DraftDto } from "@/lib/data-api";
import type { FreeAgentRow } from "@/lib/offseason-free-agency";
import type { OffseasonDto } from "@/lib/data-api";
import {
  resolveOffseasonState,
  type DraftPhaseStatus,
} from "@/lib/dynasty/offseason-phases";
import { DraftBoard } from "./DraftBoard";
import { DraftStartToggle } from "./DraftStartToggle";
import { FreeAgencyPanel } from "./FreeAgencyPanel";
import { OffseasonPhaseStepper } from "./OffseasonPhaseStepper";

function draftPhaseStatus(draft: DraftDto | null): DraftPhaseStatus {
  if (!draft) return "none";
  if (draft.status === "complete") return "complete";
  return "active";
}

export interface OffseasonHubProps {
  leagueId: string;
  seasonId: string;
  seasonName: string;
  agents: FreeAgentRow[];
  teams: { id: string; name: string }[];
  canSign: boolean;
  isAdmin: boolean;
  coachTeam: { id: string; name: string } | null;
  draft: DraftDto | null;
  playerNames: Record<string, string>;
  /** Persisted phase state (B1); `null` for a season opened before the table. */
  offseason?: OffseasonDto | null;
}

export function OffseasonHub({
  leagueId,
  seasonId,
  seasonName,
  agents,
  teams,
  canSign,
  isAdmin,
  coachTeam,
  draft,
  playerNames,
  offseason = null,
}: OffseasonHubProps) {
  const draftStatus = draftPhaseStatus(draft);
  const phaseState = resolveOffseasonState(offseason, { draftStatus });

  return (
    <Card className="mb-6" data-testid="offseason-hub">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-xl">
          <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
          Offseason hub
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {seasonName} is in the upcoming offseason window. Run an optional
          draft, complete free agency, then activate the season.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <OffseasonPhaseStepper state={phaseState} />

        {isAdmin && !draft && (
          <DraftStartToggle leagueId={leagueId} seasonId={seasonId} />
        )}

        {draft && (
          <DraftBoard
            draft={draft}
            agents={agents}
            teams={teams}
            playerNames={playerNames}
            leagueId={leagueId}
            seasonId={seasonId}
            isAdmin={isAdmin}
          />
        )}

        <FreeAgencyPanel
          seasonId={seasonId}
          agents={agents}
          teams={teams}
          canSign={canSign}
          isAdmin={isAdmin}
          coachTeam={coachTeam}
        />
      </CardContent>
    </Card>
  );
}
