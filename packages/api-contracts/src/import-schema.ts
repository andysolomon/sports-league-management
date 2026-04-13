import { z } from "zod";

const PlayerImportSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  jerseyNumber: z.number().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  status: z.string().min(1).optional().default("Active"),
  headshotUrl: z.string().url().nullable().optional(),
});

const TeamImportSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  stadium: z.string().min(1),
  logoUrl: z.string().url().nullable().optional(),
  players: z.array(PlayerImportSchema).optional().default([]),
});

const DivisionImportSchema = z.object({
  name: z.string().min(1),
  teams: z.array(TeamImportSchema).min(1, "Each division must have at least one team"),
});

export const LeagueImportSchema = z.object({
  league: z.object({
    name: z.string().min(1),
  }),
  divisions: z
    .array(DivisionImportSchema)
    .min(1, "At least one division is required"),
});

export type LeagueImportPayload = z.infer<typeof LeagueImportSchema>;
