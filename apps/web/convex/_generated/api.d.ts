/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as dynasty from "../dynasty.js";
import type * as e2eSeed from "../e2eSeed.js";
import type * as history from "../history.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as lib_bracket from "../lib/bracket.js";
import type * as lib_draft from "../lib/draft.js";
import type * as lib_dynasty from "../lib/dynasty.js";
import type * as lib_hsSprt from "../lib/hsSprt.js";
import type * as lib_liveScore from "../lib/liveScore.js";
import type * as lib_moduleStatus from "../lib/moduleStatus.js";
import type * as lib_offseason from "../lib/offseason.js";
import type * as lib_playerStats from "../lib/playerStats.js";
import type * as lib_roundRobin from "../lib/roundRobin.js";
import type * as lib_seasonLifecycle from "../lib/seasonLifecycle.js";
import type * as lib_standings from "../lib/standings.js";
import type * as lib_statLeaders from "../lib/statLeaders.js";
import type * as lib_teamRecords from "../lib/teamRecords.js";
import type * as migrations_20260422_seasonsRosterLocked from "../migrations/20260422_seasonsRosterLocked.js";
import type * as migrations_20260428_depthChartToRoster from "../migrations/20260428_depthChartToRoster.js";
import type * as migrations_20260428_playersPositionGroup from "../migrations/20260428_playersPositionGroup.js";
import type * as migrations_20260801_seasonTeamRecords from "../migrations/20260801_seasonTeamRecords.js";
import type * as program from "../program.js";
import type * as sim from "../sim.js";
import type * as sports from "../sports.js";
import type * as tables_competition from "../tables/competition.js";
import type * as tables_core from "../tables/core.js";
import type * as tables_dynasty from "../tables/dynasty.js";
import type * as tables_media from "../tables/media.js";
import type * as tables_offseason from "../tables/offseason.js";
import type * as tables_org from "../tables/org.js";
import type * as tables_ratings from "../tables/ratings.js";
import type * as tables_roster from "../tables/roster.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  dynasty: typeof dynasty;
  e2eSeed: typeof e2eSeed;
  history: typeof history;
  "lib/auditLog": typeof lib_auditLog;
  "lib/bracket": typeof lib_bracket;
  "lib/draft": typeof lib_draft;
  "lib/dynasty": typeof lib_dynasty;
  "lib/hsSprt": typeof lib_hsSprt;
  "lib/liveScore": typeof lib_liveScore;
  "lib/moduleStatus": typeof lib_moduleStatus;
  "lib/offseason": typeof lib_offseason;
  "lib/playerStats": typeof lib_playerStats;
  "lib/roundRobin": typeof lib_roundRobin;
  "lib/seasonLifecycle": typeof lib_seasonLifecycle;
  "lib/standings": typeof lib_standings;
  "lib/statLeaders": typeof lib_statLeaders;
  "lib/teamRecords": typeof lib_teamRecords;
  "migrations/20260422_seasonsRosterLocked": typeof migrations_20260422_seasonsRosterLocked;
  "migrations/20260428_depthChartToRoster": typeof migrations_20260428_depthChartToRoster;
  "migrations/20260428_playersPositionGroup": typeof migrations_20260428_playersPositionGroup;
  "migrations/20260801_seasonTeamRecords": typeof migrations_20260801_seasonTeamRecords;
  program: typeof program;
  sim: typeof sim;
  sports: typeof sports;
  "tables/competition": typeof tables_competition;
  "tables/core": typeof tables_core;
  "tables/dynasty": typeof tables_dynasty;
  "tables/media": typeof tables_media;
  "tables/offseason": typeof tables_offseason;
  "tables/org": typeof tables_org;
  "tables/ratings": typeof tables_ratings;
  "tables/roster": typeof tables_roster;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
