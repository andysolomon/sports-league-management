import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const webDir = path.join(repoRoot, "apps", "web");
const localEnvPath = path.join(webDir, ".env.local");
const tempEnvPath = path.join(
  os.tmpdir(),
  `sprtsmng-vercel-prod-${Date.now()}.env`,
);

const KEYS_TO_COMPARE = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "SF_LOGIN_URL",
  "SF_CLIENT_ID",
  "SF_USERNAME",
  "SF_PRIVATE_KEY",
];

// Displayed for visibility but never counted as drift — flag overrides are
// expected to differ between local dev and production (WSM-000079/80).
const INFORMATIONAL_KEYS = [
  "FLAG_DEPTH_CHART_V1",
  "FLAG_ROSTER_SNAPSHOTS_V1",
  "FLAG_PLAYER_ATTRIBUTES_V1",
  "FLAG_SCHEDULES_STANDINGS_V1",
];

function parseEnvFile(filePath) {
  const env = {};
  const raw = readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const firstEquals = line.indexOf("=");
    if (firstEquals === -1) continue;

    const key = line.slice(0, firstEquals).trim();
    let value = line.slice(firstEquals + 1);

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function normalizeValue(value) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n$/, "")
    .trim();
}

function clerkKeyType(value) {
  if (!value) return "missing";
  if (value.startsWith("pk_test_") || value.startsWith("sk_test_")) return "test";
  if (value.startsWith("pk_live_") || value.startsWith("sk_live_")) return "live";
  return "unknown";
}

function decodeClerkFrontendApi(publishableKey) {
  if (!publishableKey) return "missing";

  const encoded = publishableKey.replace(/^pk_(test|live)_/, "");
  if (!encoded) return "unknown";

  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    return Buffer.from(padded, "base64")
      .toString("utf8")
      .replace(/\$/g, "");
  } catch {
    return "unknown";
  }
}

function formatStatusRow(key, localValue, productionValue) {
  const localNormalized = normalizeValue(localValue);
  const productionNormalized = normalizeValue(productionValue);

  if (!localNormalized && !productionNormalized) {
    return `${key}: missing in both local and production`;
  }

  if (!localNormalized) {
    return `${key}: missing locally`;
  }

  if (!productionNormalized) {
    return `${key}: missing in Vercel Production`;
  }

  if (localNormalized === productionNormalized) {
    return `${key}: aligned`;
  }

  return `${key}: drift detected`;
}

function printIdentityMarkers(localEnv, productionEnv) {
  const localPublishableKey = normalizeValue(
    localEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const productionPublishableKey = normalizeValue(
    productionEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  console.log("\nIdentity markers:");
  console.log(
    `- local Clerk: ${clerkKeyType(localPublishableKey)} (${decodeClerkFrontendApi(localPublishableKey)})`,
  );
  console.log(
    `- prod Clerk: ${clerkKeyType(productionPublishableKey)} (${decodeClerkFrontendApi(productionPublishableKey)})`,
  );
  console.log(
    `- local Salesforce username: ${normalizeValue(localEnv.SF_USERNAME) || "missing"}`,
  );
  console.log(
    `- prod Salesforce username: ${normalizeValue(productionEnv.SF_USERNAME) || "missing"}`,
  );
  console.log(
    `- local Salesforce login URL: ${normalizeValue(localEnv.SF_LOGIN_URL) || "missing"}`,
  );
  console.log(
    `- prod Salesforce login URL: ${normalizeValue(productionEnv.SF_LOGIN_URL) || "missing"}`,
  );
}

function main() {
  if (!existsSync(localEnvPath)) {
    console.error(`Missing ${localEnvPath}. Copy .env.local.example first.`);
    process.exit(1);
  }

  try {
    execFileSync(
      "vercel",
      ["env", "pull", tempEnvPath, "--environment", "production", "--yes"],
      {
        cwd: webDir,
        stdio: "pipe",
        encoding: "utf8",
      },
    );

    const localEnv = parseEnvFile(localEnvPath);
    const productionEnv = parseEnvFile(tempEnvPath);

    const rows = KEYS_TO_COMPARE.map((key) =>
      formatStatusRow(key, localEnv[key], productionEnv[key]),
    );

    console.log("Comparing local apps/web/.env.local to Vercel Production:");
    for (const row of rows) {
      console.log(`- ${row}`);
    }

    printIdentityMarkers(localEnv, productionEnv);

    console.log("\nFlag overrides (informational, not checked for drift):");
    for (const key of INFORMATIONAL_KEYS) {
      const local = normalizeValue(localEnv[key]) || "unset";
      const production = normalizeValue(productionEnv[key]) || "unset";
      console.log(`- ${key}: local=${local} prod=${production}`);
    }

    const hasDrift = KEYS_TO_COMPARE.some((key) => {
      const localValue = normalizeValue(localEnv[key]);
      const productionValue = normalizeValue(productionEnv[key]);
      return localValue !== productionValue;
    });

    if (hasDrift) {
      console.error("\nEnv parity check failed.");
      process.exit(1);
    }

    console.log("\nEnv parity check passed.");
  } finally {
    if (existsSync(tempEnvPath)) {
      unlinkSync(tempEnvPath);
    }
  }
}

main();
