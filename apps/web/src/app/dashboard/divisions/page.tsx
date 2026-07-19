import { auth } from "@clerk/nextjs/server";
import { permanentRedirect, redirect } from "next/navigation";
import { resolveActiveLeague } from "@/lib/active-league";
import { divisionsViewHref } from "../teams/teams-home-navigation";

/** Legacy Divisions Home. Content now lives in the Teams Home alternate view. */
export default async function DivisionsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // resolveActiveLeague validates the current scope before emitting the target.
  await resolveActiveLeague(userId);
  permanentRedirect(divisionsViewHref());
}
