import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@sports-management/shared-types",
    "@sports-management/api-contracts",
  ],
};

export default nextConfig;
