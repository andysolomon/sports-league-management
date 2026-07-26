import { defineSchema } from "convex/server";
import { coreTables } from "./tables/core";
import { rosterTables } from "./tables/roster";
import { orgTables } from "./tables/org";
import { ratingsTables } from "./tables/ratings";
import { competitionTables } from "./tables/competition";
import { mediaTables } from "./tables/media";
import { offseasonTables } from "./tables/offseason";
import { dynastyTables } from "./tables/dynasty";

/*
 * The schema is composed from grouped table modules under `convex/tables/`
 * rather than one long literal (Dynasty Mode F1). Convex only requires a single
 * `defineSchema` call — spreading is free — and the split keeps diffs reviewable
 * as Dynasty Mode roughly doubles the table count.
 *
 * The split moved definitions verbatim: no field, validator, index or index
 * column changed, so it implies no migration.
 *
 * Adding tables? Put them in the group they belong to, or add a new
 * `tables/<group>.ts` exporting one object and spread it below. Table names
 * must stay unique across every group — a duplicate key would silently shadow
 * the earlier definition rather than error, so keep each table in exactly one
 * module.
 */
export default defineSchema({
  ...coreTables,
  ...rosterTables,
  ...orgTables,
  ...ratingsTables,
  ...competitionTables,
  ...mediaTables,
  ...offseasonTables,
  ...dynastyTables,
});
