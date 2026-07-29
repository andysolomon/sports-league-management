import { describe, it, expect } from "vitest";
import {
  JV,
  VARSITY,
  positionChangeFit,
  recommendPromotions,
  squadChange,
  type RosterPlayer,
} from "../promotions";
import {
  POSITION_CHANGE_OPTIONS,
  POSITION_TO_GROUP,
} from "../../../../convex/lib/positions";

function player(over: Partial<RosterPlayer> = {}): RosterPlayer {
  return {
    playerId: "p1",
    name: "Cam Whitfield",
    position: "WR",
    grade: 10,
    squad: JV,
    overall: 78,
    ...over,
  };
}

describe("squadChange", () => {
  it("lets a sophomore be promoted — the only real decision", () => {
    expect(squadChange({ grade: 10, from: JV, to: VARSITY })).toEqual({
      ok: true,
      kind: "change",
    });
  });

  it("refuses to promote a freshman however good he is", () => {
    // Grade 9 is JV in a high-school program. It is not a coaching call.
    expect(squadChange({ grade: 9, from: JV, to: VARSITY })).toEqual({
      ok: false,
      reason: "grade_too_low_for_varsity",
    });
  });

  it("refuses to send an upperclassman down", () => {
    /*
     * `squadForGrade` puts every grade 11+ player on Varsity. B5 must preserve
     * that rather than let a coach create a state the seeder would never
     * produce and nothing else in the app expects.
     */
    for (const grade of [11, 12]) {
      expect(squadChange({ grade, from: VARSITY, to: JV })).toEqual({
        ok: false,
        reason: "grade_requires_varsity",
      });
    }
  });

  it("refuses a player with no grade rather than assuming one", () => {
    // Honest absence: null means "not modelled as a student", not "freshman".
    expect(squadChange({ grade: null, from: JV, to: VARSITY })).toEqual({
      ok: false,
      reason: "grade_unknown",
    });
  });

  it("treats a move to the squad he is already on as a no-op, not an error", () => {
    // A double-submitted promotion is a request that was already satisfied.
    expect(squadChange({ grade: 10, from: VARSITY, to: VARSITY })).toEqual({
      ok: true,
      kind: "noop",
    });
  });

  it("rejects a squad that is not a squad", () => {
    expect(squadChange({ grade: 10, from: JV, to: "Practice" })).toEqual({
      ok: false,
      reason: "invalid_squad",
    });
  });
});

describe("positionChangeFit", () => {
  const attributes = {
    SPD: 90,
    STR: 60,
    AGI: 88,
    ACC: 89,
    AWR: 70,
    STA: 80,
    CTH: 84,
  };

  it("stays inside 0..1 for every position pair the app knows", () => {
    for (const from of Object.keys(POSITION_TO_GROUP)) {
      for (const to of Object.keys(POSITION_TO_GROUP)) {
        const fit = positionChangeFit({ toPosition: to, attributes });
        expect(fit, `${from} → ${to}`).toBeGreaterThanOrEqual(0);
        expect(fit, `${from} → ${to}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rates a burner higher at a speed position than at a strength one", () => {
    // The weights are the whole mechanic: a 90-speed / 60-strength athlete
    // belongs at corner, not on the offensive line.
    const cb = positionChangeFit({ toPosition: "CB", attributes });
    const ot = positionChangeFit({ toPosition: "OT", attributes });
    expect(cb).toBeGreaterThan(ot);
  });

  it("judges a cross-group move on the athleticism he actually has", () => {
    /*
     * A quarterback has no coverage ratings at all. Scoring the missing keys as
     * zero would make every cross-group move ~0 and the control decoration;
     * leaving them out of both sides of the ratio adds no information that is
     * not there.
     */
    const fit = positionChangeFit({
      toPosition: "CB",
      attributes: { SPD: 95, AGI: 92, ACC: 93, AWR: 80, STR: 70, STA: 85 },
    });
    expect(fit).toBeGreaterThan(0.7);
  });

  it("scores an unknown position at zero rather than guessing", () => {
    expect(positionChangeFit({ toPosition: "GOALIE", attributes })).toBe(0);
  });

  it("scores a player with no ratings at zero", () => {
    expect(positionChangeFit({ toPosition: "WR", attributes: {} })).toBe(0);
  });

  it("offers only positions the app recognises", () => {
    // The dropdown narrows what is suggested; it must never suggest something
    // the mutation would reject.
    for (const position of POSITION_CHANGE_OPTIONS) {
      expect(POSITION_TO_GROUP[position]).toBeDefined();
    }
  });
});

describe("recommendPromotions", () => {
  it("recommends a JV player who outrates the weakest Varsity man at his spot", () => {
    const out = recommendPromotions([
      player({ playerId: "jv", overall: 80 }),
      player({ playerId: "v1", squad: VARSITY, grade: 11, overall: 72 }),
      player({ playerId: "v2", squad: VARSITY, grade: 12, overall: 88 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      playerId: "jv",
      replacesPlayerId: "v1",
      margin: 8,
    });
  });

  it("stays quiet when the JV man is not better than anyone he would replace", () => {
    // The argument is comparative. "He is good" is not a reason to promote.
    const out = recommendPromotions([
      player({ playerId: "jv", overall: 70 }),
      player({ playerId: "v1", squad: VARSITY, grade: 11, overall: 72 }),
    ]);
    expect(out).toEqual([]);
  });

  it("puts an unmanned position first — there is nobody to beat", () => {
    const out = recommendPromotions([
      player({ playerId: "jv-wr", position: "WR", overall: 95 }),
      player({
        playerId: "v-wr",
        position: "WR",
        squad: VARSITY,
        grade: 11,
        overall: 60,
      }),
      player({ playerId: "jv-k", position: "K", overall: 55 }),
    ]);
    expect(out.map((r) => r.playerId)).toEqual(["jv-k", "jv-wr"]);
    expect(out[0].replacesName).toBeNull();
  });

  it("never recommends a freshman", () => {
    const out = recommendPromotions([
      player({ playerId: "fr", grade: 9, overall: 99 }),
    ]);
    expect(out).toEqual([]);
  });

  it("ignores players with no rating rather than ranking them as zero", () => {
    const out = recommendPromotions([
      player({ playerId: "unrated", overall: null }),
    ]);
    expect(out).toEqual([]);
  });

  it("is stable: the same roster always yields the same order", () => {
    const roster = [
      player({ playerId: "b", position: "WR", overall: 80 }),
      player({ playerId: "a", position: "TE", overall: 80 }),
      player({
        playerId: "v-wr",
        position: "WR",
        squad: VARSITY,
        grade: 11,
        overall: 70,
      }),
      player({
        playerId: "v-te",
        position: "TE",
        squad: VARSITY,
        grade: 11,
        overall: 70,
      }),
    ];
    const first = recommendPromotions(roster).map((r) => r.playerId);
    const again = recommendPromotions([...roster].reverse()).map(
      (r) => r.playerId,
    );
    expect(first).toEqual(again);
    expect(first).toEqual(["a", "b"]);
  });
});
