import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "./_components/copy-button";

interface FieldRow {
  field: string;
  type: string;
  required: boolean;
  notes: string;
}

const LEAGUE_FIELDS: FieldRow[] = [
  { field: "league.name", type: "string", required: true, notes: "League name. A single import targets one league." },
];

const DIVISION_FIELDS: FieldRow[] = [
  { field: "divisions[].name", type: "string", required: true, notes: "Division name. At least one division is required." },
  { field: "divisions[].teams", type: "array", required: true, notes: "Each division must contain at least one team." },
];

const TEAM_FIELDS: FieldRow[] = [
  { field: "name", type: "string", required: true, notes: "Team / school name. Used to match existing teams." },
  { field: "city", type: "string", required: true, notes: "City." },
  { field: "stadium", type: "string", required: true, notes: "Home venue." },
  { field: "logoUrl", type: "string (url)", required: false, notes: "Absolute URL; omit or leave blank if none." },
  { field: "players", type: "array", required: false, notes: "May be empty — a team can be imported with no roster." },
];

const PLAYER_FIELDS: FieldRow[] = [
  { field: "name", type: "string", required: true, notes: "Player full name." },
  { field: "position", type: "string", required: true, notes: "e.g. QB, RB, WR." },
  { field: "jerseyNumber", type: "integer", required: false, notes: "Whole number; blank to omit." },
  { field: "dateOfBirth", type: "string", required: false, notes: "ISO date, e.g. 2003-09-01." },
  { field: "status", type: "string", required: false, notes: 'Defaults to "Active".' },
  { field: "headshotUrl", type: "string (url)", required: false, notes: "Absolute URL." },
  { field: "experienceYears", type: "integer >= 0", required: false, notes: "Years of experience." },
  { field: "grade", type: "integer 9–12", required: false, notes: "HS grade level." },
  { field: "squad", type: "string", required: false, notes: '"Varsity", "JV", or "Freshman".' },
];

const CSV_COLUMNS: FieldRow[] = [
  { field: "league", type: "string", required: true, notes: "Same value on every row." },
  { field: "division", type: "string", required: true, notes: "Groups teams into divisions." },
  { field: "team", type: "string", required: true, notes: 'Alias: "teamName". Rows with the same division + team are merged.' },
  { field: "city", type: "string", required: true, notes: "Team city." },
  { field: "stadium", type: "string", required: true, notes: "Team venue." },
  { field: "teamLogoUrl", type: "string (url)", required: false, notes: 'Alias: "logoUrl". First non-empty value per team wins.' },
  { field: "playerName", type: "string", required: false, notes: 'Alias: "player". Leave blank for a team-only row.' },
  { field: "position", type: "string", required: false, notes: "Required when playerName is set." },
  { field: "jerseyNumber", type: "integer", required: false, notes: 'Alias: "jersey".' },
  { field: "dateOfBirth", type: "string", required: false, notes: 'Alias: "dob". ISO date.' },
  { field: "status", type: "string", required: false, notes: 'Defaults to "Active".' },
  { field: "headshotUrl", type: "string (url)", required: false, notes: "Absolute URL." },
  { field: "experienceYears", type: "integer >= 0", required: false, notes: 'Alias: "experience".' },
  { field: "grade", type: "integer 9–12", required: false, notes: "HS grade level." },
  { field: "squad", type: "string", required: false, notes: '"Varsity", "JV", or "Freshman".' },
];

const JSON_EXAMPLE = `{
  "league": { "name": "Metro Youth Football" },
  "divisions": [
    {
      "name": "East",
      "teams": [
        {
          "name": "Riverside Hawks",
          "city": "Austin",
          "stadium": "Nest Field",
          "logoUrl": "https://example.com/hawks.png",
          "players": [
            { "name": "Pat Lee", "position": "QB", "jerseyNumber": 12, "experienceYears": 3, "grade": 12, "squad": "Varsity" },
            { "name": "Sam Roe", "position": "RB", "jerseyNumber": 28, "status": "Active" }
          ]
        }
      ]
    }
  ]
}`;

