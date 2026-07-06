import { cn } from "@/lib/utils";
import type { GamecastPanelSlots } from "./GamecastPanelSlots";

/** Shared mobile collapse: single column below ~900px. */
const MOBILE_STACK =
  "max-[900px]:flex max-[900px]:flex-col max-[900px]:gap-[18px]";

const MOBILE_ORDER = {
  field: "max-[900px]:order-1",
  drive: "max-[900px]:order-2",
  winProb: "max-[900px]:order-3",
  playByPlay: "max-[900px]:order-4",
  stats: "max-[900px]:order-5",
  transport: "max-[900px]:order-6",
} as const;

export default function BroadcastLayout({
  panels,
  showSituation,
}: {
  panels: GamecastPanelSlots;
  showSituation: boolean;
}) {
  return (
    <>
      {panels.scoreboard}
      {panels.postScoreboardBanner}

      <div className={MOBILE_STACK}>
        <div
          className={cn(
            "border-b border-border bg-surface-2 px-5 py-4 max-[900px]:border-t max-[900px]:border-border",
            MOBILE_ORDER.transport,
          )}
        >
          {panels.transport}
        </div>

        <div
          className={cn(
            "border-b border-border px-5 py-3 max-[900px]:hidden",
            showSituation ? "bg-surface" : "bg-surface-2",
          )}
        >
          {panels.situationStrip}
        </div>

        <div className="grid gap-[18px] p-5 lg:grid-cols-[1fr_360px] max-[900px]:contents max-[900px]:p-0">
          <div className="space-y-[18px] max-[900px]:contents">
            <div className={MOBILE_ORDER.field}>{panels.fieldPosition}</div>
            <div className={MOBILE_ORDER.drive}>{panels.driveChart}</div>
          </div>

          <div className="space-y-[18px] max-[900px]:contents">
            <div className={MOBILE_ORDER.winProb}>{panels.winProbability}</div>
            <div className={MOBILE_ORDER.stats}>{panels.scoringSummary}</div>
            <div className={MOBILE_ORDER.stats}>{panels.boxScore}</div>
          </div>
        </div>

        <div
          className={cn(
            "mx-5 mb-5 max-[900px]:mx-0 max-[900px]:mb-0",
            MOBILE_ORDER.playByPlay,
          )}
        >
          {panels.playByPlay}
        </div>
      </div>
    </>
  );
}
