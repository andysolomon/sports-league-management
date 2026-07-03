import type { NextConfig } from "next";
import { runClerkEnvGuard } from "./src/lib/clerk-env-guard";

// Fail the PRODUCTION build if Clerk is configured with development keys
// (WSM-000168). Build-time (not boot-time) so a misconfig blocks promotion and
// Vercel keeps the last good deployment serving instead of booting a broken one.
runClerkEnvGuard();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@sports-management/shared-types",
    "@sports-management/api-contracts",
    "@sports-management/design-system",
  ],
  images: {
    remotePatterns: [
      // ESPN player headshots ingested by the NFL sync (WSM-000088)
      { protocol: "https", hostname: "*.espncdn.com" },
    ],
  },
};

export default nextConfig;
