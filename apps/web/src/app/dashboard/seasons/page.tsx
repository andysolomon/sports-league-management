import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSeasons } from "@/lib/data-api";
import { resolveOrgContext } from "@/lib/org-context";
import { SeasonsTable } from "./seasons-table";

export default async function SeasonsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const orgContext = await resolveOrgContext(userId);
  const seasons = await getSeasons(orgContext.visibleLeagueIds);

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-foreground">Seasons</h2>
      <SeasonsTable seasons={seasons} />
    </div>
  );
}
