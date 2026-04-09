import { createInterface } from "node:readline/promises";
import { getApiBaseUrl } from "../lib/config.js";
import { verifyApiKey } from "../lib/api.js";
import { writeCredentials } from "../lib/credentials.js";

export async function runLogin(): Promise<void> {
  const baseUrl = getApiBaseUrl();

  console.log("sprtsmng CLI login\n");
  console.log("1. Open this URL in your browser and sign in:\n");
  console.log(`   ${baseUrl}/cli-auth\n`);
  console.log('2. Click "Add new key", name it, copy the secret.');
  console.log("3. Paste the secret here:\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let apiKey: string;
  try {
    apiKey = (await rl.question("API key: ")).trim();
  } finally {
    rl.close();
  }

  if (!apiKey) {
    throw new Error("No API key provided");
  }

  console.log("Verifying...");
  const user = await verifyApiKey(baseUrl, apiKey);

  const path = await writeCredentials({
    apiKey,
    userId: user.userId,
    email: user.email,
    createdAt: new Date().toISOString(),
  });

  console.log(`Logged in as ${user.email ?? user.userId}`);
  console.log(`Credentials saved to ${path}`);
}
