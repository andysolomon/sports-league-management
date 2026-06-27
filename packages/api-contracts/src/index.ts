import { z } from "zod";
import type {
  ApiResponse,
  LeagueDto,
  ConferenceDto,
  DivisionDto,
  TeamDto,
  PlayerDto,
  SeasonDto,
  RosterAssignmentDto,
  RosterAuditLogDto,
  CreateLeagueInput,
  CreateDivisionInput,
  CreateTeamInput,
  CreatePlayerInput,
  UpdatePlayerInput,
  UpdateTeamInput,
  Squad,
} from "@sports-management/shared-types";

/** Allowed HS squad values — single source for schemas and UI pick-lists. */
export const SQUADS = ["Varsity", "JV", "Freshman"] as const satisfies readonly Squad[];

// --- Entity schemas ---

export const LeagueDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  orgId: z.string().nullable(),
}) satisfies z.ZodType<LeagueDto>;

export const ConferenceDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  leagueId: z.string(),
}) satisfies z.ZodType<ConferenceDto>;

export const DivisionDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  leagueId: z.string(),
  conferenceId: z.string().nullable(),
}) satisfies z.ZodType<DivisionDto>;

export const TeamDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  leagueId: z.string(),
  city: z.string(),
  stadium: z.string(),
  foundedYear: z.number().nullable(),
  location: z.string(),
  divisionId: z.string(),
  logoUrl: z.string().nullable(),
  rosterLimit: z.number().nullable(),
  teamName: z.string().nullable(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
  allowDuplicateJerseys: z.boolean(),
  maxprepsSupplierId: z.string().nullable(),
}) satisfies z.ZodType<TeamDto>;

export const PlayerDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string(),
  position: z.string(),
  positionGroup: z.string().nullable(),
  jerseyNumber: z.number().nullable(),
  dateOfBirth: z.string().nullable(),
  status: z.string(),
  headshotUrl: z.string().nullable(),
  experienceYears: z.number().nullable(),
  grade: z.number().nullable(),
  squad: z.string().nullable(),
  hometown: z.string().nullable(),
}) satisfies z.ZodType<PlayerDto>;

export const RosterAssignmentDtoSchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  teamId: z.string(),
  playerId: z.string(),
  leagueId: z.string(),
  depthRank: z.number(),
  positionSlot: z.string(),
  status: z.string(),
  assignedAt: z.string(),
  assignedBy: z.string(),
}) satisfies z.ZodType<RosterAssignmentDto>;

export const RosterAuditActionSchema = z.enum([
  "assign",
  "remove",
  "status_change",
  "depth_reorder",
]);

export const RosterAuditLogDtoSchema = z.object({
  id: z.string(),
  leagueId: z.string(),
  teamId: z.string(),
  seasonId: z.string(),
  actorUserId: z.string(),
  action: RosterAuditActionSchema,
  beforeJson: z.string().nullable(),
  afterJson: z.string().nullable(),
  createdAt: z.string(),
}) satisfies z.ZodType<RosterAuditLogDto>;

export const SeasonDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  leagueId: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: z.string(),
  rosterLocked: z.boolean(),
}) satisfies z.ZodType<SeasonDto>;

// --- Mutation input schemas ---

export const CreateLeagueInputSchema = z.object({
  name: z.string().min(1),
}) satisfies z.ZodType<CreateLeagueInput>;

export const CreateDivisionInputSchema = z.object({
  name: z.string().min(1),
  leagueId: z.string().min(1),
}) satisfies z.ZodType<CreateDivisionInput>;

export const CreateTeamInputSchema = z.object({
  name: z.string().min(1),
  leagueId: z.string().min(1),
  city: z.string().min(1),
  stadium: z.string().min(1),
}) satisfies z.ZodType<CreateTeamInput>;

