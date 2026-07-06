import type { ReactNode } from "react";

export interface GamecastPanelSlots {
  scoreboard: ReactNode;
  postScoreboardBanner: ReactNode | null;
  transport: ReactNode;
  situationStrip: ReactNode;
  fieldPosition: ReactNode;
  fieldPositionHero: ReactNode;
  fieldPositionMini: ReactNode;
  driveChart: ReactNode;
  driveChartSlim: ReactNode;
  winProbability: ReactNode;
  winProbabilityCompact: ReactNode;
  boxScore: ReactNode;
  scoringSummary: ReactNode;
  playByPlay: ReactNode;
  operatorHeader: ReactNode;
}
