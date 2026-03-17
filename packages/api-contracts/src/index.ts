import { z } from "zod";
import type {
  ApiResponse,
  LeagueDto,
  DivisionDto,
  TeamDto,
  PlayerDto,
  SeasonDto,
  CreatePlayerInput,
  UpdatePlayerInput,
  UpdateTeamInput,
} from "@sports-management/shared-types";

// --- Entity schemas ---

export const LeagueDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
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
}) satisfies z.ZodType<TeamDto>;

export const PlayerDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  teamId: z.string(),
  position: z.string(),
  jerseyNumber: z.number().nullable(),
  dateOfBirth: z.string().nullable(),
  status: z.string(),
}) satisfies z.ZodType<PlayerDto>;

export const SeasonDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  leagueId: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: z.string(),
}) satisfies z.ZodType<SeasonDto>;

// --- Mutation input schemas ---

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
