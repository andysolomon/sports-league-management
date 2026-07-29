"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveTeamProgramAction } from "@/app/dashboard/_actions/team-program";
import {
  DEFENSE_SCHEME_LIST,
  OFFENSE_SCHEME_LIST,
  schemeFit,
  type SchemeFitRoster,
} from "@/lib/program/schemes";
import type { TeamProgramDto } from "@/lib/data-api";

/*
 * What this team runs (Dynasty Mode A6).
 *
 * On Team Home rather than League Settings, because — unlike a rivalry — a
 * scheme only changes how YOUR team plays. That placement is also what makes
 * the multi-coach wave a no-op for this card: it already sits on the surface a
 * single-team coach owns.
 */

const UNSET = "";

/** 50 is neutral on every dial; an unset dial is neutral too, and stays unset. */
const NEUTRAL_DIAL = 50;

export interface TeamSchemeCardProps {
  seasonId: string;
  teamId: string;
  program: TeamProgramDto | null;
  /** False for a viewer who cannot manage this team — the card is read-only. */
  canManage: boolean;
  rosterForFit?: SchemeFitRoster;
}

function dialLabel(value: number | null): string {
  if (value === null) return "Not set";
  if (value === NEUTRAL_DIAL) return "Balanced (50)";
  return String(value);
}

function fitLabel(value: number): string {
  return `${Math.round(value * 100)}% roster fit`;
}

export function TeamSchemeCard({
  seasonId,
  teamId,
  program,
  canManage,
  rosterForFit = { players: [] },
}: TeamSchemeCardProps) {
  const [offense, setOffense] = useState(program?.offenseScheme ?? UNSET);
  const [defense, setDefense] = useState(program?.defenseScheme ?? UNSET);
  const [tempo, setTempo] = useState(program?.tempo ?? NEUTRAL_DIAL);
  const [blitzRate, setBlitzRate] = useState(program?.blitzRate ?? NEUTRAL_DIAL);
  const [aggression, setAggression] = useState(
    program?.aggression ?? NEUTRAL_DIAL,
  );
  const [saved, setSaved] = useState<TeamProgramDto | null>(program);
  const [pending, startTransition] = useTransition();

  const offenseFit =
    offense && offense !== UNSET ? schemeFit(offense, rosterForFit) : null;
  const defenseFit =
    defense && defense !== UNSET ? schemeFit(defense, rosterForFit) : null;

  function save() {
    startTransition(async () => {
      const result = await saveTeamProgramAction({
        seasonId,
        teamId,
        // An empty select means "no scheme", which is sent as absence rather
        // than as the balanced scheme — they read the same to the engine but
        // only one of them is a decision somebody made.
        offenseScheme: offense === UNSET ? undefined : offense,
        defenseScheme: defense === UNSET ? undefined : defense,
        tempo,
        blitzRate,
        aggression,
      });
      if (!result.ok) {
        toast.error(`Could not save scheme: ${result.error}`);
        return;
      }
      setSaved(result.data);
      toast.success("Scheme saved.");
    });
  }

  return (
    <Card className="mb-6" data-testid="team-scheme-card">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 text-xl">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
          Scheme
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-caption-12 text-text-muted">
          What this program runs. A Flexbone runs the ball and the clock; an Air
          Raid throws it. Leave a scheme unset to play the league&apos;s default.
        </p>

        {!canManage ? (
          <dl
            className="grid grid-cols-2 gap-3 text-body-15"
            data-testid="team-scheme-readonly"
          >
            <div>
              <dt className="text-caption-12 text-text-muted">Offense</dt>
              <dd data-testid="team-scheme-offense-value">
                {OFFENSE_SCHEME_LIST.find((s) => s.id === saved?.offenseScheme)
                  ?.label ?? "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-caption-12 text-text-muted">Defense</dt>
              <dd data-testid="team-scheme-defense-value">
                {DEFENSE_SCHEME_LIST.find((s) => s.id === saved?.defenseScheme)
                  ?.label ?? "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-caption-12 text-text-muted">Tempo</dt>
              <dd>{dialLabel(saved?.tempo ?? null)}</dd>
            </div>
            <div>
              <dt className="text-caption-12 text-text-muted">Blitz rate</dt>
              <dd>{dialLabel(saved?.blitzRate ?? null)}</dd>
            </div>
          </dl>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-caption-12 text-text-muted">Offense</span>
                <select
                  className="h-9 w-48 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
                  value={offense}
                  data-testid="team-scheme-offense"
                  onChange={(e) => setOffense(e.target.value)}
                >
                  <option value={UNSET}>Not set</option>
                  {OFFENSE_SCHEME_LIST.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-caption-12 text-text-muted">Defense</span>
                <select
                  className="h-9 w-48 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
                  value={defense}
                  data-testid="team-scheme-defense"
                  onChange={(e) => setDefense(e.target.value)}
                >
                  <option value={UNSET}>Not set</option>
                  {DEFENSE_SCHEME_LIST.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {(
                [
                  ["Tempo", tempo, setTempo, "team-scheme-tempo"],
                  ["Blitz rate", blitzRate, setBlitzRate, "team-scheme-blitz"],
                  [
                    "Aggression",
                    aggression,
                    setAggression,
                    "team-scheme-aggression",
                  ],
                ] as const
              ).map(([label, value, setValue, testid]) => (
                <label key={testid} className="flex flex-col gap-1">
                  <span className="text-caption-12 text-text-muted">
                    {label} 0–100
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="h-9 w-24 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
                    value={value}
                    data-testid={testid}
                    onChange={(e) => setValue(Number(e.target.value))}
                  />
                </label>
              ))}

              <Button
                size="sm"
                disabled={pending}
                data-testid="team-scheme-save"
                onClick={save}
              >
                {pending ? "Saving…" : "Save scheme"}
              </Button>
            </div>

            <p className="text-caption-12 text-text-muted">
              {OFFENSE_SCHEME_LIST.find((s) => s.id === offense)?.blurb ??
                "No offensive scheme set."}
              {offenseFit !== null ? (
                <span data-testid="team-scheme-offense-fit">
                  {" "}
                  · {fitLabel(offenseFit)}
                </span>
              ) : null}
              {defenseFit !== null ? (
                <span data-testid="team-scheme-defense-fit">
                  {" "}
                  · Defense {fitLabel(defenseFit)}
                </span>
              ) : null}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
