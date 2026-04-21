import { ConvexHttpClient } from "convex/browser";

export function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminKey = process.env.CONVEX_ADMIN_KEY;

  if (!url) {
    throw new Error(
      "Missing Convex deployment URL. Set NEXT_PUBLIC_CONVEX_URL.",
    );
  }

  const isLocalDeployment =
    url.includes("127.0.0.1") || url.includes("localhost");

  if (!adminKey && !isLocalDeployment) {
    throw new Error("Missing Convex admin key. Set CONVEX_ADMIN_KEY.");
  }

  const client = new ConvexHttpClient(url);
  if (adminKey) {
    (client as ConvexHttpClient & {
      setAdminAuth?: (key: string) => void;
    }).setAdminAuth?.(adminKey);
  }
  return client;
}
