/**
 * Test Data Constants
 *
 * Typed seed data constants duplicated from root e2e/helpers/test-data.js.
 * These values must match what seed-data.js imports.
 */

export const LEAGUES = {
  NFL: "National Football League",
  MLS: "Major League Soccer",
} as const;

export const TEAMS = {
  COWBOYS: {
    name: "Dallas Cowboys",
    city: "Dallas",
    stadium: "AT&T Stadium",
    foundedYear: 1960,
    league: LEAGUES.NFL,
  },
  PATRIOTS: {
    name: "New England Patriots",
    city: "Foxborough",
    stadium: "Gillette Stadium",
    foundedYear: 1960,
    league: LEAGUES.NFL,
  },
  GALAXY: {
    name: "LA Galaxy",
    city: "Los Angeles",
    stadium: "Dignity Health Sports Park",
    foundedYear: 1996,
    league: LEAGUES.MLS,
  },
  SOUNDERS: {
    name: "Seattle Sounders FC",
    city: "Seattle",
    stadium: "Lumen Field",
    foundedYear: 2007,
    league: LEAGUES.MLS,
  },
} as const;

export const SEASONS = {
  NFL_2025: {
    name: "2025-2026 NFL Season",
    league: LEAGUES.NFL,
    startDate: "2025-09-04",
    endDate: "2026-02-08",
    status: "Active",
  },
  NFL_2024: {
    name: "2024-2025 NFL Season",
    league: LEAGUES.NFL,
    startDate: "2024-09-05",
    endDate: "2025-02-09",
    status: "Completed",
  },
  MLS_2025: {
    name: "2025 MLS Season",
    league: LEAGUES.MLS,
    startDate: "2025-02-22",
    endDate: "2025-10-25",
    status: "Upcoming",
  },
} as const;

export const PLAYERS = {
  PRESCOTT: { name: "Dak Prescott", team: TEAMS.COWBOYS.name, position: "QB", jersey: 4, status: "Active" },
  LAMB: { name: "CeeDee Lamb", team: TEAMS.COWBOYS.name, position: "WR", jersey: 88, status: "Active" },
  PARSONS: { name: "Micah Parsons", team: TEAMS.COWBOYS.name, position: "LB", jersey: 11, status: "Injured" },
  MAYE: { name: "Drake Maye", team: TEAMS.PATRIOTS.name, position: "QB", jersey: 10, status: "Active" },
  HENRY: { name: "Hunter Henry", team: TEAMS.PATRIOTS.name, position: "TE", jersey: 85, status: "Active" },
  BARMORE: { name: "Christian Barmore", team: TEAMS.PATRIOTS.name, position: "DT", jersey: 90, status: "Inactive" },
  PUIG: { name: "Riqui Puig", team: TEAMS.GALAXY.name, position: "MF", jersey: 10, status: "Active" },
  JOVELJIC: { name: "Dejan Joveljic", team: TEAMS.GALAXY.name, position: "FW", jersey: 9, status: "Active" },
  YOSHIDA: { name: "Maya Yoshida", team: TEAMS.GALAXY.name, position: "DF", jersey: 4, status: "Injured" },
  PAULO: { name: "Joao Paulo", team: TEAMS.SOUNDERS.name, position: "MF", jersey: 6, status: "Active" },
  MORRIS: { name: "Jordan Morris", team: TEAMS.SOUNDERS.name, position: "FW", jersey: 13, status: "Active" },
  FREI: { name: "Stefan Frei", team: TEAMS.SOUNDERS.name, position: "GK", jersey: 24, status: "Inactive" },
} as const;
