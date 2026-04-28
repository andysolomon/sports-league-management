/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as e2eSeed from "../e2eSeed.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as migrations_20260422_seasonsRosterLocked from "../migrations/20260422_seasonsRosterLocked.js";
import type * as migrations_20260428_depthChartToRoster from "../migrations/20260428_depthChartToRoster.js";
import type * as migrations_20260428_playersPositionGroup from "../migrations/20260428_playersPositionGroup.js";
import type * as sports from "../sports.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  e2eSeed: typeof e2eSeed;
  "lib/auditLog": typeof lib_auditLog;
  "migrations/20260422_seasonsRosterLocked": typeof migrations_20260422_seasonsRosterLocked;
  "migrations/20260428_depthChartToRoster": typeof migrations_20260428_depthChartToRoster;
  "migrations/20260428_playersPositionGroup": typeof migrations_20260428_playersPositionGroup;
  sports: typeof sports;
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
