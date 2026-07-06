import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { simulateGameLog, allPlays } from "@/lib/pbp";
import type { PbpGameInput, PlayerSimProfile, TeamSimProfile } from "@/lib/pbp";
import {
  entireGameIndex,
  groupPlaysByDrive,
  revealedPlays,
  scoreAtPosition,
} from "@/lib/gamecast";
import GamecastView from "@/components/gamecast/GamecastView";
import BroadcastLayout from "@/components/gamecast/layouts/BroadcastLayout";
import FieldFirstLayout from "@/components/gamecast/layouts/FieldFirstLayout";
import OperatorLayout from "@/components/gamecast/layouts/OperatorLayout";
import PlayList from "@/components/gamecast/PlayList";
import DriveChart from "@/components/gamecast/DriveChart";
import { buildDriveChartSegments } from "@/lib/gamecast";
import GamecastEmptyState, {
  gamecastEmptyMessage,
} from "@/components/gamecast/GamecastEmptyState";

function makePlayer(
  teamId: string,
  position: string,
  overall: number,
  depthRank: number,
): PlayerSimProfile {
  return {
    playerId: `${teamId}-${position}-${depthRank}`,
    position,
    overall,
    depthRank,
    positionSlot: position,
  };
}

function buildRoster(teamId: string, strength: number): PlayerSimProfile[] {
  const specs: Array<[string, number]> = [
    ["QB", 1],
    ["RB", 2],
    ["WR", 3],
    ["TE", 1],
    ["DE", 2],
    ["LB", 2],
    ["CB", 2],
    ["K", 1],
    ["P", 1],
  ];
  const players: PlayerSimProfile[] = [];
  for (const [pos, count] of specs) {
    for (let i = 1; i <= count; i++) {
      players.push(makePlayer(teamId, pos, strength, i));
    }
  }
  return players;
}

function buildTeam(teamId: string, strength: number): TeamSimProfile {
  return { teamId, strength, players: buildRoster(teamId, strength) };
}

function defaultInput(seed: number): PbpGameInput {
  return {
    home: buildTeam("home", 68),
    away: buildTeam("away", 62),
    seed,
    decisive: false,
  };
}

const log = simulateGameLog(defaultInput(5150));
const plays = allPlays(log);
const finalScore = scoreAtPosition(log, plays, entireGameIndex(plays.length));

const baseProps = {
  log,
  homeTeamName: "Wheeler",
  awayTeamName: "Hillgrove",
  homePrimaryColor: "#3d6fe6",
  awayPrimaryColor: "#d1503a",
  weekLabel: "Week 6",
  engineVersionMismatch: false,
  storedEngineVersion: "1",
  currentEngineVersion: "1",
};

const homeTeam = { name: "Wheeler", abbr: "WHE", color: "#3d6fe6" };
const awayTeam = { name: "Hillgrove", abbr: "HIL", color: "#d1503a" };

