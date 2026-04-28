import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTeams } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";

export default async function TeamsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const teams = await getTeams(orgContext.visibleLeagueIds);

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Teams</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/dashboard/teams/${team.id}`}
            className="rounded-lg border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-foreground">{team.name}</h3>
            <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
              {team.city && (
                <div>
                  <dt className="inline font-medium">City: </dt>
                  <dd className="inline">{team.city}</dd>
                </div>
              )}
              {team.stadium && (
                <div>
                  <dt className="inline font-medium">Stadium: </dt>
                  <dd className="inline">{team.stadium}</dd>
                </div>
              )}
              {team.foundedYear && (
                <div>
                  <dt className="inline font-medium">Founded: </dt>
                  <dd className="inline">{team.foundedYear}</dd>
                </div>
              )}
            </dl>
          </Link>
        ))}
        {teams.length === 0 && (
          <p className="text-muted-foreground">No teams found.</p>
        )}
      </div>
    </div>
  );
}
