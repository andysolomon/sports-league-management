import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getTeam,
  getPlayersByTeam,
  getSeasons,
  getTeamAttributeSnapshots,
  getTeamMaddenOveralls,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { canManageTeam } from "@/lib/authorization";
import { playerAttributesV1 } from "@/lib/flags";
import type { PlayerSnapshot } from "@/lib/attributes/headline-columns";
import TeamManagement from "./team-management";

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  // Back link reflects where the user came from (WSM-000102): a team reached
  // from the Leagues page should go back to Leagues, not Teams. Linking pages
  // pass `?from`; default is the Teams list.
  const { from } = await searchParams;
  const back =
    from === "leagues"
      ? { href: "/dashboard/leagues", label: "Back to Leagues" }
      : { href: "/dashboard/teams", label: "Back to Teams" };
  const orgContext = await resolveOrgContext(userId);

  const [team, players, canManage] = await Promise.all([
    getTeam(id, orgContext),
    getPlayersByTeam(id, orgContext),
    canManageTeam(id, userId),
  ]);

  // WSM-000090: attribute snapshots feed the Madden stat columns.
  // Phase 2-gated; resolved against the league's active season, same
  // rule as the depth-chart page. Failure here must never take down
  // the roster — columns simply don't render.
  let snapshots: ReadonlyMap<string, PlayerSnapshot> = new Map();
  let maddenOveralls: ReadonlyMap<string, number> = new Map();
  if (await playerAttributesV1()) {
    const seasons = await getSeasons([team.leagueId]).catch(() => []);
    const activeSeason =
      seasons.find((s) => s.status === "active") ?? seasons[0] ?? null;
    if (activeSeason) {
      snapshots = await getTeamAttributeSnapshots(
        id,
        activeSeason.id,
        orgContext,
      ).catch(() => new Map());
    }
    // WSM-000095: Madden overall per player, shown beside SPRT. Season-agnostic.
    maddenOveralls = await getTeamMaddenOveralls(id, orgContext).catch(
      () => new Map(),
    );
  }

  return (
    <div>
      <Link
        href={back.href}
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; {back.label}
      </Link>

      <TeamManagement
        team={team}
        players={players}
        canManage={canManage}
        attributeSnapshots={Object.fromEntries(snapshots)}
        maddenOveralls={Object.fromEntries(maddenOveralls)}
      />
    </div>
  );
}
