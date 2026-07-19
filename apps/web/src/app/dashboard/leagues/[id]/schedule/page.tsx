import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { schedulesStandingsV1 } from "@/lib/flags";
import { getLeague, getSeason, getSeasons } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { resolveViewedSeason } from "@/lib/season-view";
import { syncActiveLeagueForResource } from "@/lib/active-league-server";

export default async function LeagueScheduleRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const enabled = await schedulesStandingsV1();
  if (!enabled) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: leagueId } = await params;
  const { season: seasonParam } = await searchParams;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(leagueId, orgContext).catch(() => null);
  if (!league) notFound();

  if (seasonParam) {
    const season = await getSeason(seasonParam, orgContext).catch(() => null);
    if (!season || season.leagueId !== league.id) notFound();
    redirect(`/dashboard/seasons/${season.id}/schedule`);
  }

  await syncActiveLeagueForResource(league.id);
  const allSeasons = await getSeasons([league.id]);
  const activeSeason = resolveViewedSeason(allSeasons, undefined);
  if (!activeSeason) redirect("/dashboard/seasons");
  redirect(`/dashboard/seasons/${activeSeason.id}/schedule`);
}
