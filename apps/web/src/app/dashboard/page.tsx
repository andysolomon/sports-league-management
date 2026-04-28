import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getTeams,
  getPlayers,
  getSeasons,
  getDivisions,
  getLeagues,
} from "@/lib/salesforce-api";
import { resolveOrgContext } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/8bit/card";
import {
  Trophy,
  Users,
  UserCircle,
  Calendar,
  Layers,
} from "lucide-react";

const statCards = [
  { label: "Leagues", href: "/dashboard/leagues", key: "leagues", icon: Trophy },
  { label: "Teams", href: "/dashboard/teams", key: "teams", icon: Users },
  { label: "Players", href: "/dashboard/players", key: "players", icon: UserCircle },
  { label: "Seasons", href: "/dashboard/seasons", key: "seasons", icon: Calendar },
  { label: "Divisions", href: "/dashboard/divisions", key: "divisions", icon: Layers },
] as const;

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Salesforce read path can fail in production (e.g., rotated Connected
  // App credentials, JWT_AUTH_FAILED). Degrade to zeros + surface a
  // non-fatal banner so the dashboard still renders and the rest of the
  // app stays navigable. Sprint 5 (Salesforce decoupling) makes this
  // graceful path the steady state.
  let counts: Record<string, number> = {
    leagues: 0,
    teams: 0,
    players: 0,
    seasons: 0,
    divisions: 0,
  };
  let degraded = false;

  try {
    const orgContext = await resolveOrgContext(userId);
    const ids = orgContext.visibleLeagueIds;
    const [leagues, teams, players, seasons, divisions] = await Promise.all([
      getLeagues(ids),
      getTeams(ids),
      getPlayers(ids),
      getSeasons(ids),
      getDivisions(ids),
    ]);
    counts = {
      leagues: leagues.length,
      teams: teams.length,
      players: players.length,
      seasons: seasons.length,
      divisions: divisions.length,
    };
  } catch (err) {
    degraded = true;
    console.error(
      JSON.stringify({
        level: "error",
        msg: "dashboard_overview_degraded",
        route: "/dashboard",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Overview</h2>
      {degraded ? (
        <div
          role="status"
          className="mb-4 border-2 border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-foreground"
        >
          Live data is temporarily unavailable. Showing placeholders while we
          reconnect.
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.key} href={card.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {counts[card.key]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
