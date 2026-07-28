import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * The rollover stage list is written down TWICE — once in the server action
 * that walks it (`ROLLOVER_STAGES`) and once in Convex, which enforces
 * `requested === current + 1` (`rolloverStageOrder` in `sports.ts`). Neither
 * can import the other: the action is a Next server module and Convex bundles
 * only what lives under `convex/`.
 *
 * So the lists are checked by reading both files. A stage added to one and not
 * the other is not a type error — it is a `rollover_stage_out_of_order` throw
 * that only appears when a real league rolls over, halfway through a rollover
 * that has already created the next season.
 */

const ROOT = join(__dirname, "..", "..", "..", "..", "..");

function stageList(relativePath: string, constName: string): string[] {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  const match = new RegExp(`${constName} = \\[([^\\]]*)\\]`).exec(source);
  if (!match) throw new Error(`no ${constName} in ${relativePath}`);
  return Array.from(match[1].matchAll(/"([a-z_]+)"/g)).map((m) => m[1]);
}

const clientStages = stageList(
  "src/app/dashboard/_actions/dynasty.ts",
  "ROLLOVER_STAGES",
);
const serverStages = stageList("convex/sports.ts", "rolloverStageOrder");

describe("rollover stage order", () => {
  it("is identical on both sides of the Convex boundary", () => {
    expect(clientStages).toEqual(serverStages);
  });

  it("keeps the pre-B2 stages in their original relative order", () => {
    /*
     * Adding a stage is safe. REORDERING one is not — a rollover checkpointed
     * at `rosters_copied` under the old order would be asked to advance to a
     * stage that is no longer its successor.
     */
    const original = [
      "target_created",
      "players_progressed",
      "attributes_copied",
      "rosters_copied",
      "freshmen_created",
      "completed",
    ];
    expect(clientStages.filter((s) => original.includes(s))).toEqual(original);
  });

  it("heals injuries after the new roster exists and before completion", () => {
    expect(clientStages.indexOf("injuries_healed")).toBeGreaterThan(
      clientStages.indexOf("freshmen_created"),
    );
    expect(clientStages.indexOf("injuries_healed")).toBeLessThan(
      clientStages.indexOf("completed"),
    );
  });

  it("builds the recruiting class last, after the roster is settled (B3)", () => {
    /*
     * The class is generated once and never regenerated, so it has to be built
     * against the roster the season actually starts with. Running it before
     * the backfill would size a board against a roster that is about to change
     * underneath it.
     */
    expect(clientStages.indexOf("prospects_generated")).toBeGreaterThan(
      clientStages.indexOf("freshmen_created"),
    );
    expect(clientStages.indexOf("prospects_generated")).toBeLessThan(
      clientStages.indexOf("completed"),
    );
  });

  it("keeps `completed` terminal", () => {
    expect(clientStages.at(-1)).toBe("completed");
    expect(serverStages.at(-1)).toBe("completed");
  });
});
