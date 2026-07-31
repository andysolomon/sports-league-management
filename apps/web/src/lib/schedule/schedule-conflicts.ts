/**
 * Fixture scheduling rules — canonical implementation lives under `convex/`
 * because writes enforce the same week constraints server-side.
 */
export {
  findWeekConflict,
  isValidWeek,
  type WeekFixture,
  type WeekFixtureCandidate,
} from "../../../convex/lib/scheduleConflicts";
