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

  const orgContext = await resolveOrgContext(userId);
  const ids = orgContext.visibleLeagueIds;

  const [leagues, teams, players, seasons, divisions] = await Promise.all([
    getLeagues(ids),
    getTeams(ids),
    getPlayers(ids),
    getSeasons(ids),
    getDivisions(ids),
  ]);

  const counts: Record<string, number> = {
    leagues: leagues.length,
    teams: teams.length,
    players: players.length,
    seasons: seasons.length,
    divisions: divisions.length,
  };

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Overview</h2>
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
