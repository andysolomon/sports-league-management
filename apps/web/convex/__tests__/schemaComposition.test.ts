import { describe, it, expect } from "vitest";
import schema from "../schema";
import { coreTables } from "../tables/core";
import { rosterTables } from "../tables/roster";
import { orgTables } from "../tables/org";
import { ratingsTables } from "../tables/ratings";
import { competitionTables } from "../tables/competition";
import { mediaTables } from "../tables/media";
import { offseasonTables } from "../tables/offseason";
import { dynastyTables } from "../tables/dynasty";

/*
 * Schema composition guard (Dynasty Mode F1).
 *
 * `schema.ts` spreads grouped table modules into one `defineSchema`. Spreading
 * makes a duplicate table name SILENT — the later group simply shadows the
 * earlier one, and the shadowed definition (with its indexes) vanishes from the
 * deployed schema with no error anywhere. Dynasty Mode roughly doubles the table
 * count across four more groups, so that failure mode gets more likely, not
 * less. This test makes it loud.
 */

const groups = {
  core: coreTables,
  roster: rosterTables,
  org: orgTables,
  ratings: ratingsTables,
  competition: competitionTables,
  media: mediaTables,
  offseason: offseasonTables,
  dynasty: dynastyTables,
} as const;

type Exportable = { export(): string };

function deployedTableNames(): string[] {
  const parsed = JSON.parse((schema as unknown as Exportable).export()) as {
    tables: Array<{ tableName: string }>;
  };
  return parsed.tables.map((t) => t.tableName);
}

describe("schema composition (F1)", () => {
  it("declares no table name in more than one group", () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const [groupName, tables] of Object.entries(groups)) {
      for (const tableName of Object.keys(tables)) {
        const previous = seen.get(tableName);
        if (previous) {
          collisions.push(`${tableName}: ${previous} and ${groupName}`);
        } else {
          seen.set(tableName, groupName);
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it("deploys every table declared by every group", () => {
    const declared = Object.values(groups).flatMap((t) => Object.keys(t));
    const deployed = deployedTableNames();

    // A shadowed table would be declared but absent from the deployed schema.
    expect([...deployed].sort()).toEqual([...declared].sort());
  });
});
