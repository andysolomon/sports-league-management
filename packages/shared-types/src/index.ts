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
