/**
 * Compact x-axis label for the development chart (WSM-000094). A season is
 * named like "2026 NFL Season"; on a career-length chart the full name
 * repeats and overlaps, so we render just the four-digit year. Falls back to
 * the full name when there's no year to extract.
 */
export function seasonYearLabel(seasonName: string): string {
  const match = seasonName.match(/\b(\d{4})\b/);
  return match ? match[1] : seasonName;
}
