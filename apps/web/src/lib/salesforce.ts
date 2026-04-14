import { createSign } from "crypto";
import Connection from "jsforce/lib/connection";
import OAuth2 from "jsforce/lib/oauth2";

let cachedConnection: Connection | null = null;
let tokenExpiresAt = 0;
let pendingConnection: Promise<Connection> | null = null;

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

function isTokenValid(): boolean {
  return cachedConnection !== null && Date.now() < tokenExpiresAt - REFRESH_BUFFER_MS;
}

export async function getSalesforceConnection(): Promise<Connection> {
  if (isTokenValid() && cachedConnection) {
    return cachedConnection;
  }

  if (pendingConnection) {
    return pendingConnection;
  }

  pendingConnection = authorize();
  try {
    const conn = await pendingConnection;
    return conn;
  } finally {
    pendingConnection = null;
  }
}

async function authorize(): Promise<Connection> {
  const loginUrl = process.env.SF_LOGIN_URL ?? "https://login.salesforce.com";
  const clientId = process.env.SF_CLIENT_ID;
  const username = process.env.SF_USERNAME;
  const privateKey = process.env.SF_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientId || !username || !privateKey) {
    console.error("[SF Auth] Missing env vars:", {
      hasClientId: !!clientId,
      hasUsername: !!username,
      hasPrivateKey: !!privateKey,
      clientIdLen: clientId?.length,
      usernameLen: username?.length,
      privateKeyLen: privateKey?.length,
    });
    throw new Error(
      "Missing Salesforce JWT config. Set SF_CLIENT_ID, SF_USERNAME, and SF_PRIVATE_KEY env vars."
    );
  }

  const assertion = buildJwtAssertion({ clientId, username, privateKey, loginUrl });

  const tokenUrl = `${loginUrl}/services/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const error = await resp.text();
    console.error("[SF Auth] JWT auth failed:", resp.status, error);
    throw new Error(`Salesforce JWT auth failed: ${error}`);
  }

  const token = (await resp.json()) as {
    access_token: string;
    instance_url: string;
  };

  const conn = new Connection({
    instanceUrl: token.instance_url,
    accessToken: token.access_token,
  });

  cachedConnection = conn;
  tokenExpiresAt = Date.now() + TOKEN_LIFETIME_MS;

  return conn;
}

function buildJwtAssertion(params: {
  clientId: string;
  username: string;
  privateKey: string;
  loginUrl: string;
}): string {
  const { clientId, username, privateKey, loginUrl } = params;

  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientId,
      sub: username,
      aud: loginUrl,
      exp: now + 300,
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}
