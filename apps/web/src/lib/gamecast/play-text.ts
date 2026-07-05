import type { PbpPlay } from "@/lib/pbp";

function ordinalDown(down: number): string {
  if (down === 1) return "1st";
  if (down === 2) return "2nd";
  if (down === 3) return "3rd";
  return `${down}th`;
}

function yardsLabel(yards: number): string {
  if (yards === 0) return "no gain";
  if (yards > 0) return `${yards} yd gain`;
  return `${Math.abs(yards)} yd loss`;
}

export function formatDownAndDistance(play: PbpPlay): string {
  if (play.playType === "kickoff") return "Kickoff";
  if (play.playType === "extra_point" || play.playType === "extra_point_miss") {
    return "Extra point";
  }
  if (play.playType === "field_goal" || play.playType === "field_goal_miss") {
    return "Field goal";
  }
  if (play.playType === "punt") return "Punt";
  if (play.playType === "kneel") return "Kneel";
  return `${ordinalDown(play.down)} & ${play.distance}`;
}

export function describePlay(play: PbpPlay): string {
  const yards = yardsLabel(play.yardsGained);
  switch (play.playType) {
    case "kickoff":
      return `Kickoff, ${yards}`;
    case "rush":
      return `Rush, ${yards}`;
    case "pass_complete":
      return `Pass complete, ${yards}`;
    case "pass_incomplete":
      return "Pass incomplete";
    case "sack":
      return `Sacked, ${yards}`;
    case "interception":
      return `Intercepted${play.yardsGained ? `, ${yards}` : ""}`;
    case "punt":
      return `Punt, ${yards}`;
    case "field_goal":
      return play.isScoring ? "Field goal GOOD" : `Field goal, ${yards}`;
    case "field_goal_miss":
      return "Field goal NO GOOD";
    case "extra_point":
      return play.isScoring ? "Extra point GOOD" : "Extra point NO GOOD";
    case "extra_point_miss":
      return "Extra point NO GOOD";
    case "kneel":
      return `Kneel, ${yards}`;
    default:
      return yards;
  }
}
