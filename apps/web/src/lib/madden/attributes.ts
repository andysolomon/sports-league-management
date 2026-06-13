/**
 * Madden attribute display helpers (WSM-000095). Source keys are ALL-CAPS
 * with no separators (THROWACCURACYSHORT), so humanizing relies on an explicit
 * label map with a title-cased fallback for anything new EA adds.
 */
const MADDEN_LABELS: Record<string, string> = {
  ACCELERATION: "Acceleration",
  AGILITY: "Agility",
  JUMPING: "Jumping",
  STAMINA: "Stamina",
  STRENGTH: "Strength",
  AWARENESS: "Awareness",
  BCVISION: "BC Vision",
  BLOCKSHEDDING: "Block Shedding",
  BREAKSACK: "Break Sack",
  BREAKTACKLE: "Break Tackle",
  CARRYING: "Carrying",
  CATCHINTRAFFIC: "Catch in Traffic",
  CATCHING: "Catching",
  CHANGEOFDIRECTION: "Change of Direction",
  DEEPROUTERUNNING: "Deep Route Running",
  FINESSEMOVES: "Finesse Moves",
  HITPOWER: "Hit Power",
  IMPACTBLOCKING: "Impact Blocking",
  INJURY: "Injury",
  JUKEMOVE: "Juke Move",
  KICKACCURACY: "Kick Accuracy",
  KICKPOWER: "Kick Power",
  KICKRETURN: "Kick Return",
  LEADBLOCK: "Lead Block",
  MANCOVERAGE: "Man Coverage",
  MEDIUMROUTERUNNING: "Medium Route Running",
  PASSBLOCK: "Pass Block",
  PASSBLOCKFINESSE: "Pass Block Finesse",
  PASSBLOCKPOWER: "Pass Block Power",
  PLAYACTION: "Play Action",
  PLAYRECOGNITION: "Play Recognition",
  POWERMOVES: "Power Moves",
  PRESS: "Press",
  PURSUIT: "Pursuit",
  RELEASE: "Release",
  RUNBLOCK: "Run Block",
  RUNBLOCKFINESSE: "Run Block Finesse",
  RUNBLOCKPOWER: "Run Block Power",
  SHORTROUTERUNNING: "Short Route Running",
  SPECTACULARCATCH: "Spectacular Catch",
  SPEED: "Speed",
  SPINMOVE: "Spin Move",
  STIFFARM: "Stiff Arm",
  TACKLE: "Tackle",
  THROWACCURACYDEEP: "Throw Accuracy (Deep)",
  THROWACCURACYMID: "Throw Accuracy (Mid)",
  THROWACCURACYSHORT: "Throw Accuracy (Short)",
  THROWONTHERUN: "Throw on the Run",
  THROWPOWER: "Throw Power",
  THROWUNDERPRESSURE: "Throw Under Pressure",
  TOUGHNESS: "Toughness",
  TRUCKING: "Trucking",
  ZONECOVERAGE: "Zone Coverage",
};

export function maddenAttributeLabel(key: string): string {
  const known = MADDEN_LABELS[key];
  if (known) return known;
  const lower = key.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Orders Madden attributes for display: drops the duplicated OVERALL key,
 * sorts by value descending so a player's elite traits surface first.
 */
export function orderedMaddenAttributes(
  attributes: Record<string, number>,
): Array<{ key: string; label: string; value: number }> {
  return Object.entries(attributes)
    .filter(([key]) => key !== "OVERALL")
    .map(([key, value]) => ({ key, label: maddenAttributeLabel(key), value }))
    .sort((a, b) => b.value - a.value);
}
