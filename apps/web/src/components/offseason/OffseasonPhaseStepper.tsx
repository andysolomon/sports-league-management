import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildPhaseSteps,
  type OffseasonState,
  type PhaseStep,
} from "@/lib/dynasty/offseason-phases";

export type { DraftPhaseStatus } from "@/lib/dynasty/offseason-phases";

/*
 * The stepper reads PERSISTED state (B1).
 *
 * It used to compute four phases from draft status, which meant the offseason
 * had no memory: nothing was resumable, nothing could be gated, and every
 * phase added after the draft would have needed another derived rule. The
 * phase now comes from the `offseasons` row; `resolveOffseasonState` is where
 * a season without one is turned into something renderable.
 */
export interface OffseasonPhaseStepperProps {
  state: OffseasonState;
}

export function OffseasonPhaseStepper({ state }: OffseasonPhaseStepperProps) {
  const phases = buildPhaseSteps(state);

  return (
    <nav
      aria-label="Offseason phases"
      className="w-full min-w-0"
      data-testid="offseason-phase-stepper"
      data-phase={state.phase}
    >
      <ol className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
        {phases.map((phase, index) => (
          <li
            key={phase.id}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2",
              index < phases.length - 1 && "sm:pr-2",
            )}
            data-testid={`offseason-phase-${phase.id}`}
            data-state={phase.state}
          >
            <div className={stepClass(phase.state)}>
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
              {phase.state === "optional" && (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  Skipped
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

function stepClass(state: PhaseStep["state"]): string {
  return cn(
    "flex min-w-0 flex-1 items-center gap-2 rounded-control border px-3 py-2 text-sm",
    state === "complete" && "border-primary/30 bg-primary/5 text-foreground",
    state === "active" && "border-primary bg-primary/10 text-foreground",
    state === "optional" && "border-border bg-muted/40 text-muted-foreground",
    state === "upcoming" && "border-border bg-card text-muted-foreground",
  );
}
