import { z } from "zod";
import type {
  ApiResponse,
  LeagueDto,
  DivisionDto,
  TeamDto,
  PlayerDto,
  SeasonDto,
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
