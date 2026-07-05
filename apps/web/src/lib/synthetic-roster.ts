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

function clampGrade(grade: number): number {
  return Math.max(9, Math.min(12, Math.round(grade)));
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
  "Aaliyah", "Aaron", "Abigail", "Adrian", "Aiden", "Aisha", "Alejandro", "Alex",
  "Alexis", "Ali", "Amara", "Amari", "Amir", "Ananya", "Andre", "Andrea",
  "Andrew", "Angela", "Anthony", "Aria", "Ariana", "Arjun", "Ashley", "Ava",
  "Benjamin", "Bianca", "Blake", "Brandon", "Brayden", "Brianna", "Bryce", "Caleb",
  "Cameron", "Carlos", "Carmen", "Carter", "Catherine", "Cesar", "Chloe", "Christian",
  "Christopher", "Claire", "Cole", "Connor", "Daniel", "Daniela", "Darius", "David",
  "Destiny", "Devin", "Diego", "Dominic", "Dylan", "Elena", "Elijah", "Elizabeth",
  "Emily", "Emma", "Enrique", "Ethan", "Eva", "Evan", "Fatima", "Gabriel",
  "Gavin", "Genesis", "George", "Grace", "Grayson", "Hannah", "Harper", "Hassan",
  "Hector", "Henry", "Hunter", "Ian", "Imani", "Isaac", "Isabella", "Isaiah",
  "Ivan", "Jack", "Jackson", "Jacob", "Jaden", "Jake", "Jamal", "James",
  "Jamie", "Jasmine", "Jason", "Javier", "Jayden", "Jenna", "Jeremiah", "Jessica",
  "Jin", "Joel", "John", "Jose", "Joseph", "Joshua", "Juan", "Julia",
  "Julian", "Justin", "Kai", "Kaitlyn", "Kaleb", "Karen", "Karla", "Katherine",
  "Kayla", "Keisha", "Kenneth", "Kevin", "Khalil", "Kim", "Kyle", "Laila",
  "Landon", "Laura", "Lauren", "Leah", "Leo", "Liam", "Lily", "Logan",
  "Lucas", "Luis", "Luke", "Madison", "Malik", "Manuel", "Marco", "Maria",
  "Mason", "Mateo", "Matthew", "Maya", "Megan", "Mia", "Michael", "Micah",
  "Miguel", "Miles", "Morgan", "Nadia", "Nathan", "Nia", "Nicholas", "Nicole",
  "Noah", "Nolan", "Oliver", "Olivia", "Omar", "Owen", "Pablo", "Paige",
  "Patrick", "Paul", "Priya", "Quentin", "Rachel", "Rafael", "Raymond", "Rebecca",
  "Riley", "Robert", "Roman", "Ryan", "Samantha", "Samuel", "Santiago", "Sarah",
  "Savannah", "Sean", "Sebastian", "Serena", "Sergio", "Sofia", "Sophia", "Steven",
  "Tariq", "Taylor", "Terrence", "Thomas", "Tiana", "Timothy", "Travis", "Trevor",
  "Trinity", "Tyler", "Valeria", "Vanessa", "Victor", "Vincent", "Violet", "William",
  "Xavier", "Yasmin", "Yosef", "Zachary", "Zoe", "Zion",
];

