import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLeagueByInviteToken } from "@/lib/data-api";
import JoinForm from "./join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const league = await getLeagueByInviteToken(token);

  if (!league) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Invalid Invite Link</h1>
          <p className="mt-2 text-muted-foreground">
            This invitation link is invalid or has been revoked.
          </p>
        </div>
      </div>
    );
  }

  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/join/${token}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <JoinForm
        leagueName={league.name}
        orgId={league.orgId!}
        token={token}
      />
    </div>
  );
}
