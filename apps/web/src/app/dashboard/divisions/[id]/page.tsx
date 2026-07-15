import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getDivision, getTeams, getLeague } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function DivisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const division = await getDivision(id, orgContext).catch(() => null);
  if (!division) notFound();
  await syncActiveLeagueForResource(division.leagueId);

  const [league, allTeams] = await Promise.all([
    getLeague(division.leagueId, orgContext).catch(() => null),
    getTeams([division.leagueId]),
  ]);
  const teams = allTeams.filter((t) => t.divisionId === id);

  return (
    <div>
      <Link
        href="/dashboard/divisions"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Divisions
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">{division.name}</h2>
        {league && (
          <p className="mt-1 text-sm text-muted-foreground">{league.name}</p>
        )}
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams in this division"
          description="Teams assigned to this division will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/dashboard/teams/${team.id}?from=divisions`}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-card"
            >
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate font-medium text-foreground">
                {team.name}
              </span>
              {team.city && (
                <span className="shrink-0 text-muted-foreground">
                  &mdash; {team.city}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