describe("GamecastView", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("opens in review mode at the final play with final score", () => {
    const html = renderToStaticMarkup(createElement(GamecastView, baseProps));
    expect(html).toContain(`Review · ${plays.length}/${plays.length}`);
    expect(html).toContain(`data-testid="gamecast-score-home"`);
    expect(html).toContain(`>${finalScore.home}<`);
    expect(html).toContain(`>${finalScore.away}<`);
    expect(html).toContain("Final");
  });

  it("renders broadcast panels and play-by-play at final position", () => {
    const html = renderToStaticMarkup(createElement(GamecastView, baseProps));
    expect(html).toContain("Field position");
    expect(html).toContain("Win probability");
    expect(html).toContain("Scoring summary");
    expect(html).toContain("Team stats");
    expect(html).toContain("Play-by-play");
    expect(html).toContain('data-testid="gamecast-layout-switcher"');
    expect(html).not.toContain("Press Next play to start the gamecast.");
    expect(html).not.toContain('data-testid="gamecast-dynasty-banner"');
  });

  it("renders the dynasty deep-link banner when dynastyCta is set", () => {
    const html = renderToStaticMarkup(
      createElement(GamecastView, {
        ...baseProps,
        dynastyCta: { leagueId: "league-abc" },
      }),
    );
    expect(html).toContain('data-testid="gamecast-dynasty-banner"');
    expect(html).toContain("Season decided");
    expect(html).toContain("Go to dynasty panel");
    expect(html).toContain("/dashboard/leagues/league-abc#dynasty-panel");
  });

  it("omits the dynasty banner when dynastyCta is null", () => {
    const html = renderToStaticMarkup(
      createElement(GamecastView, { ...baseProps, dynastyCta: null }),
    );
    expect(html).not.toContain('data-testid="gamecast-dynasty-banner"');
  });

  it("renders score testids in each layout arrangement", () => {
    const viewHtml = renderToStaticMarkup(createElement(GamecastView, baseProps));
    expect(viewHtml).toContain('data-testid="gamecast-score-home"');
    expect(viewHtml).toContain('data-testid="gamecast-score-away"');

    const panels = {
      scoreboard: createElement("div", {
        "data-testid": "gamecast-score-home",
      }),
      postScoreboardBanner: null,
      transport: null,
      situationStrip: null,
      fieldPosition: null,
      fieldPositionHero: null,
      fieldPositionMini: null,
      driveChart: null,
      driveChartSlim: null,
      winProbability: null,
      winProbabilityCompact: null,
      boxScore: createElement("div", {
        "data-testid": "gamecast-score-away",
      }),
      scoringSummary: null,
      playByPlay: null,
      operatorHeader: createElement("div", {
        "data-testid": "gamecast-score-home",
      }),
    };

    const broadcastHtml = renderToStaticMarkup(
      createElement(BroadcastLayout, {
        panels,
        showSituation: false,
      }),
    );
    expect(broadcastHtml).toContain('data-testid="gamecast-score-home"');
    expect(broadcastHtml).toContain('data-testid="gamecast-score-away"');

    const fieldFirstHtml = renderToStaticMarkup(
      createElement(FieldFirstLayout, { panels }),
    );
    expect(fieldFirstHtml).toContain('data-testid="gamecast-score-home"');
    expect(fieldFirstHtml).toContain('data-testid="gamecast-score-away"');

    const operatorHtml = renderToStaticMarkup(
      createElement(OperatorLayout, { panels }),
    );
    expect(operatorHtml).toContain('data-testid="gamecast-score-home"');
    expect(operatorHtml).toContain('data-testid="gamecast-score-away"');
  });

  it("keeps empty-state copy unchanged for missing logs", () => {
    const html = renderToStaticMarkup(
      createElement(GamecastEmptyState, {
        leagueId: "league-1",
        reason: "no_log",
      }),
    );
    expect(html).toContain(gamecastEmptyMessage("no_log"));
  });
});

describe("PlayList sim vs review rendering", () => {
  const allGroups = groupPlaysByDrive(log, plays);
  const revealedOnly = groupPlaysByDrive(log, revealedPlays(plays, 3));

  it("hides future plays in sim mode at kickoff", () => {
    const html = renderToStaticMarkup(
      createElement(PlayList, {
        groups: [],
        allPlaysFlat: plays,
        homeTeamId: log.homeTeamId,
        homeTeam,
        awayTeam,
        playIndex: 0,
        mode: "sim",
        animate: false,
        onPlaySelect: () => {},
      }),
    );
    expect(html).toContain("Press Next play to start the gamecast.");
  });

  it("dims unreached plays in review mode", () => {
    const html = renderToStaticMarkup(
      createElement(PlayList, {
        groups: allGroups,
        allPlaysFlat: plays,
        homeTeamId: log.homeTeamId,
        homeTeam,
        awayTeam,
        playIndex: 3,
        mode: "review",
        animate: false,
        onPlaySelect: () => {},
      }),
    );
    expect(html).toContain("opacity-40");
  });

  it("only renders revealed plays in sim mode", () => {
    const simHtml = renderToStaticMarkup(
      createElement(PlayList, {
        groups: revealedOnly,
        allPlaysFlat: plays,
        homeTeamId: log.homeTeamId,
        homeTeam,
        awayTeam,
        playIndex: 3,
        mode: "sim",
        animate: false,
        onPlaySelect: () => {},
      }),
    );
    const reviewHtml = renderToStaticMarkup(
      createElement(PlayList, {
        groups: allGroups,
        allPlaysFlat: plays,
        homeTeamId: log.homeTeamId,
        homeTeam,
        awayTeam,
        playIndex: 3,
        mode: "review",
        animate: false,
        onPlaySelect: () => {},
      }),
    );
    expect(simHtml.length).toBeLessThan(reviewHtml.length);
  });
});

describe("DriveChart interactions", () => {
  it("renders clickable drive rows with chart label", () => {
    const segments = buildDriveChartSegments(log, plays, plays.length);
    const html = renderToStaticMarkup(
      createElement(DriveChart, {
        log,
        plays,
        segments,
        homeTeam,
        awayTeam,
        mode: "review",
        playIndex: plays.length,
        onDriveSelect: () => {},
      }),
    );
    expect(html).toContain('aria-label="Drive chart"');
    expect(html).toContain("<button");
    expect(html).toContain("pl ·");
  });
});
