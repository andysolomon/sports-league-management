import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLeague } from "@/lib/salesforce-api";
import { resolveOrgContext, requireOrgAdmin } from "@/lib/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/8bit/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import InviteForm from "./invite-form";
import InvitationList from "./invitation-list";
import InviteLinkSection from "./invite-link-section";

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const orgContext = await resolveOrgContext(userId);
  const league = await getLeague(id, orgContext);

  // Check if user is admin of this league's org
  let isAdmin = false;
  if (league.orgId) {
    try {
      await requireOrgAdmin(league.orgId, userId);
      isAdmin = true;
    } catch {
      // Not admin — read-only view
    }
  }

  return (
    <div>
      <Link
        href="/dashboard/leagues"
        className="mb-4 inline-block text-sm text-primary hover:underline"
      >
        &larr; Back to Leagues
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>{league.name}</CardTitle>
            {league.orgId ? (
              <Badge variant="secondary">Organization</Badge>
            ) : (
              <Badge variant="outline">Public</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isAdmin && league.orgId && (
            <div className="space-y-6">
              <InviteForm orgId={league.orgId} />
              <InvitationList orgId={league.orgId} />
              <InviteLinkSection orgId={league.orgId} />
              <div className="flex gap-4">
                <Link
                  href={`/dashboard/leagues/${id}/members`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Manage Members &rarr;
                </Link>
                <Link
                  href={`/dashboard/leagues/${id}/requests`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Join Requests &rarr;
                </Link>
              </div>
            </div>
          )}
          {!isAdmin && (
            <p className="text-sm text-gray-500">
              You have read-only access to this league.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
