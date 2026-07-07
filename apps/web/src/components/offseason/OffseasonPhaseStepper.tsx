import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DraftPhaseStatus = "none" | "active" | "complete";

interface PhaseDef {
  id: string;
  label: string;
  state: "complete" | "active" | "upcoming" | "disabled";
}

function buildPhases(draftStatus: DraftPhaseStatus): PhaseDef[] {
  const draftState: PhaseDef["state"] =
    draftStatus === "none"
      ? "disabled"
      : draftStatus === "active"
        ? "active"
        : "complete";

  const freeAgencyState: PhaseDef["state"] =
    draftStatus === "active" ? "upcoming" : "active";

  return [
    { id: "rollover", label: "Rollover", state: "complete" },
    { id: "draft", label: "Draft", state: draftState },
    { id: "free_agency", label: "Free agency", state: freeAgencyState },
    { id: "activate", label: "Activate", state: "upcoming" },
  ];
}

export interface OffseasonPhaseStepperProps {
  draftStatus?: DraftPhaseStatus;
}

export function OffseasonPhaseStepper({
  draftStatus = "none",
}: OffseasonPhaseStepperProps) {
  const phases = buildPhases(draftStatus);

  return (
    <nav
      aria-label="Offseason phases"
      className="w-full min-w-0"
      data-testid="offseason-phase-stepper"
    >
      <ol className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
        {phases.map((phase, index) => (
          <li
            key={phase.id}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2",
              index < phases.length - 1 && "sm:pr-2",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-control border px-3 py-2 text-sm",
                phase.state === "complete" &&
                  "border-primary/30 bg-primary/5 text-foreground",
                phase.state === "active" &&
                  "border-primary bg-primary/10 text-foreground",
                phase.state === "disabled" &&
                  "border-border bg-muted/40 text-muted-foreground",
                phase.state === "upcoming" &&
                  "border-border bg-card text-muted-foreground",
              )}
            >
              <span className="shrink-0" aria-hidden>
                {phase.state === "complete" ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Circle
                    className={cn(
                      "h-4 w-4",
                      phase.state === "active"
                        ? "fill-primary text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                )}
              </span>
              <span className="min-w-0 truncate font-medium">{phase.label}</span>
              {phase.state === "disabled" && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  Optional
                </span>
              )}
            </div>
            {index < phases.length - 1 && (
              <span
                className="hidden shrink-0 text-muted-foreground sm:inline"
                aria-hidden
              >
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
