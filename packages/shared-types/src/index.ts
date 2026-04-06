export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  errorCode: string | null;
}

export interface LeagueDto {
  id: string;
  name: string;
}

export interface DivisionDto {
  id: string;
  name: string;
  leagueId: string;
}

export interface TeamDto {
  id: string;
  name: string;
  leagueId: string;
  city: string;
  stadium: string;
  foundedYear: number | null;
  location: string;
  divisionId: string;
}

export interface PlayerDto {
  id: string;
  name: string;
  teamId: string;
  position: string;
  jerseyNumber: number | null;
  dateOfBirth: string | null;
  status: string;
}

export interface SeasonDto {
  id: string;
  name: string;
  leagueId: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

// --- Mutation input types ---

export interface CreatePlayerInput {
  name: string;
  teamId: string;
  position: string;
  jerseyNumber?: number | null;
  dateOfBirth?: string | null;
  status: string;
}

export interface UpdatePlayerInput {
  name?: string;
  teamId?: string;
  position?: string;
  jerseyNumber?: number | null;
  dateOfBirth?: string | null;
  status?: string;
}

export interface UpdateTeamInput {
  name?: string;
  city?: string;
  stadium?: string;
  foundedYear?: number | null;
  location?: string;
  divisionId?: string;
}

// --- Subscription tier types ---

export type Tier = "free" | "plus" | "club" | "league";

export type BillingStatus = "active" | "past_due" | "canceled";

export interface UserSubscription {
  tier: Tier;
  billingStatus: BillingStatus;
  stripeCustomerId?: string;
  currentPeriodEnd?: string;
}
