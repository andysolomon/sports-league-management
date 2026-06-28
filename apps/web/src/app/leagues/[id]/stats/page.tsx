import { notFound } from "next/navigation";
import Link from "next/link";
import { statKeepingV1 } from "@/lib/flags";
import { getSeasonStatLeadersPublic } from "@/lib/data-api";
import { publicLeagueGuard } from "@/lib/public-league-guard";
import { StatLeadersBoard } from "@/components/stats/StatLeadersBoard";

/*
 * Public viewer route (WSM-000186) — fan-facing season stat leaders. NO Clerk
 * session. `publicLeagueGuard` 404s a non-public league; the Convex query
 * (`getSeasonStatLeadersPublic`) re-checks `isPublic` so a stale/skipped
 * middleware can't leak a private league's data.
 */
export default async function PublicLeagueStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await statKeepingV1();
  if (!enabled) notFound();

  const { id: leagueId } = await params;
  await publicLeagueGuard(leagueId);

  const data = await getSeasonStatLeadersPublic(leagueId);
  if (data === null) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/leagues/${leagueId}`}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to League
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Stat leaders</h1>
        <p className="text-sm text-muted-foreground">{data.seasonName}</p>
      </header>

      <StatLeadersBoard categories={data.categories} />
    </div>
  );
}
