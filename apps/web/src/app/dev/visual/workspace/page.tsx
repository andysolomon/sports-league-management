import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/workspace/Breadcrumbs";
import { BackLink } from "@/components/workspace/BackLink";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
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
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <div className="bg-background p-6">
      <div data-testid="workspace-league" className="w-[760px]">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Leagues", href: "/dashboard/leagues" },
            { label: LEAGUE.name },
          ]}
        />
        <WorkspaceHeader
          title={LEAGUE.name}
          status={
            <Badge variant="secondary" className="shrink-0">
              Organization
            </Badge>
          }
          sub={`${LEAGUE.teams} teams · ${LEAGUE.seasons} seasons`}
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
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Seasons", href: "/dashboard/seasons" },
            { label: SEASON.name },
          ]}
        />
        <BackLink href="/dashboard/seasons" label="Back to Seasons" />
        <WorkspaceHeader
          title={SEASON.name}
          size="sub-hub"
          status={<StatusBadge status={SEASON.status} />}
          sub={
            <>
              <Link
                href={`/dashboard/leagues/${LEAGUE.id}`}
                className="text-accent hover:underline"
              >
                {SEASON.leagueName}
              </Link>
              {" · "}
              {SEASON.dateRange}
            </>
          }
        />
        <WorkspaceNav
          links={[
            {
              href: `/dashboard/leagues/${LEAGUE.id}/schedule?season=${SEASON.id}`,
              label: "Schedule",
            },
            {
              href: `/dashboard/leagues/${LEAGUE.id}/standings?season=${SEASON.id}`,
              label: "Standings",
            },
            {
              href: `/dashboard/leagues/${LEAGUE.id}/playoffs?season=${SEASON.id}`,
              label: "Playoffs",
            },
          ]}
        />
      </div>
    </div>
  );
}
