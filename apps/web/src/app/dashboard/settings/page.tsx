import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { resolveActiveLeague } from "@/lib/active-league";
import { getUserRoleInOrg } from "@/lib/org-context";
import { Card, CardContent } from "@/components/ui/card";
import {
  accountSettingsHref,
  leagueSettingsHref,
} from "@/components/workspace/resource-navigation";

/**
 * Settings Home (issue #576, ASR-8): the shell Settings destination, branching
 * to League Settings (Org Admin of the Active League only — ASR-11) and
 * Account Settings (always, even with zero leagues — ASR-22). Non-admins
 * simply don't see the League Settings card; direct URL access 404s there.
 */
export default async function SettingsHomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { activeLeague } = await resolveActiveLeague(userId);
  const canManageLeague =
    activeLeague?.orgId ?
      (await getUserRoleInOrg(activeLeague.orgId, userId)) === "org:admin"
    : false;

  return (
    <div className="space-y-4" data-testid="settings-home">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-text-muted">
          League and account configuration.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y divide-border pt-2">
          {canManageLeague && activeLeague ? (
            <Link
              href={leagueSettingsHref()}
              className="flex items-center justify-between gap-3 py-4"
              data-testid="settings-league-link"
            >
              <span className="min-w-0">
                <span className="block text-label-14 text-foreground">
                  League Settings
                </span>
                <span className="block text-caption-12 text-text-muted">
                  Members, visibility, teams, and danger zone for{" "}
                  {activeLeague.name}.
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-text-muted"
                aria-hidden
              />
            </Link>
          ) : null}
          <Link
            href={accountSettingsHref()}
            className="flex items-center justify-between gap-3 py-4"
            data-testid="settings-account-link"
          >
            <span className="min-w-0">
              <span className="block text-label-14 text-foreground">
                Account Settings
              </span>
              <span className="block text-caption-12 text-text-muted">
                Import data and manage your subscription.
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-text-muted"
              aria-hidden
            />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
