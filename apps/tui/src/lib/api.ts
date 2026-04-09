export interface WhoamiResponse {
  userId: string;
  email: string | null;
  tier: "free" | "plus" | "club" | "league";
  authMethod: "session_token" | "api_key";
}

export async function verifyApiKey(
  baseUrl: string,
  apiKey: string,
): Promise<WhoamiResponse> {
  const res = await fetch(`${baseUrl}/api/cli/whoami`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Verification failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as WhoamiResponse;
}
