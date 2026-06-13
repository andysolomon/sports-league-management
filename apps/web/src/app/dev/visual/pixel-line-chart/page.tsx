import { notFound } from "next/navigation";
import PixelLineChart from "@/components/attributes/PixelLineChart";

/*
 * Visual-regression harness (WSM-000082). Renders PixelLineChart with fixed,
 * deterministic data so Playwright's toHaveScreenshot has a stable target —
 * no Convex, no auth, no seeding. Multi-season points exercise the responsive
 * viewBox + x-axis label thinning. Never shipped to production.
 */

// A career-length series: enough points to trigger label thinning, with a
// dip so the polyline isn't monotonic.
const CAREER_POINTS = [
  { x: "2017", y: 62 },
  { x: "2018", y: 68 },
  { x: "2019", y: 74 },
  { x: "2020", y: 71 },
  { x: "2021", y: 79 },
  { x: "2022", y: 85 },
  { x: "2023", y: 88 },
  { x: "2024", y: 84 },
  { x: "2026", y: 89 },
];

export default function PixelLineChartVisualHarness() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <div className="bg-background p-6">
      <div data-testid="chart-multi" className="w-[600px]">
        <PixelLineChart points={CAREER_POINTS} ariaLabel="career overall" />
      </div>
      <div data-testid="chart-single" className="mt-8 w-[600px]">
        <PixelLineChart points={[{ x: "2026", y: 84 }]} ariaLabel="single season" />
      </div>
      <div data-testid="chart-empty" className="mt-8 w-[600px]">
        <PixelLineChart points={[]} ariaLabel="no data" />
      </div>
    </div>
  );
}
