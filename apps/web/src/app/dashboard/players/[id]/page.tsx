import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ResourceHeader } from "@/components/workspace/ResourceHeader";
import {
  buildPlayerSiblingLinks,
  playerHomeHref,
  playerSubpageHref,
} from "@/components/workspace/resource-navigation";
import {
  getPlayer,
  getTeam,
  getPlayerSeasonAttributes,
  getPlayerMaddenRating,
  getSeasons,
  getPlayerSeasonTotals,
  computeSeasonSprt,
  getTeamLeagueId,
  getLeagueOrgId,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { derivePositionGroup } from "@/lib/position-group";
import { gradeToClassYear } from "@/lib/class-year";
import { orderedMaddenAttributes } from "@/lib/madden/attributes";
import { playerAttributesV1, statKeepingV1 } from "@/lib/flags";
import { SeasonStatsCard } from "@/components/stats/SeasonStatsCard";
import { HsRatingCard } from "@/components/stats/HsRatingCard";
import { SprtRatingCard } from "@/components/attributes/SprtRatingCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { UserCircle } from "lucide-react";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

/*
 * Player profile (WSM-000088). Core page, not flag-gated — only the
 * development-chart link is Phase 2 (player_attributes_v1). Access
 * follows the development page's pattern: resolveOrgContext, then
 * getPlayer's league-visibility check; anything outside the user's
 * org tree or subscriptions → 404.
 */

function ageFrom(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: playerId } = await params;

  const orgContext = await resolveOrgContext(userId);
  const player = await getPlayer(playerId, orgContext).catch(() => null);
  if (!player) notFound();
  const playerLeagueId = await getTeamLeagueId(player.teamId).catch(
    () => null,
  );
  if (!playerLeagueId) notFound();
  await syncActiveLeagueForResource(playerLeagueId);

  const team = await getTeam(player.teamId, orgContext).catch(() => null);
  const positionGroup = derivePositionGroup(player.position);
  const classYear = gradeToClassYear(player.grade);
  const age = player.dateOfBirth ? ageFrom(player.dateOfBirth) : null;
  const attributesEnabled = await playerAttributesV1();

  // SPRT rating breakdown (WSM-000093) — the player's current-season snapshot
  // when Phase 2 is on. The season is resolved server-side, including workspace
  // forks that read their source player/season (WSM-000122). Never blocks the
  // page.
  let rating: {
    weightedOverall: number | null;
    attributes: Record<string, number>;
  } | null = null;
  if (attributesEnabled && team) {
    rating = await getPlayerSeasonAttributes(playerId, orgContext).catch(
      () => null,
    );
  }
  // Coaches + admins may edit SPRT attributes on the profile card (WSM-000121).
  const playerOrgId = playerLeagueId
    ? await getLeagueOrgId(playerLeagueId)
    : null;
  const role = playerOrgId ? await resolveOrgRole(playerOrgId, userId) : null;
  const canEditRating = canManageRoster(role);

  // Madden rating (WSM-000095) — the player's current Madden snapshot, shown
  // side-by-side with SPRT. Independent of season; never blocks the page.
  const madden = attributesEnabled
    ? await getPlayerMaddenRating(playerId, orgContext).catch(() => null)
    : null;
  const maddenAttributes = madden
    ? orderedMaddenAttributes(madden.attributes)
    : [];

  // Season box-score totals (WSM-000112) — aggregated from entered game stats
  // for the team's active season. Flag-gated; never blocks the page.
  let seasonStats: {
    stats: Awaited<ReturnType<typeof getPlayerSeasonTotals>>["stats"];
    gameCount: number;
    seasonName: string;
  } | null = null;
  let gameRating: {
    overall: number;
    attributes: Record<string, number>;
  } | null = null;
  if ((await statKeepingV1()) && team) {
    const seasons = await getSeasons([team.leagueId]).catch(() => []);
    const activeSeason =
      seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
    if (activeSeason) {
      const [totals, sprt] = await Promise.all([
        getPlayerSeasonTotals(playerId, activeSeason.id).catch(() => null),
        computeSeasonSprt(activeSeason.id).catch(() => []),
      ]);
      if (totals && totals.gameCount > 0) {
        seasonStats = { ...totals, seasonName: activeSeason.name };
      }
      const mine = sprt.find((r) => r.playerId === playerId);
      if (mine) {
        gameRating = { overall: mine.overall, attributes: mine.attributes };
      }
    }
  }

  const developmentHref = playerSubpageHref(player.id, "development");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ResourceHeader
        kind="player"
        name={player.name}
        href={playerHomeHref(player.id)}
        subtitle="Player overview"
        siblings={buildPlayerSiblingLinks({
          playerId: player.id,
          developmentEnabled: attributesEnabled,
        })}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {player.headshotUrl ? (
              <Image
                src={player.headshotUrl}
                alt={player.name}
                width={96}
                height={96}
                className="h-24 w-24 shrink-0 rounded-md bg-muted object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
                <UserCircle className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-foreground">
                {player.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {player.position}
                {positionGroup && positionGroup !== player.position
                  ? ` · ${positionGroup}`
                  : ""}
                {classYear ? ` · ${classYear}` : ""}
                {age != null ? ` · Age ${age}` : ""}
                {player.jerseyNumber != null ? ` · #${player.jerseyNumber}` : ""}
                {team ? ` · ${team.name}` : ""}
              </p>
              <div className="mt-2">
                <StatusBadge status={player.status} />
              </div>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium text-muted-foreground">Position</dt>
              <dd className="mt-1 text-foreground">{player.position}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Jersey</dt>
              <dd className="mt-1 text-foreground">
                {player.jerseyNumber != null ? `#${player.jerseyNumber}` : "—"}
              </dd>
            </div>
            {age != null && (
              <div>
                <dt className="font-medium text-muted-foreground">Age</dt>
                <dd className="mt-1 text-foreground">{age}</dd>
              </div>
            )}
            {player.experienceYears != null && (
              <div>
                <dt className="font-medium text-muted-foreground">
                  Years active
                </dt>
                <dd className="mt-1 text-foreground">
                  {player.experienceYears === 0
                    ? "Rookie"
                    : `${player.experienceYears} ${player.experienceYears === 1 ? "yr" : "yrs"}`}
                </dd>
              </div>
            )}
            {player.hometown && (
              <div>
                <dt className="font-medium text-muted-foreground">Hometown</dt>
                <dd className="mt-1 text-foreground">{player.hometown}</dd>
              </div>
            )}
          </dl>

          {attributesEnabled && (
            <div className="mt-6">
              <Button asChild variant="outline" size="sm">
                <Link href={developmentHref}>
                  View development chart
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {seasonStats && (
        <SeasonStatsCard
          stats={seasonStats.stats}
          gameCount={seasonStats.gameCount}
          seasonName={seasonStats.seasonName}
        />
      )}

      {gameRating && (
        <HsRatingCard
          overall={gameRating.overall}
          attributes={gameRating.attributes}
        />
      )}

      {rating && (
        <SprtRatingCard
          playerId={playerId}
          weightedOverall={rating.weightedOverall}
          attributes={rating.attributes}
          canEdit={canEditRating}
        />
      )}

      {madden && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Madden 26
              </h3>
              <span className="font-mono text-2xl font-bold text-primary">
                {madden.overall}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  OVR
                </span>
              </span>
            </div>

            {maddenAttributes.length > 0 && (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {maddenAttributes.map((a) => (
                  <div
                    key={a.key}
                    className="flex items-center justify-between gap-2"
                  >
                    <dt className="truncate text-xs text-muted-foreground">
                      {a.label}
                    </dt>
                    <dd
                      className={`shrink-0 font-mono text-sm font-semibold ${
                        a.value >= 90 ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {a.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              Madden NFL 26 player ratings (EA Sports).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
