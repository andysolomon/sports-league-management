import { notFound } from "next/navigation";
import type { Standing } from "@sports-management/shared-types";
import StandingsTable from "@/components/schedule/StandingsTable";

/*
 * Visual-regression harness (WSM-000082). Renders StandingsTable with fixed,
 * deterministic rows so Playwright's toHaveScreenshot has a stable target —
 * no Convex, no auth, no seeding. Rows include positive / negative / zero
 * point differentials to exercise the conditional +/− coloring. Never shipped
 * to production.
 */

const ROWS: Standing[] = [
  {
    teamId: "t1",
    teamName: "Buffalo Bills",
    wins: 13,
    losses: 4,
    ties: 0,
    pointsFor: 512,
    pointsAgainst: 380,
    divisionRank: 1,
    leagueRank: 1,
  },
  {
    teamId: "t2",
    teamName: "Miami Dolphins",
    wins: 9,
    losses: 8,
    ties: 0,
    pointsFor: 401,
    pointsAgainst: 401,
    divisionRank: 2,
    leagueRank: 7,
  },
  {
    teamId: "t3",
    teamName: "New York Jets",
    wins: 4,
    losses: 12,
    ties: 1,
    pointsFor: 289,
    pointsAgainst: 410,
    divisionRank: 4,
    leagueRank: 15,
  },
];

export default function StandingsTableVisualHarness() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <div className="bg-background p-6">
      <div data-testid="standings" className="w-[760px]">
        <StandingsTable rows={ROWS} />
      </div>
    </div>
  );
}
