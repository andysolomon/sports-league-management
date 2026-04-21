export type PositionGroup =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "OL"
  | "DL"
  | "LB"
  | "DB"
  | "K/P";

const POSITION_TO_GROUP: Readonly<Record<string, PositionGroup>> = {
  QB: "QB",
  HB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  LT: "OL",
  LG: "OL",
  C: "OL",
  RG: "OL",
  RT: "OL",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  OLB: "LB",
  MLB: "LB",
  ILB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
  NB: "DB",
  K: "K/P",
  P: "K/P",
  LS: "K/P",
};

export function derivePositionGroup(position: string): PositionGroup | null {
  const normalized = position.trim().toUpperCase();
  return POSITION_TO_GROUP[normalized] ?? null;
}
