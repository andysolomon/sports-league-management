import type { PbpParticipantRole, PbpPlay } from "@/lib/pbp";
import {
  resolvePlayerLabel,
  type GamecastPlayerNameMap,
} from "./player-names";

function participantLabel(
  play: PbpPlay,
  map: GamecastPlayerNameMap,
  role: PbpParticipantRole,
): string | null {
  const p = play.participants.find((x) => x.role === role);
  if (!p) return null;
  return resolvePlayerLabel(p.playerId, map, role);
}

function tacklerLabels(play: PbpPlay, map: GamecastPlayerNameMap): string[] {
  const labels: string[] = [];
  for (const role of ["tackler_solo", "tackler_ast"] as const) {
    for (const p of play.participants.filter((x) => x.role === role)) {
      const name = resolvePlayerLabel(p.playerId, map, role);
      if (name) labels.push(name);
    }
  }
  return labels;
}

/** Terse contributor line for play-by-play rows. */
export function formatPlayContributors(
  play: PbpPlay,
  map: GamecastPlayerNameMap,
): string | null {
  const parts: string[] = [];

  switch (play.playType) {
    case "pass_complete":
    case "pass_incomplete": {
      const passer = participantLabel(play, map, "passer");
      const receiver = participantLabel(play, map, "receiver");
      if (passer && receiver) {
        parts.push(`${passer} → ${receiver}`);
      } else if (passer) {
        parts.push(passer);
      } else if (receiver) {
        parts.push(receiver);
      }
      break;
    }
    case "interception": {
      const passer = participantLabel(play, map, "passer");
      const interceptor = participantLabel(play, map, "interceptor");
      if (passer && interceptor) {
        parts.push(`${passer} · int: ${interceptor}`);
      } else if (passer) {
        parts.push(passer);
      } else if (interceptor) {
        parts.push(`int: ${interceptor}`);
      }
      break;
    }
    case "sack": {
      const passer = participantLabel(play, map, "passer");
      const sacker = participantLabel(play, map, "sacker");
      if (passer && sacker) {
        parts.push(`${passer} · sack: ${sacker}`);
      } else if (passer) {
        parts.push(passer);
      } else if (sacker) {
        parts.push(sacker);
      }
      break;
    }
    case "rush":
    case "kneel": {
      const rusher = participantLabel(play, map, "rusher");
      if (rusher) parts.push(rusher);
      break;
    }
    case "kickoff":
    case "punt":
    case "field_goal":
    case "field_goal_miss":
    case "extra_point":
    case "extra_point_miss": {
      const kicker = participantLabel(play, map, "kicker");
      if (kicker) parts.push(kicker);
      const returner = participantLabel(play, map, "returner");
      if (returner) parts.push(`ret: ${returner}`);
      break;
    }
    default:
      break;
  }

  const tacklers = tacklerLabels(play, map);
  if (tacklers.length > 0) {
    parts.push(`tkl: ${tacklers.join(", ")}`);
  }

  const fumbler = participantLabel(play, map, "fumbler");
  if (fumbler) parts.push(`fum: ${fumbler}`);

  if (parts.length === 0) return null;
  return parts.join(" · ");
}
