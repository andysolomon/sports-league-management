import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Compass, Trophy } from "lucide-react";
import { getSeasons } from "@/lib/data-api";
import { resolveActiveLeague } from "@/lib/active-league";
import { findActiveSeason } from "@/lib/season-view";
import { getUserRoleInOrg } from "@/lib/org-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  activeSeasonShortcutHref,
  leagueActivationHref,
} from "@/components/workspace/resource-navigation";
import { PageHeader } from "../_components/page-header";
import {
  CreateLeagueButton,
  DeleteLeagueButton,
  RenameLeagueForm,
} from "./leagues-actions";

async function resolveAdminOrgIds(
  orgIds: string[],
  userId: string,
): Promise<Set<string>> {
  const uniqueOrgIds = Array.from(new Set(orgIds));
  const roles = await Promise.all(
    uniqueOrgIds.map(async (orgId) => ({
      orgId,
      role: await getUserRoleInOrg(orgId, userId),
    })),
  );
  return new Set(
    roles
      .filter((entry) => entry.role === "org:admin")
      .map((entry) => entry.orgId),
  );
}

export default async function LeaguesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { leagues, activeLeagueId } = await resolveActiveLeague(userId);

  if (leagues.length === 0) {
    return (
      <div>
        <PageHeader title="League Directory" action={<CreateLeagueButton />} />
        <EmptyState
          icon={Trophy}
          title="No leagues yet"
          description="Create a league, or add teams from Discover, to get started."
        />
        <Card className="mt-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Find public leagues
              </p>
              <p className="text-sm text-muted-foreground">
                Browse reference leagues and add teams to your workspace.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/discover">
                <Compass className="mr-1.5 h-4 w-4" aria-hidden />
                Discover
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const leagueIds = leagues.map((league) => league.id);
  const [seasons, adminOrgIds] = await Promise.all([
    getSeasons(leagueIds),
    resolveAdminOrgIds(
      leagues
        .map((league) => league.orgId)
        .filter((orgId): orgId is string => Boolean(orgId)),
      userId,
    ),
  ]);

  // Same deterministic Active Season selection as League Home (findActiveSeason)
  // so the Directory shortcut and League Home never disagree about which
  // season is active.
  const seasonsByLeagueId = new Map<string, typeof seasons>();
  for (const season of seasons) {
    const arr = seasonsByLeagueId.get(season.leagueId) ?? [];
    arr.push(season);
    seasonsByLeagueId.set(season.leagueId, arr);
  }
  const activeSeasonByLeagueId = new Map<string, { id: string; name: string }>();
  for (const [leagueId, leagueSeasons] of seasonsByLeagueId) {
    const active = findActiveSeason(leagueSeasons);
    if (active) {
      activeSeasonByLeagueId.set(leagueId, { id: active.id, name: active.name });
    }
  }

  return (
    <div>
      <PageHeader title="League Directory" action={<CreateLeagueButton />} />

      <ul className="space-y-3">
        {leagues.map((league) => {
          const activeSeason = activeSeasonByLeagueId.get(league.id) ?? null;
          const isAdmin = league.orgId ? adminOrgIds.has(league.orgId) : false;
          const isActiveLeague = league.id === activeLeagueId;

          return (
            <li key={league.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Trophy
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="truncate font-medium text-foreground">
                        {league.name}
                      </span>
                      {league.orgId ? (
                        <Badge variant="secondary" className="shrink-0">
                          Organization
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Public
                        </Badge>
                      )}
                      {isActiveLeague ? (
                        <Badge variant="default" className="shrink-0">
                          Active League
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin ? (
                      <>
                        <RenameLeagueForm
                          leagueId={league.id}
                          currentName={league.name}
                        />
                        <DeleteLeagueButton
                          leagueId={league.id}
                          leagueName={league.name}
                        />
                      </>
                    ) : null}
                    {activeSeason ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={activeSeasonShortcutHref(
                            league.id,
                            activeSeason.id,
                          )}
                        >
                          Active Season
                        </Link>
                      </Button>
                    ) : null}
                    <Button variant="default" size="sm" asChild>
                      <Link href={leagueActivationHref(league.id)}>Open</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Find public leagues
            </p>
            <p className="text-sm text-muted-foreground">
              Browse reference leagues and add teams to your workspace.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/discover">
              <Compass className="mr-1.5 h-4 w-4" aria-hidden />
              Discover
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
