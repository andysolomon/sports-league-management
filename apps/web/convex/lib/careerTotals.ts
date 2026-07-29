type StatGroup = Record<string, number>;
export type CareerStatLine = Record<string, StatGroup>;
export type CareerSeasonTotals = Record<string, CareerStatLine>;

function canonicalStatLine(line: CareerStatLine): CareerStatLine {
  return Object.fromEntries(
    Object.keys(line)
      .sort()
      .map((group) => [
        group,
        Object.fromEntries(
          Object.entries(line[group] ?? {})
            .filter((entry): entry is [string, number] => {
              const value = entry[1];
              return typeof value === "number" && Number.isFinite(value);
            })
            .sort(([a], [b]) => a.localeCompare(b)),
        ),
      ]),
  );
}

export function parseCareerStatLine(json: string): CareerStatLine {
  try {
    const value = JSON.parse(json);
    return value && typeof value === "object"
      ? canonicalStatLine(value as CareerStatLine)
      : {};
  } catch {
    return {};
  }
}

export function parseCareerSeasonTotals(json: string): CareerSeasonTotals {
  try {
    const value = JSON.parse(json);
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, CareerStatLine>).map(
        ([seasonId, totals]) => [seasonId, canonicalStatLine(totals)],
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Career totals are literal sums of season totals for every numeric key.
 *
 * This deliberately differs from per-game → season aggregation, where a
 * `long` field uses MAX. D1's contract is that every persisted season value is
 * folded into the career value exactly once.
 */
export function sumCareerSeasonTotals(
  seasons: CareerSeasonTotals,
): CareerStatLine {
  const total: CareerStatLine = {};
  for (const seasonId of Object.keys(seasons).sort()) {
    const line = seasons[seasonId] ?? {};
    for (const [group, fields] of Object.entries(line)) {
      const target = (total[group] = total[group] ?? {});
      for (const [field, value] of Object.entries(fields)) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        target[field] = (target[field] ?? 0) + value;
      }
    }
  }
  return canonicalStatLine(total);
}

export function serializeCareerSeasonTotals(
  seasons: CareerSeasonTotals,
): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(seasons)
        .sort()
        .map((seasonId) => [
          seasonId,
          canonicalStatLine(seasons[seasonId] ?? {}),
        ]),
    ),
  );
}
