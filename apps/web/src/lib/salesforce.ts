import Connection from "jsforce/lib/connection";
import OAuth2 from "jsforce/lib/oauth2";

let cachedConnection: Connection | null = null;
let tokenExpiresAt = 0;

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

function isTokenValid(): boolean {
  return cachedConnection !== null && Date.now() < tokenExpiresAt - REFRESH_BUFFER_MS;
}

export async function getSalesforceConnection(): Promise<Connection> {
  if (isTokenValid() && cachedConnection) {
    return cachedConnection;
  }

  const loginUrl = process.env.SF_LOGIN_URL ?? "https://login.salesforce.com";
  const clientId = process.env.SF_CLIENT_ID;
  const username = process.env.SF_USERNAME;
  const privateKey = process.env.SF_PRIVATE_KEY;

  if (!clientId || !username || !privateKey) {
    throw new Error(
      "Missing Salesforce JWT config. Set SF_CLIENT_ID, SF_USERNAME, and SF_PRIVATE_KEY env vars."
    );
  }

  const oauth2 = new OAuth2({ clientId, loginUrl });
  const conn = new Connection({ loginUrl, oauth2 });

  await (conn as any).authorize({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: buildJwtAssertion({ clientId, username, privateKey, loginUrl }),
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
  // JWT assertion is constructed and signed at request time.
  // In production, use a proper JWT library (e.g., jose) to sign the assertion.
  // For now, this returns a placeholder — the Connected App must be configured
  // for JWT bearer flow with the corresponding certificate.
  const { clientId, username, loginUrl } = params;
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

  // TODO: Sign with privateKey using crypto.sign() or jose library
  // This placeholder will not work without proper JWT signing
  return `${header}.${payload}.SIGNATURE_PLACEHOLDER`;
}
