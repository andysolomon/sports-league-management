export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "\u2014";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Render a fixture's "When" value (WSM-000161).
 *
 * The schedule generator anchors date-only kickoffs to noon UTC
 * (e.g. "2026-09-05T12:00:00.000Z") so the calendar day is stable across
 * timezones. Rendering that with `toLocaleString()` shows a misleading
 * placeholder time, so we detect the noon-UTC anchor and render a date only.
 *
 * Heuristic: treat the fixture as date-only when its UTC time-of-day is exactly
 * 12:00:00.000. We render that date in UTC so the calendar day matches what was
 * scheduled (not the viewer's local day). Fixtures with any other time keep the
 * existing date + time rendering in the viewer's local timezone.
 *
 * Limitation: a genuine kickoff at exactly 12:00:00.000Z would be treated as
 * date-only and lose its time. That collision is acceptable — real kickoffs land
 * on the hour/half-hour in local time and almost never on the noon-UTC anchor.
 */
export function formatFixtureWhen(scheduledAt: string | null): string {
  if (!scheduledAt) return "TBD";
  const date = new Date(scheduledAt);
  const isDateOnly =
    date.getUTCHours() === 12 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  if (isDateOnly) {
    return date.toLocaleDateString(undefined, {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return date.toLocaleString();
}

export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
