import { auth, currentUser } from "@clerk/nextjs/server";

export interface AuthorizationResult {
  userId: string;
  authorizedTeamIds: string[];
  isAuthorized: boolean;
}

export async function authorizeTeamMutation(
  teamId: string,
): Promise<AuthorizationResult> {
  const { userId } = await auth();
  if (!userId) {
    return { userId: "", authorizedTeamIds: [], isAuthorized: false };
  }

  const user = await currentUser();
  const managedTeamIds =
    (user?.publicMetadata?.managedTeamIds as string[]) ?? [];

  return {
    userId,
    authorizedTeamIds: managedTeamIds,
    isAuthorized: managedTeamIds.includes(teamId),
  };
}

export async function canManageTeam(teamId: string): Promise<boolean> {
  const result = await authorizeTeamMutation(teamId);
  return result.isAuthorized;
}
