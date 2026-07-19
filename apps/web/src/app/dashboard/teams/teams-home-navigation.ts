export type TeamsHomeView = "teams" | "divisions";

export function teamsHomeView(value: string | string[] | undefined): TeamsHomeView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "divisions" ? "divisions" : "teams";
}

/** Canonical Teams Home URL for the Divisions alternate view. */
export function divisionsViewHref(divisionId?: string | null): string {
  const params = new URLSearchParams({ view: "divisions" });
  if (divisionId) params.set("division", divisionId);
  return `/dashboard/teams?${params.toString()}`;
}
