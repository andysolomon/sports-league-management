export interface TeamDisplay {
  abbr: string;
  color: string;
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function deriveTeamDisplay(
  name: string,
  primaryColor?: string | null,
): TeamDisplay {
  const trimmed = name.trim();
  const abbr = (trimmed.slice(0, 3) || "TM").toUpperCase();
  const color =
    primaryColor && HEX_COLOR_RE.test(primaryColor)
      ? primaryColor
      : "var(--text-subtle)";
  return { abbr, color };
}
