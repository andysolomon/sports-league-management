import { describe, expect, it } from "vitest";
import {
  eligibleClass,
  hofScore,
  type HallOfFameCandidate,
  type HofScoreInput,
} from "@/lib/history/hall-of-fame";

const baseline: HofScoreInput = {
  careerTotals: 1_000,
  accolades: 2,
  championships: 1,
  peakOverall: 88,
};

describe("hofScore", () => {
  for (const [field, increase] of [
    ["careerTotals", 1],
    ["accolades", 1],
    ["championships", 1],
    ["peakOverall", 1],
  ] as const) {
    it(`is monotonic in ${field}`, () => {
      expect(
        hofScore({ ...baseline, [field]: baseline[field] + increase }),
      ).toBeGreaterThanOrEqual(hofScore(baseline));
    });
  }
});

describe("eligibleClass", () => {
  it("never repeats a player or selects a zero-season player across many classes", () => {
    for (let history = 0; history < 40; history++) {
      let state = (history + 1) * 0x9e3779b1;
      const random = () => {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        return state / 2 ** 32;
      };
      const candidates: HallOfFameCandidate[] = Array.from(
        { length: 90 },
        (_, index) => ({
          recipientId: `history-${history}-player-${index}`,
          kind: "player",
          seasonsPlayed: index % 11 === 0 ? 0 : 1 + Math.floor(random() * 4),
          lastPlayedSeasonIndex: Math.floor(random() * 24),
          careerTotals: Math.floor(random() * 8_000),
          accolades: Math.floor(random() * 6),
          championships: Math.floor(random() * 3),
          peakOverall: 60 + Math.floor(random() * 40),
        }),
      );
      const inducted = new Set<string>();

      for (let season = 0; season < 30; season++) {
        const selected = eligibleClass(candidates, {
          inductionSeasonIndex: season,
          inductedRecipientIds: inducted,
        });
        for (const candidate of selected) {
          expect(candidate.seasonsPlayed).toBeGreaterThan(0);
          expect(inducted.has(candidate.recipientId)).toBe(false);
          inducted.add(candidate.recipientId);
        }
      }
    }
  });
});
