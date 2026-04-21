import { z } from "zod";
import type {
  ApiResponse,
  LeagueDto,
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
} from "@sports-management/shared-types";

// --- Entity schemas ---

export const LeagueDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  orgId: z.string().nullable(),
}) satisfies z.ZodType<LeagueDto>;

export const DivisionDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  leagueId: z.string(),
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
}) satisfies z.ZodType<CreatePlayerInput>;

export const UpdatePlayerInputSchema = z.object({
  name: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
  jerseyNumber: z.number().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  status: z.string().min(1).optional(),
}) satisfies z.ZodType<UpdatePlayerInput>;

export const UpdateTeamInputSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  stadium: z.string().min(1).optional(),
  foundedYear: z.number().nullable().optional(),
  location: z.string().min(1).optional(),
  divisionId: z.string().min(1).optional(),
}) satisfies z.ZodType<UpdateTeamInput>;

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