const LAST_NAMES: readonly string[] = [
  "Abbott", "Abrams", "Acosta", "Adams", "Aguilar", "Ahmed", "Alexander", "Ali",
  "Allen", "Alvarez", "Anderson", "Andrews", "Archer", "Arias", "Armstrong", "Arnold",
  "Ashley", "Atkins", "Austin", "Avery", "Bailey", "Baker", "Baldwin", "Banks",
  "Barber", "Barker", "Barnes", "Barrett", "Barton", "Bates", "Beck", "Becker",
  "Bell", "Bennett", "Benson", "Berg", "Berry", "Bishop", "Black", "Blair",
  "Blake", "Boone", "Bowen", "Boyd", "Bradley", "Brady", "Branch", "Brennan",
  "Briggs", "Brock", "Brooks", "Brown", "Bryant", "Buchanan", "Burke", "Burns",
  "Butler", "Byrd", "Cabrera", "Cain", "Calderon", "Caldwell", "Campos", "Cannon",
  "Carlson", "Carpenter", "Carr", "Carroll", "Carson", "Carter", "Castillo", "Castro",
  "Chambers", "Chan", "Chang", "Chapman", "Chen", "Choi", "Clark", "Clarke",
  "Clayton", "Cobb", "Cohen", "Cole", "Coleman", "Collins", "Conner", "Cook",
  "Cooper", "Cortez", "Cox", "Craig", "Crawford", "Cross", "Cruz", "Cummings",
  "Cunningham", "Curtis", "Daniel", "Daniels", "Davenport", "Davidson", "Davis", "Dawson",
  "Day", "Dean", "Delgado", "Diaz", "Dixon", "Douglas", "Doyle", "Drake",
  "Duncan", "Dunn", "Edwards", "Elliott", "Ellis", "Erickson", "Espinoza", "Evans",
  "Farmer", "Ferguson", "Fernandez", "Fields", "Fisher", "Fleming", "Fletcher", "Flores",
  "Ford", "Foster", "Fowler", "Fox", "Francis", "Franklin", "Freeman", "Fuller",
  "Garcia", "Gardner", "Garner", "Garrett", "Garrison", "George", "Gibson", "Gilbert",
  "Gill", "Gomez", "Gonzalez", "Goodwin", "Gordon", "Graham", "Grant", "Graves",
  "Gray", "Green", "Greene", "Greer", "Griffin", "Gross", "Guerrero", "Gutierrez",
  "Hall", "Hamilton", "Hammond", "Hampton", "Hansen", "Hanson", "Hardy", "Harmon",
  "Harper", "Harris", "Harrison", "Hart", "Harvey", "Hawkins", "Hayes", "Heath",
  "Henderson", "Henry", "Hernandez", "Herrera", "Hicks", "Hill", "Hines", "Hodges",
  "Hoffman", "Holland", "Holmes", "Holt", "Hopkins", "Howard", "Howell", "Huang",
  "Hudson", "Hughes", "Hunt", "Hunter", "Ingram", "Irwin", "Jackson", "Jacobs",
  "James", "Jarvis", "Jenkins", "Jennings", "Jensen", "Jimenez", "Johnson", "Johnston",
  "Jones", "Jordan", "Joseph", "Joyce", "Keller", "Kelley", "Kelly", "Kennedy",
  "Kim", "King", "Kirk", "Klein", "Knight", "Koch", "Kramer", "Lamb",
  "Lambert", "Lane", "Larson", "Lawrence", "Lawson", "Lee", "Leon", "Lewis",
  "Lindsay", "Little", "Liu", "Lloyd", "Logan", "Long", "Lopez", "Lowe",
  "Lucas", "Luna", "Lynch", "Lyons", "Mack", "Maddox", "Maldonado", "Malone",
  "Mann", "Manning", "Marks", "Marsh", "Marshall", "Martin", "Martinez", "Mason",
  "Matthews", "Maxwell", "May", "McBride", "McCarthy", "McCoy", "McDonald", "McGee",
  "Medina", "Mejia", "Mendez", "Mendoza", "Mercer", "Meyer", "Miles", "Miller",
  "Mills", "Mitchell", "Montgomery", "Moore", "Morales", "Moran", "Moreno", "Morgan",
  "Morris", "Morrison", "Morton", "Moss", "Mueller", "Mullins", "Murphy", "Murray",
  "Myers", "Nash", "Navarro", "Neal", "Nelson", "Newman", "Nguyen", "Nichols",
  "Nixon", "Norman", "Norris", "Norton", "Nunez", "Obrien", "Ochoa", "Oliver",
  "Olson", "Ortega", "Ortiz", "Osborne", "Owen", "Owens", "Padilla", "Page",
  "Palmer", "Park", "Parker", "Parks", "Parsons", "Patel", "Patrick", "Patterson",
  "Patton", "Paul", "Payne", "Pearson", "Peck", "Pena", "Perez", "Perkins",
  "Perry", "Peters", "Peterson", "Pham", "Phelps", "Phillips", "Pierce", "Pittman",
  "Porter", "Potter", "Powell", "Pratt", "Price", "Quinn", "Ramirez", "Ramos",
  "Randall", "Ray", "Reed", "Reese", "Reeves", "Reid", "Reyes", "Reynolds",
  "Rhodes", "Rice", "Richards", "Richardson", "Riley", "Rios", "Rivera", "Robbins",
  "Roberts", "Robertson", "Robinson", "Rodgers", "Rodriguez", "Rogers", "Romero", "Rose",
  "Ross", "Rowe", "Ruiz", "Russell", "Ryan", "Salazar", "Sanchez", "Sanders",
  "Santiago", "Santos", "Saunders", "Schmidt", "Schneider", "Schultz", "Scott", "Shaw",
  "Shelton", "Shepherd", "Sherman", "Silva", "Simmons", "Simon", "Simpson", "Sims",
  "Singh", "Smith", "Snyder", "Soto", "Spencer", "Stanley", "Steele", "Stein",
  "Stephens", "Stevens", "Stewart", "Stone", "Strickland", "Sullivan", "Summers", "Sutton",
  "Swanson", "Sweeney", "Tanner", "Tate", "Taylor", "Terrell", "Thomas", "Thompson",
  "Thornton", "Todd", "Torres", "Townsend", "Tran", "Tucker", "Turner", "Tyler",
  "Underwood", "Valdez", "Valencia", "Vance", "Vargas", "Vasquez", "Vaughn", "Vega",
  "Velez", "Wade", "Wagner", "Walker", "Wallace", "Waller", "Walsh", "Walter",
  "Walters", "Ward", "Warner", "Warren", "Washington", "Waters", "Watkins", "Watson",
  "Watts", "Weaver", "Webb", "Weber", "Webster", "Wells", "West", "Wheeler",
  "Whitaker", "White", "Whitfield", "Wiggins", "Wilcox", "Wiley", "Wilkerson", "Wilkins",
  "Williams", "Williamson", "Willis", "Wilson", "Winters", "Wise", "Wolfe", "Wong",
  "Wood", "Woods", "Woodward", "Wright", "Wyatt", "Yang", "Yates", "Young",
  "Zamora", "Zhang", "Zimmerman",
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
  /** Player names already used in the league — avoided when possible. */
  excludeNames?: string[];
  /** Seed for deterministic output (e.g. seedFromString(teamId)). */
  seed?: number;
  /** When set, every generated player uses this HS grade (9–12). */
  grade?: number;
}

