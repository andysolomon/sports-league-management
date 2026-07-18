import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { resolveActiveLeague } from "@/lib/active-league";
import { dashboardEntryPath } from "@/components/workspace/resource-navigation";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { activeLeagueId } = await resolveActiveLeague(userId);
  redirect(dashboardEntryPath(activeLeagueId));
}
