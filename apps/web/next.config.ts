import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@sports-management/shared-types",
    "@sports-management/api-contracts",
  ],
  images: {
    remotePatterns: [
      // ESPN player headshots ingested by the NFL sync (WSM-000088)
      { protocol: "https", hostname: "*.espncdn.com" },
    ],
  },
};

export default nextConfig;
