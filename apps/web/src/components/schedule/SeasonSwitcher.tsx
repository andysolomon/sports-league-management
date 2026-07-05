"use client";

import { useRouter, usePathname } from "next/navigation";

/*
 * Season selector for league-scoped pages (WSM-000214). Navigates to
 * `?season=<id>` on the current path; the server component resolves it via
 * resolveViewedSeason. Hidden when there's nothing to switch between.
 */
export default function SeasonSwitcher({
  seasons,
  currentSeasonId,
}: {
  seasons: Array<{ id: string; name: string; status: string }>;
  currentSeasonId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (seasons.length < 2) return null;

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      Season
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
        value={currentSeasonId}
        aria-label="Switch season"
        onChange={(e) => {
          router.push(`${pathname}?season=${encodeURIComponent(e.target.value)}`);
        }}
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status === "active" ? " (active)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
