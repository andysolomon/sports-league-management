import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import { depthChartV1 } from "@/lib/flags";

export const GET = createFlagsDiscoveryEndpoint(() =>
  getProviderData({ depthChartV1 }),
);
