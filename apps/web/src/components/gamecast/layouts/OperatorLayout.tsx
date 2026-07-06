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

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wide text-text-subtle">
      {children}
    </p>
  );
}

export default function OperatorLayout({ panels }: { panels: GamecastPanelSlots }) {
  return (
    <div className={`min-h-[560px] ${MOBILE_STACK}`}>
      <div className="border-b border-border bg-surface px-5 py-3 max-[900px]:hidden">
        {panels.operatorHeader}
      </div>
      {panels.postScoreboardBanner}

      <div className="grid grid-cols-1 gap-[18px] p-5 lg:grid-cols-[250px_1fr_300px] max-[900px]:contents max-[900px]:p-0">
        <aside className="space-y-4 bg-surface max-[900px]:contents">
          <div className={`max-[900px]:contents ${MOBILE_ORDER.transport}`}>
            <SectionLabel>Controls</SectionLabel>
            {panels.transport}
          </div>
          <div className={MOBILE_ORDER.field}>
            <SectionLabel>Field</SectionLabel>
            {panels.fieldPositionMini}
          </div>
          <div className={MOBILE_ORDER.winProb}>
            <SectionLabel>Win probability</SectionLabel>
            {panels.winProbabilityCompact}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col gap-[18px] max-[900px]:contents">
          <div className={`min-h-0 rounded-card border border-border bg-surface max-[900px]:contents ${MOBILE_ORDER.drive}`}>
            {panels.driveChart}
          </div>
          <div className={`min-h-0 flex-1 overflow-hidden max-[900px]:contents ${MOBILE_ORDER.playByPlay}`}>
            {panels.playByPlay}
          </div>
        </main>

        <aside className={`space-y-[18px] bg-surface max-[900px]:contents ${MOBILE_ORDER.stats}`}>
          {panels.boxScore}
          {panels.scoringSummary}
        </aside>
      </div>
    </div>
  );
}
