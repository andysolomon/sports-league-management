import { notFound } from "next/navigation";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import { leagueHomeHref, seasonHomeHref } from "@/components/workspace/resource-navigation";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

/*
 * Visual-regression harness (WSM-000236). Renders the unified workspace shell
 * with fixed, deterministic data — no Convex, no auth, no seeding.
 */

const LEAGUE = {
  id: "league-visual",
  name: "National Football League",
  teams: 32,
  seasons: 3,
};

const SEASON = {
  id: "season-visual",
  name: "2025-2026 NFL Season",
  status: "active",
  leagueName: LEAGUE.name,
  dateRange: "Sep 4, 2025 – Jan 4, 2026",
};

export default function WorkspaceVisualHarness() {
  // Only hide on the real Vercel production deploy — local `vercel env pull`
  // can set VERCEL_ENV=production and would otherwise 404 the harnesses.
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
    notFound();
  }

  return (
    <div className="bg-background p-6">
      <div data-testid="workspace-league" className="w-[760px]">
        <ResourceHeader
          kind="league"
          title={LEAGUE.name}
          homeHref={leagueHomeHref(LEAGUE.id)}
          status={
            <Badge variant="secondary" className="shrink-0">
              Organization
            </Badge>
          }
          context={`${LEAGUE.teams} teams · ${LEAGUE.seasons} seasons`}
          actions={
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              Admin action
            </button>
          }
        />
      </div>

      <div data-testid="workspace-season" className="mt-10 w-[760px]">
        <ResourceHeader
          kind="season"
          title={SEASON.name}
          homeHref={seasonHomeHref(SEASON.id)}
          status={<StatusBadge status={SEASON.status} />}
          context={`${SEASON.leagueName} · ${SEASON.dateRange}`}
          siblings={[
            {
              label: "Overview",
              href: seasonHomeHref(SEASON.id),
            },
            {
              label: "Schedule",
              href: `/dashboard/seasons/${SEASON.id}/schedule`,
            },
            {
              label: "Standings",
              href: `/dashboard/seasons/${SEASON.id}/standings`,
            },
            {
              label: "Playoffs",
              href: `/dashboard/seasons/${SEASON.id}/playoffs`,
            },
          ]}
        />
      </div>
    </div>
  );
}