"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveDynastyConfigAction } from "@/app/dashboard/_actions/dynasty-config";
import {
  DYNASTY_CONFIG_BOUNDS,
  type DynastyConfig,
  type TransferVolume,
} from "@/lib/dynasty-config";

/*
 * Dynasty settings (F5).
 *
 * Commissioner-facing kill switches and budgets, saved per league at runtime.
 * Each row saves on its own so a slow save never blocks the rest of the form
 * and a failure is scoped to the knob that failed — a single "Save all" button
 * would leave the user unsure which setting actually landed.
 */

const TOGGLES: Array<{
  key: keyof DynastyConfig;
  label: string;
  description: string;
}> = [
  {
    key: "scoringDepthEnabled",
    label: "Scoring depth",
    description:
      "Safeties, two-point tries, return touchdowns and fumbles on any play.",
  },
  {
    key: "penaltiesEnabled",
    label: "Penalties",
    description: "Flags are thrown during simulated games.",
  },
  {
    key: "situationalAiEnabled",
    label: "Situational AI",
    description:
      "Fourth-down decisions, timeouts, the two-minute drill and clock management.",
  },
  {
    key: "balanceTuningEnabled",
    label: "Balance tuning",
    description:
      "Corrected home-field advantage. Turn off only to match games played before it.",
  },
  {
    key: "injuriesEnabled",
    label: "Injuries",
    description: "Players can be hurt and miss games.",
  },
  {
    key: "weatherEnabled",
    label: "Weather",
    description: "Cold, wind and rain affect play outcomes.",
  },
  {
    key: "transfersEnabled",
    label: "Transfers",
    description: "Players move between programs in the offseason.",
  },
  {
    key: "jobSecurityEnabled",
    label: "Job security",
    description: "Coaches can be fired for missing season goals.",
  },
  {
    key: "pollsEnabled",
    label: "Weekly polls",
    description: "Power rankings are computed after each week.",
  },
];

const NUMBERS: Array<{
  key: "injurySeverityScale" | "scoutingPointsPerOffseason" | "trainingPointsPerOffseason" | "targetRosterSize";
  label: string;
  description: string;
  step: number;
}> = [
  {
    key: "injurySeverityScale",
    label: "Injury severity",
    description: "0 is none, 1 is normal, 2 is brutal.",
    step: 0.1,
  },
  {
    key: "scoutingPointsPerOffseason",
    label: "Scouting budget",
    description: "Points each team spends scouting incoming freshmen.",
    step: 10,
  },
  {
    key: "trainingPointsPerOffseason",
    label: "Training budget",
    description: "Points each team spends developing players.",
    step: 10,
  },
  {
    key: "targetRosterSize",
    label: "Target roster size",
    description: "Size the freshman class tops each roster back up to.",
    step: 1,
  },
];

const VOLUMES: TransferVolume[] = ["low", "normal", "high"];

export function DynastySettingsCard({
  leagueId,
  initialConfig,
}: {
  leagueId: string;
  initialConfig: DynastyConfig;
}) {
  const [config, setConfig] = useState<DynastyConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function save(patch: Partial<DynastyConfig>, label: string) {
    const key = Object.keys(patch)[0] ?? label;
    setSavingKey(key);
    startTransition(async () => {
      const result = await saveDynastyConfigAction({ leagueId, patch });
      if (result.ok) {
        // Trust the server's normalized result rather than the local guess —
        // it has clamped anything out of range.
        setConfig(result.data);
        toast.success(`${label} saved.`);
      } else {
        toast.error(`Could not save ${label}: ${result.error}`);
      }
      setSavingKey(null);
    });
  }

  return (
    <div className="space-y-4" data-testid="dynasty-settings">
      <div>
        <h3 className="text-label-14 text-foreground">Dynasty settings</h3>
        <p className="text-caption-12 text-text-muted">
          Simulation and offseason rules for this league. Changes apply to the
          next simulated game — no deploy needed.
        </p>
      </div>

      <div className="divide-y divide-border">
        {TOGGLES.map((toggle) => {
          const enabled = config[toggle.key] as boolean;
          return (
            <div
              key={toggle.key}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-label-14 text-foreground">{toggle.label}</p>
                <p className="text-caption-12 text-text-muted">
                  {toggle.description}
                </p>
              </div>
              <Button
                size="sm"
                variant={enabled ? "default" : "outline"}
                disabled={pending && savingKey === toggle.key}
                data-testid={`dynasty-toggle-${toggle.key}`}
                aria-pressed={enabled}
                onClick={() =>
                  save({ [toggle.key]: !enabled } as Partial<DynastyConfig>, toggle.label)
                }
              >
                {enabled ? "On" : "Off"}
              </Button>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-label-14 text-foreground">Transfer volume</p>
            <p className="text-caption-12 text-text-muted">
              How much roster churn an offseason produces.
            </p>
          </div>
          <div className="flex gap-1">
            {VOLUMES.map((volume) => (
              <Button
                key={volume}
                size="sm"
                variant={config.transferVolume === volume ? "default" : "outline"}
                disabled={pending && savingKey === "transferVolume"}
                data-testid={`dynasty-volume-${volume}`}
                aria-pressed={config.transferVolume === volume}
                onClick={() => save({ transferVolume: volume }, "Transfer volume")}
              >
                {volume}
              </Button>
            ))}
          </div>
        </div>

        {NUMBERS.map((field) => {
          const bounds = DYNASTY_CONFIG_BOUNDS[field.key];
          return (
            <div
              key={field.key}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-label-14 text-foreground">{field.label}</p>
                <p className="text-caption-12 text-text-muted">
                  {field.description} Range {bounds.min}–{bounds.max}.
                </p>
              </div>
              <input
                type="number"
                className="h-9 w-24 rounded-control border border-border bg-surface px-2 text-body-15 text-foreground"
                min={bounds.min}
                max={bounds.max}
                step={field.step}
                defaultValue={config[field.key]}
                disabled={pending && savingKey === field.key}
                data-testid={`dynasty-number-${field.key}`}
                aria-label={field.label}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next) || next === config[field.key]) {
                    return;
                  }
                  save(
                    { [field.key]: next } as Partial<DynastyConfig>,
                    field.label,
                  );
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