export const CreatePlayerInputSchema = z.object({
  name: z.string().min(1),
  teamId: z.string().min(1),
  position: z.string().min(1),
  jerseyNumber: z.number().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  status: z.string().min(1),
  grade: z.number().int().min(9).max(12).nullable().optional(),
  squad: z.enum(SQUADS).nullable().optional(),
  hometown: z.string().max(120).nullable().optional(),
}) satisfies z.ZodType<CreatePlayerInput>;

export const UpdatePlayerInputSchema = z.object({
  name: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  jerseyNumber: z.number().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  status: z.string().min(1).optional(),
  grade: z.number().int().min(9).max(12).nullable().optional(),
  squad: z.enum(SQUADS).nullable().optional(),
  hometown: z.string().max(120).nullable().optional(),
}) satisfies z.ZodType<UpdatePlayerInput>;

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1e3a8a");

export const UpdateTeamInputSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  stadium: z.string().min(1).optional(),
  foundedYear: z.number().nullable().optional(),
  location: z.string().min(1).optional(),
  divisionId: z.string().min(1).optional(),
  teamName: z.string().max(100).nullable().optional(),
  logoUrl: z.string().url("Enter a valid URL").nullable().optional(),
  primaryColor: hexColor.nullable().optional(),
  secondaryColor: hexColor.nullable().optional(),
  allowDuplicateJerseys: z.boolean().optional(),
  maxprepsSupplierId: z
    .string()
    .trim()
    .max(64, "Supplier ID looks too long")
    .nullable()
    .optional(),
}) satisfies z.ZodType<UpdateTeamInput>;

// --- Stat-keeping keystone (WSM-000112) — box-score stat line ---
// Each group is optional (a player only has the groups relevant to their
// snaps); within a group every field is an optional non-negative integer that
// defaults to 0 when aggregated. Validated at the edge before persisting.

const statCount = z.number().int().min(0);

export const PlayerGameStatLineSchema = z
  .object({
    passing: z
      .object({
        comp: statCount,
        att: statCount,
        yards: z.number().int(),
        td: statCount,
        int: statCount,
        sacked: statCount,
      })
      .partial()
      .optional(),
    rushing: z
      .object({
        carries: statCount,
        yards: z.number().int(),
        td: statCount,
        long: z.number().int(),
      })
      .partial()
      .optional(),
    receiving: z
      .object({
        rec: statCount,
        yards: z.number().int(),
        td: statCount,
        long: z.number().int(),
        targets: statCount,
      })
      .partial()
      .optional(),
    defense: z
      .object({
        tacklesSolo: statCount,
        tacklesAst: statCount,
        tfl: statCount,
        sacks: z.number().min(0),
        int: statCount,
        passDef: statCount,
        ff: statCount,
        fr: statCount,
        defTd: statCount,
      })
      .partial()
      .optional(),
    kicking: z
      .object({
        fgMade: statCount,
        fgAtt: statCount,
        xpMade: statCount,
        xpAtt: statCount,
      })
      .partial()
      .optional(),
    punting: z
      .object({ punts: statCount, yards: z.number().int(), long: z.number().int() })
      .partial()
      .optional(),
    returns: z
      .object({
        krCount: statCount,
        krYards: z.number().int(),
        krTd: statCount,
        prCount: statCount,
        prYards: z.number().int(),
        prTd: statCount,
      })
      .partial()
      .optional(),
    ballSecurity: z
      .object({ fumbles: statCount, fumblesLost: statCount })
      .partial()
      .optional(),
  })
  .strict();

export type PlayerGameStatLineInput = z.infer<typeof PlayerGameStatLineSchema>;

// --- Import schema ---

export {
  LeagueImportSchema,
  type LeagueImportPayload,
} from "./import-schema.js";

// --- API envelope factory ---

export function apiResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
): z.ZodType<ApiResponse<z.infer<T>>> {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    message: z.string().nullable(),
    errorCode: z.string().nullable(),
  }) as z.ZodType<ApiResponse<z.infer<T>>>;
}
