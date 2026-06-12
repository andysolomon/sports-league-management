import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPlayer, getTeam } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { derivePositionGroup } from "@/lib/position-group";
import { playerAttributesV1 } from "@/lib/flags";
import { Card, CardContent } from "@/components/ui/8bit/card";
import { Button } from "@/components/ui/8bit/button";
import { StatusBadge } from "@/components/status-badge";
import { UserCircle } from "lucide-react";

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

  const team = await getTeam(player.teamId, orgContext).catch(() => null);
  const positionGroup = derivePositionGroup(player.position);
  const age = player.dateOfBirth ? ageFrom(player.dateOfBirth) : null;
  const developmentEnabled = await playerAttributesV1();

  return (
    <div className="mx-auto max-w-2xl">
      {team && (
        <Link
          href={`/dashboard/teams/${team.id}`}
          className="mb-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to {team.name}
        </Link>
      )}

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
          </dl>

          {developmentEnabled && (
            <div className="mt-6">
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/players/${player.id}/development`}>
                  View development chart
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
