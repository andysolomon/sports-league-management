import type { GamecastPanelSlots } from "./GamecastPanelSlots";

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

export default function FieldFirstLayout({ panels }: { panels: GamecastPanelSlots }) {
  return (
    <div
      data-testid="gamecast-field-first-layout"
      className={`grid min-h-[620px] grid-cols-1 gap-[18px] p-5 lg:grid-cols-[1fr_340px] ${MOBILE_STACK}`}
    >
      <div className="flex min-h-0 flex-col gap-[18px] max-[900px]:contents">
        <div className="shrink-0 [&_[data-testid=gamecast-scoreboard]]:px-4 [&_[data-testid=gamecast-scoreboard]]:py-3 max-[900px]:order-none">
          {panels.scoreboard}
          {panels.postScoreboardBanner}
        </div>

        <div className={`flex min-h-0 flex-1 flex-col gap-3 max-[900px]:contents ${MOBILE_ORDER.field}`}>
          <div className="shrink-0 border-b border-border bg-surface px-1 py-2 lg:hidden">
            {panels.situationStrip}
          </div>
          <div className="shrink-0 max-lg:hidden">{panels.situationStrip}</div>
          {panels.fieldPositionHero}
        </div>

        <div className={`shrink-0 max-[900px]:contents ${MOBILE_ORDER.drive}`}>
          {panels.driveChartSlim}
        </div>

        <div
          className={`mt-auto shrink-0 rounded-card border border-border bg-surface-2 p-4 max-[900px]:contents ${MOBILE_ORDER.transport}`}
        >
          {panels.transport}
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-[18px] bg-surface max-[900px]:contents">
        <div className={MOBILE_ORDER.winProb}>{panels.winProbability}</div>
        <div
          className={`min-h-0 flex-1 overflow-hidden lg:max-h-[calc(620px-24rem)] ${MOBILE_ORDER.playByPlay}`}
        >
          <div className="flex h-full min-h-0 flex-col [&_[data-slot=card]]:flex [&_[data-slot=card]]:min-h-0 [&_[data-slot=card]]:flex-1 [&_[data-slot=card-content]]:min-h-0 [&_[data-slot=card-content]]:overflow-y-auto">
            {panels.playByPlay}
          </div>
        </div>
        <div className={`hidden max-[900px]:block ${MOBILE_ORDER.stats}`}>
          {panels.boxScore}
        </div>
        <div className={`hidden max-[900px]:block ${MOBILE_ORDER.stats}`}>
          {panels.scoringSummary}
        </div>
      </div>
    </div>
  );
}