const CSV_EXAMPLE = `league,division,team,city,stadium,teamLogoUrl,playerName,position,jerseyNumber,dateOfBirth,status,headshotUrl,experienceYears,grade,squad
Metro Youth Football,East,Riverside Hawks,Austin,Nest Field,https://example.com/hawks.png,Pat Lee,QB,12,2003-09-01,Active,,3,12,Varsity
Metro Youth Football,East,Riverside Hawks,Austin,Nest Field,,Sam Roe,RB,28,,Active,,1,11,JV
Metro Youth Football,West,Dallas Bears,Dallas,Den Stadium,,Jo Fox,WR,80,,Active,,2,12,Varsity`;

const GENERATOR_PROMPT = `You are converting a roster into a league-import file for a sports management app.

Output a SINGLE CSV file (no prose, no code fences) with EXACTLY this header row:

league,division,team,city,stadium,teamLogoUrl,playerName,position,jerseyNumber,dateOfBirth,status,headshotUrl,experienceYears,grade,squad

Rules:
- One row per player. Repeat league/division/team/city/stadium on every row of that team.
- "league" must be identical on every row (one league per file).
- For a team with no players yet, emit one row with the team columns filled and the player columns blank.
- jerseyNumber and experienceYears must be whole numbers (or blank). experienceYears >= 0.
- grade is a whole number 9–12 or blank. squad is "Varsity", "JV", or "Freshman" (or blank).
- dateOfBirth in ISO format (YYYY-MM-DD) or blank. status defaults to "Active" if blank.
- logoUrl/headshotUrl must be absolute URLs or blank.
- Quote any field that contains a comma.

Here is my roster data:
<paste your roster, notes, or spreadsheet here>`;

function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Required</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.field}>
            <TableCell className="font-mono text-xs">{r.field}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{r.type}</TableCell>
            <TableCell className="text-xs">
              {r.required ? (
                <span className="font-medium text-foreground">Yes</span>
              ) : (
                <span className="text-muted-foreground">No</span>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{r.notes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/50 p-4 text-xs leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}

export default function ImportFormatPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/settings/account/import"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Import
        </Link>
        <h2 className="text-lg font-semibold text-foreground">Import format</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The Import page accepts JSON or CSV. Both describe the same league →
          division → team → player hierarchy; CSV is a flat, one-row-per-player
          shape that is normalized to the JSON payload on upload. Existing
          records are matched by name and updated.
        </p>
      </div>

      {/* CSV format */}
      <Card>
        <CardHeader>
          <CardTitle>CSV format</CardTitle>
          <CardDescription>
            A header row is required. Columns are matched case-insensitively;
            common aliases are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldTable rows={CSV_COLUMNS} />
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground">Example CSV</h4>
            <CopyButton value={CSV_EXAMPLE} label="Copy CSV" />
          </div>
          <CodeBlock code={CSV_EXAMPLE} />
        </CardContent>
      </Card>

      {/* JSON format */}
      <Card>
        <CardHeader>
          <CardTitle>JSON format</CardTitle>
          <CardDescription>
            A nested object with one league, its divisions, their teams, and
            each team&apos;s players.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">League</h4>
            <FieldTable rows={LEAGUE_FIELDS} />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Division</h4>
            <FieldTable rows={DIVISION_FIELDS} />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Team</h4>
            <FieldTable rows={TEAM_FIELDS} />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Player</h4>
            <FieldTable rows={PLAYER_FIELDS} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground">Example JSON</h4>
            <CopyButton value={JSON_EXAMPLE} label="Copy JSON" />
          </div>
          <CodeBlock code={JSON_EXAMPLE} />
        </CardContent>
      </Card>

      {/* Generator prompt */}
      <Card>
        <CardHeader>
          <CardTitle>Generate an import with AI</CardTitle>
          <CardDescription>
            Paste this prompt into any LLM, append your roster (a spreadsheet
            dump, notes, anything), and it returns a valid CSV you can upload
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-end">
            <CopyButton value={GENERATOR_PROMPT} label="Copy prompt" />
          </div>
          <CodeBlock code={GENERATOR_PROMPT} />
        </CardContent>
      </Card>
    </div>
  );
}
