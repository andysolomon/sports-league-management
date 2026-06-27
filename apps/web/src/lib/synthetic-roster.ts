/*
 * Synthetic roster generator (WSM-000173).
 *
 * Produces realistic-but-fake football players to populate demo/test rosters —
 * never real player data (HS players are minors; the product fills rosters from
 * coaches, not scraping). Pure + deterministic given a seed, so it's
 * unit-testable and re-running a team yields stable output.
 *
 * A full ~48-man roster follows a believable position spread (QB→K/P). Jersey
 * numbers are unique within the batch and avoid any the team already uses.
 */

export interface SyntheticPlayer {
  name: string;
  position: string;
  jerseyNumber: number;
  grade: number; // 9–12 (US high school)
  squad: string; // "Varsity" | "JV"
  status: string; // "Active" (canonical — matches the status badge map)
  dateOfBirth: string; // ISO date, age-appropriate for the grade
  hometown: string; // "City, ST"
}

// Reference season year for deriving age-appropriate birth dates (a grade-9
// player is ~14, grade-12 ~17). Constant so generation stays deterministic.
const SEASON_YEAR = 2026;

// GA-flavored hometowns (HS football); fake, just for believable demo data.
const HOMETOWNS: readonly string[] = [
  "Acworth, GA", "Marietta, GA", "Kennesaw, GA", "Smyrna, GA",
  "Powder Springs, GA", "Austell, GA", "Mableton, GA", "Roswell, GA",
  "Alpharetta, GA", "Woodstock, GA", "Canton, GA", "Dallas, GA",
  "Douglasville, GA", "Sandy Springs, GA", "Decatur, GA", "Lawrenceville, GA",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// A believable 48-man depth spread (concrete positions, not groups).
const ROSTER_TEMPLATE: readonly string[] = [
  "QB", "QB", "QB",
  "RB", "RB", "RB", "FB",
  "WR", "WR", "WR", "WR", "WR", "WR",
  "TE", "TE", "TE",
  "LT", "LG", "C", "RG", "RT", "OL", "OL", "OL",
  "DE", "DE", "DT", "DT", "NT", "DL", "DL",
  "OLB", "OLB", "MLB", "ILB", "LB", "LB",
  "CB", "CB", "S", "FS", "SS", "DB", "DB",
  "K", "P", "LS", "ATH",
];

const FIRST_NAMES: readonly string[] = [
  "Jalen", "Marcus", "Devin", "Tyler", "Cameron", "Isaiah", "Mason", "Elijah",
  "Xavier", "Caleb", "Jordan", "Brayden", "Damari", "Zion", "Carter", "Trey",
  "Malik", "Gavin", "Bryce", "Kaden", "Jaxon", "Amari", "Dominic", "Hunter",
  "Micah", "Tristan", "Khalil", "Owen", "Cole", "Darius", "Landon", "Jamarcus",
  "Reece", "Aiden", "Quentin", "Silas", "Roman", "Davion", "Beckham", "Tate",
];

const LAST_NAMES: readonly string[] = [
  "Carter", "Brooks", "Hayes", "Coleman", "Reed", "Bennett", "Foster", "Bryant",
  "Greer", "Mathis", "Dawson", "Pierce", "Ellison", "Holland", "Ferguson", "Sutton",
  "Vance", "Whitfield", "Barlow", "Crawford", "Sterling", "Maddox", "Calloway", "Rhodes",
  "Yates", "Beckett", "Lowery", "Tatum", "Goodwin", "Hampton", "Fields", "Mercer",
  "Underwood", "Padgett", "Larkin", "Easton", "Boone", "Cross", "Maxwell", "Vaughn",
];

/** mulberry32 — tiny deterministic PRNG so generation is seedable + testable. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string — used to seed generation from a team id. */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface GenerateOptions {
  count: number;
  /** Jersey numbers already used on the team — never reused. */
  excludeJerseys?: number[];
  /** Seed for deterministic output (e.g. seedFromString(teamId)). */
  seed?: number;
}

export function generateSyntheticRoster({
  count,
  excludeJerseys = [],
  seed = 1,
}: GenerateOptions): SyntheticPlayer[] {
  const n = Math.max(0, Math.min(count, 99)); // cap at a sane jersey-bound size
  const rand = rng(seed);
  const used = new Set<number>(excludeJerseys);
  const usedNames = new Set<string>();
  const players: SyntheticPlayer[] = [];

  for (let i = 0; i < n; i++) {
    const position =
      ROSTER_TEMPLATE[i % ROSTER_TEMPLATE.length] ?? "ATH";

    // Unique jersey 0–99 not already taken.
    let jersey = Math.floor(rand() * 100);
    let guard = 0;
    while (used.has(jersey) && guard < 200) {
      jersey = (jersey + 1) % 100;
      guard++;
    }
    used.add(jersey);

    // Unique name within the batch.
    let name = `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`;
    let nameGuard = 0;
    while (usedNames.has(name) && nameGuard < 200) {
      name = `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`;
      nameGuard++;
    }
    usedNames.add(name);

    const grade = 9 + Math.floor(rand() * 4); // 9–12
    // Upperclassmen lean varsity; underclassmen lean JV — just a believable mix.
    const squad = grade >= 11 ? "Varsity" : rand() < 0.5 ? "Varsity" : "JV";

    // Age-appropriate DOB: ~14 at grade 9 → ~17 at grade 12 (+0/1 year jitter).
    const age = 14 + (grade - 9) + Math.floor(rand() * 2);
    const birthYear = SEASON_YEAR - age;
    const birthMonth = 1 + Math.floor(rand() * 12);
    const birthDay = 1 + Math.floor(rand() * 28);
    const dateOfBirth = `${birthYear}-${pad2(birthMonth)}-${pad2(birthDay)}`;

    const hometown = HOMETOWNS[Math.floor(rand() * HOMETOWNS.length)] ?? HOMETOWNS[0];

    players.push({
      name,
      position,
      jerseyNumber: jersey,
      grade,
      squad,
      status: "Active",
      dateOfBirth,
      hometown,
    });
  }

  return players;
}
