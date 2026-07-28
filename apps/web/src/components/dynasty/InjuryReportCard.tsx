import { HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InjuryDto } from "@/lib/data-api";

/*
 * Injury report (Dynasty Mode A4).
 *
 * Shows what a coach needs before setting a lineup: who is out, for how many
 * more games, and who has come back. `gamesOut` is the countdown, not the
 * projected week — a bye moves the date but not the number of games owed.
 */

export interface InjuryReportCardProps {
  injuries: InjuryDto[];
  playerNames: Record<string, string>;
}

function describe(injury: InjuryDto): string {
  if (injury.status !== "out") return "Available";
  if (injury.gamesOut <= 0) return "Available";
  return `Out ${injury.gamesOut} more game${injury.gamesOut === 1 ? "" : "s"}`;
}

export function InjuryReportCard({
  injuries,
  playerNames,
}: InjuryReportCardProps) {
  const out = injuries.filter(
    (injury) => injury.status === "out" && injury.gamesOut > 0,
  );
  const returned = injuries.filter(
    (injury) => injury.status !== "out" || injury.gamesOut <= 0,
  );

  return (
    <Card className="mb-6" data-testid="injury-report">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-xl">
          <HeartPulse className="h-5 w-5 text-primary" aria-hidden />
          Injury report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {injuries.length === 0 ? (
          <p
            className="text-caption-12 text-text-muted"
            data-testid="injury-report-empty"
          >
            No injuries this season.
          </p>
        ) : (
          <>
            {out.length > 0 && (
              <ul className="divide-y divide-border" data-testid="injury-report-out">
                {out.map((injury) => (
                  <li
                    key={injury.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                    data-testid="injury-row"
                  >
                    <div className="min-w-0">
                      <p className="text-label-14 text-foreground">
                        {playerNames[injury.playerId] ?? "Unknown player"}
                      </p>
                      <p className="text-caption-12 text-text-muted">
                        {injury.label}
                        {injury.weekOccurred !== null
                          ? ` · hurt in Week ${injury.weekOccurred}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-control border border-border px-2 py-1 text-caption-12 text-text-muted"
                      data-testid="injury-status"
                    >
                      {describe(injury)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {returned.length > 0 && (
              <div data-testid="injury-report-returned">
                <p className="text-caption-12 text-text-muted">
                  Back from injury:{" "}
                  {returned
                    .map((injury) => playerNames[injury.playerId] ?? "Unknown")
                    .join(", ")}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
