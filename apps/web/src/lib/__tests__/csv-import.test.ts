import { describe, it, expect } from "vitest";
import { LeagueImportSchema } from "@sports-management/api-contracts";
import { parseCsv, csvToLeagueImport } from "../csv-import";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas and doubled quotes", () => {
    const rows = parseCsv('name,note\n"Smith, Jr.","He said ""hi"""');
    expect(rows[1]).toEqual(["Smith, Jr.", 'He said "hi"']);
  });

  it("handles embedded newlines inside quotes and CRLF endings", () => {
    const rows = parseCsv('a,b\r\n"line1\nline2",x\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b")[0]).toEqual(["a", "b"]);
  });
});

const HEADER =
  "league,division,team,city,stadium,teamLogoUrl,playerName,position,jerseyNumber,dateOfBirth,status,headshotUrl,experienceYears";

describe("csvToLeagueImport", () => {
  it("normalizes a flat CSV into a valid LeagueImportPayload", () => {
    const csv = [
      HEADER,
      "Metro,East,Hawks,Austin,Nest Field,,Pat Lee,QB,12,2000-01-01,Active,,3",
      "Metro,East,Hawks,Austin,Nest Field,,Sam Roe,RB,28,,,,",
      "Metro,West,Bears,Dallas,Den Stadium,,Jo Fox,WR,80,,Injured,,1",
    ].join("\n");

    const { payload, rowErrors } = csvToLeagueImport(csv);
    expect(rowErrors).toEqual([]);

    const parsed = LeagueImportSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.league.name).toBe("Metro");
    expect(parsed.data.divisions).toHaveLength(2);

    const east = parsed.data.divisions.find((d) => d.name === "East")!;
    expect(east.teams).toHaveLength(1);
    expect(east.teams[0].name).toBe("Hawks");
    expect(east.teams[0].players).toHaveLength(2);
    expect(east.teams[0].players[0]).toMatchObject({
      name: "Pat Lee",
      position: "QB",
      jerseyNumber: 12,
      experienceYears: 3,
    });
  });

  it("groups multiple teams under the same division and dedupes by team", () => {
    const csv = [
      HEADER,
      "Metro,East,Hawks,Austin,Nest,,A,QB,1,,,,",
      "Metro,East,Owls,Houston,Roost,,B,QB,2,,,,",
      "Metro,East,Hawks,Austin,Nest,,C,RB,3,,,,",
    ].join("\n");
    const { payload } = csvToLeagueImport(csv);
    const parsed = LeagueImportSchema.parse(payload);
    const east = parsed.divisions[0];
    expect(east.teams.map((t) => t.name)).toEqual(["Hawks", "Owls"]);
    expect(east.teams[0].players).toHaveLength(2);
  });

  it("supports a team-only row (no player)", () => {
    const csv = [HEADER, "Metro,East,Hawks,Austin,Nest,,,,,,,,"].join("\n");
    const { payload, rowErrors } = csvToLeagueImport(csv);
    expect(rowErrors).toEqual([]);
    const parsed = LeagueImportSchema.parse(payload);
    expect(parsed.divisions[0].teams[0].players).toEqual([]);
  });

  it("accepts header aliases and is case-insensitive", () => {
    const csv = [
      "League,Division,TeamName,City,Stadium,Player,Position,Jersey",
      "Metro,East,Hawks,Austin,Nest,Pat Lee,QB,7",
    ].join("\n");
    const { payload, rowErrors } = csvToLeagueImport(csv);
    expect(rowErrors).toEqual([]);
    const parsed = LeagueImportSchema.parse(payload);
    expect(parsed.divisions[0].teams[0].players[0]).toMatchObject({
      name: "Pat Lee",
      jerseyNumber: 7,
    });
  });

  it("reports missing required columns", () => {
    const { payload, rowErrors } = csvToLeagueImport("league,team\nMetro,Hawks");
    expect(payload).toBeNull();
    expect(rowErrors.join(" ")).toContain("division");
  });

  it("flags rows with a mismatched league name", () => {
    const csv = [
      HEADER,
      "Metro,East,Hawks,Austin,Nest,,A,QB,1,,,,",
      "Other,East,Owls,Houston,Roost,,B,QB,2,,,,",
    ].join("\n");
    const { rowErrors } = csvToLeagueImport(csv);
    expect(rowErrors.join(" ")).toContain("single league");
  });

  it("flags a non-numeric jersey number and a player missing a position", () => {
    const csv = [
      HEADER,
      "Metro,East,Hawks,Austin,Nest,,A,QB,oops,,,,",
      "Metro,East,Hawks,Austin,Nest,,B,,9,,,,",
    ].join("\n");
    const { rowErrors } = csvToLeagueImport(csv);
    const joined = rowErrors.join(" ");
    expect(joined).toContain("jerseyNumber");
    expect(joined).toContain("position");
  });

  it("reports an empty file", () => {
    const { payload, rowErrors } = csvToLeagueImport("");
    expect(payload).toBeNull();
    expect(rowErrors.join(" ")).toContain("empty");
  });
});
