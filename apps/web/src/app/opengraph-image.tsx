import { ImageResponse } from "next/og";

export const alt =
  "sprtsmng — Manage your sports team without the spreadsheets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #dbeafe 0%, #ffffff 100%)",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top: monogram + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "16px",
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "44px",
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div
            style={{
              fontSize: "40px",
              fontWeight: 700,
              color: "#18181b",
              letterSpacing: "-0.01em",
            }}
          >
            sprtsmng
          </div>
        </div>

        {/* Bottom: hero copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            gap: "28px",
          }}
        >
          <div
            style={{
              fontSize: "76px",
              fontWeight: 800,
              color: "#18181b",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              maxWidth: "1000px",
            }}
          >
            Manage your team without the spreadsheets.
          </div>
          <div
            style={{
              fontSize: "30px",
              color: "#52525b",
              lineHeight: 1.4,
            }}
          >
            Roster, schedule, notifications. Free for one team, forever.
          </div>
        </div>

        {/* Bottom-right tag */}
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            right: "80px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "999px",
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            color: "#2563eb",
            fontSize: "20px",
            fontWeight: 600,
          }}
        >
          sprtsmng.andrewsolomon.dev
        </div>
      </div>
    ),
    { ...size },
  );
}
