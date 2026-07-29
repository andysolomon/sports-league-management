import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildSeasonSiblingLinks,
  coachHomeHref,
  playerHomeHref,
  seasonHomeHref,
} from "@/components/workspace/resource-navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getLeague, getSeason, listSeasonAwards } from "@/lib/data-api";
import {
  dynastyHistoryV1,
  dynastyOffseasonV2,
  pageGuard,
  playoffsV1,
  schedulesStandingsV1,
  statKeepingV1,
} from "@/lib/flags";
import { resolveOrgContext } from "@/lib/org-context";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

const INDIVIDUAL_TYPES = new Set([
  "player_of_year",
  "offensive_player_of_year",
  "defensive_player_of_year",
  "newcomer_of_year",
  "coach_of_year",
]);

export default async function SeasonAwardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pageGuard(dynastyHistoryV1);
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: seasonId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const season = await getSeason(seasonId, orgContext).catch(() => null);
  if (!season) notFound();
  const league = await getLeague(season.leagueId, orgContext).catch(() => null);
  if (!league) notFound();
  await syncActiveLeagueForResource(league.id);

  const [
    awards,
    scheduleEnabled,
    playoffsEnabled,
    statsEnabled,
    offseasonEnabled,
  ] = await Promise.all([
    listSeasonAwards(season.id).catch(() => []),
    schedulesStandingsV1(),
    playoffsV1(),
    statKeepingV1(),
    dynastyOffseasonV2(),
  ]);
  const individuals = awards.filter((row) => INDIVIDUAL_TYPES.has(row.type));
  const allConference = awards.filter((row) => row.type === "all_conference");
  const allState = awards.filter((row) => row.type === "all_state");

  const recipient = (row: (typeof awards)[number]) => {
    const href = row.playerId
      ? playerHomeHref(row.playerId)
      : row.coachId
        ? coachHomeHref(row.coachId)
        : null;
    return href ? (
      <Link href={href} className="font-medium hover:underline">
        {row.recipientName}
      </Link>
    ) : (
      <span className="font-medium">{row.recipientName}</span>
    );
  };

  return (
    <div className="space-y-4" data-testid="season-awards">
      <ResourceHeader
        kind="season"
        title="Season awards"
        homeHref={seasonHomeHref(season.id)}
        context={`${season.name} · ${league.name}`}
        siblings={buildSeasonSiblingLinks({
          seasonId: season.id,
          scheduleEnabled,
          playoffsEnabled,
          statsEnabled,
          offseasonEnabled: offseasonEnabled && season.status === "upcoming",
          awardsEnabled: true,
        })}
      />

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold">Award winners</h2>
          {individuals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Awards are announced when this season is completed.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {individuals.map((row) => (
                <li key={row.id} className="rounded-md border p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {row.typeLabel}
                  </p>
                  <p className="mt-1">
                    {recipient(row)} · {row.teamName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {[
        { title: "All-Conference team", rows: allConference },
        { title: "All-State team", rows: allState },
      ].map((section) => (
        <Card key={section.title}>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No selections yet.
              </p>
            ) : (
              <ul className="mt-4 divide-y">
                {section.rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <span>
                      <span className="mr-2 text-xs font-medium text-muted-foreground">
                        {row.positionGroup ?? "ATH"}
                      </span>
                      {recipient(row)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {row.teamName}
                      {row.divisionName ? ` · ${row.divisionName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
