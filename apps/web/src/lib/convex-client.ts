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
    throw new Error(
      `Missing Convex admin key. NEXT_PUBLIC_CONVEX_URL points at a cloud ` +
        `deployment (${url}), which needs CONVEX_ADMIN_KEY to authorize ` +
        `server-side reads/writes. Fix one of two ways:\n` +
        `  • Cloud dev: set CONVEX_ADMIN_KEY in apps/web/.env.local to a deploy ` +
        `key (Convex dashboard → Settings → Deploy Keys → Create Deploy Key).\n` +
        `  • Local backend: point NEXT_PUBLIC_CONVEX_URL at http://127.0.0.1:3210 ` +
        `and run \`convex dev\` — a local deployment needs no key.\n` +
        `See apps/web/.env.local.example.`,
    );
  }

  const client = new ConvexHttpClient(url);
  if (adminKey) {
    const withAdmin = client as ConvexHttpClient & {
      setAdminAuth?: (key: string) => void;
    };
    // Fail loud rather than silently returning a non-admin client (WSM-000151):
    // a missing setAdminAuth (e.g. a future Convex rename) would otherwise leave
    // every internalMutation write broken while public reads still work — the
    // exact silent failure mode behind WSM-000150. (An *invalid* key value can't
    // be caught here — Convex validates it server-side; /api/health's adminPing
    // probe covers that case.)
    if (typeof withAdmin.setAdminAuth !== "function") {
      throw new Error(
        "Convex client is missing setAdminAuth — cannot authenticate admin writes.",
      );
    }
    withAdmin.setAdminAuth(adminKey);
  }
  return client;
}
