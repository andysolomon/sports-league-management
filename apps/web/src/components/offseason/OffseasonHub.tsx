import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FreeAgentRow } from "@/lib/offseason-free-agency";
import { FreeAgencyPanel } from "./FreeAgencyPanel";
import { OffseasonPhaseStepper } from "./OffseasonPhaseStepper";

export interface OffseasonHubProps {
  seasonId: string;
  seasonName: string;
  agents: FreeAgentRow[];
  teams: { id: string; name: string }[];
  canSign: boolean;
  isAdmin: boolean;
  coachTeam: { id: string; name: string } | null;
}

export function OffseasonHub({
  seasonId,
  seasonName,
  agents,
  teams,
  canSign,
  isAdmin,
  coachTeam,
}: OffseasonHubProps) {
  return (
    <Card className="mb-6" data-testid="offseason-hub">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-xl">
          <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
          Offseason hub
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {seasonName} is in the upcoming offseason window. Complete free agency
          before activating the season.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <OffseasonPhaseStepper activePhase="free_agency" />
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
