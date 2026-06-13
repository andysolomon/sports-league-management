import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getTeam,
  getPlayersByTeam,
  getSeasons,
  getTeamAttributeSnapshots,
  getTeamMaddenOveralls,
  getLeagueClaimable,
  getTeamOwnerOrgId,
} from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { canManageTeam } from "@/lib/authorization";
import { playerAttributesV1 } from "@/lib/flags";
import type { PlayerSnapshot } from "@/lib/attributes/headline-columns";
import TeamManagement from "./team-management";
import { ClaimTeamButton } from "./claim-team-button";

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { userId, orgId, orgRole } = await auth();
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

  // Claim affordance (WSM-000110): a followed team in a claimable template
  // league can be claimed → owned + editable. Only relevant when the user
  // can't already manage it. Failures degrade to "no claim offered".
  let claim: { eligible: boolean } | null = null;
  if (!canManage) {
    const [claimable, ownerOrgId] = await Promise.all([
      getLeagueClaimable(team.leagueId).catch(() => false),
      getTeamOwnerOrgId(id).catch(() => null),
    ]);
    if (claimable && !ownerOrgId) {
      claim = { eligible: Boolean(orgId) && orgRole === "org:admin" };
    }
  }

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

      {claim && (
        <div className="mb-4 rounded-md border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">Coach here?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Claim {team.name} to manage its roster and depth chart — it becomes
            yours to edit.
          </p>
          <div className="mt-3">
            {claim.eligible ? (
              <ClaimTeamButton teamId={team.id} teamName={team.name} />
            ) : (
              <p className="text-xs text-muted-foreground">
                You need to be an admin of an organization to claim a team —
                create or select one from your account menu first.
              </p>
            )}
          </div>
        </div>
      )}

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