function pickUniqueName(
  rand: () => number,
  usedNames: Set<string>,
): string {
  const maxAttempts = FIRST_NAMES.length * LAST_NAMES.length;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const first =
      FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)] ?? FIRST_NAMES[0];
    const last =
      LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)] ?? LAST_NAMES[0];
    const name = `${first} ${last}`;
    if (!usedNames.has(name)) return name;
  }
  // Pool exhausted — allow a duplicate as last resort.
  const first =
    FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)] ?? FIRST_NAMES[0];
  const last =
    LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)] ?? LAST_NAMES[0];
  return `${first} ${last}`;
}

export function generateSyntheticRoster({
  count,
  excludeJerseys = [],
  excludeNames = [],
  seed = 1,
  grade: fixedGrade,
}: GenerateOptions): SyntheticPlayer[] {
  const n = Math.max(0, Math.min(count, 99)); // cap at a sane jersey-bound size
  const rand = rng(seed);
  const used = new Set<number>(excludeJerseys);
  const usedNames = new Set<string>(excludeNames);
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

    const name = pickUniqueName(rand, usedNames);
    usedNames.add(name);

    const grade =
      fixedGrade !== undefined
        ? clampGrade(fixedGrade)
        : 9 + Math.floor(rand() * 4); // 9–12
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
