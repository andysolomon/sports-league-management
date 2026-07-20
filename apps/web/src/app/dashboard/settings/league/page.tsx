import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { resolveActiveLeague } from "@/lib/active-league";
import { requireOrgAdmin } from "@/lib/org-context";
import { LeagueSettingsView } from "./league-settings-view";

/**
 * League Settings for the Active League (issue #576, ASR-8). Org Admin only:
 * anyone else — including operators with no Active League or a league without
 * an owning org — gets a non-disclosing 404 (ASR-11).
 */
export default async function LeagueSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { activeLeague, orgContext } = await resolveActiveLeague(userId);
  const orgId = activeLeague?.orgId ?? null;
  if (!activeLeague || !orgId) notFound();

  try {
    await requireOrgAdmin(orgId, userId);
  } catch {
    notFound();
  }

  return (
    <LeagueSettingsView
      league={{ id: activeLeague.id, name: activeLeague.name, orgId }}
      orgContext={orgContext}
    />
  );
}
