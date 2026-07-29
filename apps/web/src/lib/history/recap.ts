/**
 * Season recap rules live under convex/lib so both runtimes use exactly the
 * same deterministic implementation.
 */
export { composeRecap } from "../../../convex/lib/recap";
export type {
  ComposeRecapInput,
  RecapEvent,
  RecapEventType,
  StorylineBlock,
} from "../../../convex/lib/recap";
