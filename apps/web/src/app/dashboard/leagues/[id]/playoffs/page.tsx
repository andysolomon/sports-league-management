import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { playoffsV1 } from "@/lib/flags";
import {
  getLeague,
  getLeagueOrgId,
  getSeasons,
  getPlayoffBracket,
} from "@/lib/data-api";
import { resolveOrgContext, resolveOrgRole } from "@/lib/org-context";
import { canManageRoster } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PlayoffBracket from "@/components/playoffs/PlayoffBracket";
import GeneratePlayoffsButton from "@/components/playoffs/GeneratePlayoffsButton";

export default async function LeaguePlayoffsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await playoffsV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: leagueId } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();

  // Manager gate (admins + coaches), consistent with the schedule page.
  const orgId = await getLeagueOrgId(leagueId);
  const role = orgId ? await resolveOrgRole(orgId, userId) : null;
  const isAdmin = canManageRoster(role);

  const allSeasons = await getSeasons([leagueId]);
  const activeSeason =
    allSeasons.find((s) => s.status === "active") ?? allSeasons[0] ?? null;

  const bracket = activeSeason
    ? await getPlayoffBracket(activeSeason.id)
    : null;

  return (
    <div>
      <Link
        href={`/dashboard/leagues/${leagueId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to League
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{league.name}</h2>
          <p className="text-sm text-muted-foreground">
            Playoffs {activeSeason ? `· ${activeSeason.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/leagues/${leagueId}/schedule`}
            className="text-sm text-primary hover:underline"
          >
            &larr; Schedule
          </Link>
          {isAdmin && activeSeason ? (
            <GeneratePlayoffsButton
              leagueId={leagueId}
              seasonId={activeSeason.id}
              seasonName={activeSeason.name}
              hasBracket={bracket !== null}
            />
          ) : null}
        </div>
      </header>

      {!activeSeason ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Playoffs need a season. Create one and play some games so standings
              can seed the bracket.
            </p>
            <Button asChild size="sm">
              <Link href="/dashboard/seasons">Go to Seasons</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !bracket ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No bracket yet for {activeSeason.name}.
            {isAdmin
              ? " Pick a size and generate one — seeds come from the current standings."
              : ""}
          </CardContent>
        </Card>
      ) : (
        <PlayoffBracket bracket={bracket} />
      )}
    </div>
  );
}
