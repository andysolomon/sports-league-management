import { query } from "./_generated/server";
import { DYNASTY_MODULES, moduleStatusValidator } from "./lib/moduleStatus";

/*
 * Dynasty Mode — offseason pipeline (Epic B).
 *
 * Home for the persisted offseason phase machine, recruit scouting, transfers,
 * JV→Varsity promotions, position changes and training allocation. Empty in F1
 * beyond the readiness probe below; each later slice adds its functions here
 * rather than growing `sports.ts` (already ~7.5k lines).
 *
 * ## Rules for everything added to this module
 *
 * 1. Every WRITE is an `internalMutation` (WSM-000096). A public `mutation`
 *    here would be reachable by an anonymous `ConvexHttpClient` over the
 *    Internet. `__tests__/writeMutationsAreInternal.test.ts` fails `tsc` if one
 *    leaks — add new public READ queries to `AllowedPublicDynastyReads` there,
 *    which is a deliberate, security-reviewed act.
 * 2. Every function declares a `returns:` validator, and any DTO mapper pins
 *    its return type with `Infer<typeof someDtoValidator>` (WSM-000166).
 * 3. Per-team actions authorize on a `teamId` via `authorizeTeamMutation` /
 *    `resolveTeamRole` in the Next layer — never a bare "is org admin" check.
 *    That is what keeps multi-coach online dynasty possible without a rewrite.
 * 4. Reach this module from the Next layer through the compile-checked
 *    `dynastyRef` helpers in `src/lib/data-api.ts`, never a raw string.
 * 5. Hidden prospect truth (`trueAttributesJson`) must never appear in a
 *    `returns:` validator on a query reachable from a page or server action.
 */

/** Module readiness probe — see `lib/moduleStatus.ts` for why this exists. */
export const moduleStatus = query({
  args: {},
  returns: moduleStatusValidator,
  handler: async () => ({
    module: DYNASTY_MODULES.dynasty,
    epic: "B",
    ready: true,
  }),
});
