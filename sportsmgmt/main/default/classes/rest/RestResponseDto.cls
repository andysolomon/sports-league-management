/**
 * @description Standard REST API response envelope with DTO inner classes
 * @author Sports Management Team
 * @date 2024
 */
public with sharing class RestResponseDto {
    public Boolean success;
    public Object data;
    public String message;
    public String errorCode;

    public static RestResponseDto success(Object data) {
        RestResponseDto response = new RestResponseDto();
        response.success = true;
        response.data = data;
        return response;
    }

    public static RestResponseDto error(String message, String errorCode) {
        RestResponseDto response = new RestResponseDto();
        response.success = false;
        response.message = message;
        response.errorCode = errorCode;
        return response;
    }

    // ── League DTO factory methods ──

    public static LeagueDto createLeagueDto(ILeague league) {
        LeagueDto dto = new LeagueDto();
        dto.id = league.getId();
        dto.name = league.getName();
        return dto;
    }

    public static List<LeagueDto> createLeagueDtoList(List<ILeague> leagues) {
        List<LeagueDto> dtos = new List<LeagueDto>();
        for (ILeague league : leagues) {
            dtos.add(createLeagueDto(league));
        }
        return dtos;
    }

    // ── Division DTO factory methods ──

    public static DivisionDto createDivisionDto(IDivision division) {
        DivisionDto dto = new DivisionDto();
        dto.id = division.getId();
        dto.name = division.getName();
        dto.leagueId = division.getLeagueId();
        return dto;
    }

    public static List<DivisionDto> createDivisionDtoList(List<IDivision> divisions) {
        List<DivisionDto> dtos = new List<DivisionDto>();
        for (IDivision division : divisions) {
            dtos.add(createDivisionDto(division));
        }
        return dtos;
    }

    // ── Team DTO factory methods ──

    public static TeamDto createTeamDto(Team__c team) {
        TeamDto dto = new TeamDto();
        dto.id = team.Id;
        dto.name = team.Name;
        dto.leagueId = team.League__c;
        dto.city = team.City__c;
        dto.stadium = team.Stadium__c;
        dto.foundedYear = team.Founded_Year__c;
        dto.location = team.Location__c;
        dto.divisionId = team.Division__c;
        return dto;
    }

    public static List<TeamDto> createTeamDtoList(List<Team__c> teams) {
        List<TeamDto> dtos = new List<TeamDto>();
        for (Team__c team : teams) {
            dtos.add(createTeamDto(team));
        }
        return dtos;
    }

    // ── Player DTO factory methods ──

    public static PlayerDto createPlayerDto(IPlayer player) {
        PlayerDto dto = new PlayerDto();
        dto.id = player.getId();
        dto.name = player.getName();
        dto.teamId = player.getTeamId();
        dto.position = player.getPosition();
        dto.jerseyNumber = player.getJerseyNumber();
        dto.dateOfBirth = player.getDateOfBirth() != null
            ? String.valueOf(player.getDateOfBirth())
            : null;
        dto.status = player.getStatus();
        return dto;
    }

    public static List<PlayerDto> createPlayerDtoList(List<IPlayer> players) {
        List<PlayerDto> dtos = new List<PlayerDto>();
        for (IPlayer player : players) {
            dtos.add(createPlayerDto(player));
        }
        return dtos;
    }

    // ── Season DTO factory methods ──

    public static SeasonDto createSeasonDto(ISeason season) {
        SeasonDto dto = new SeasonDto();
        dto.id = season.getId();
        dto.name = season.getName();
        dto.leagueId = season.getLeagueId();
        dto.startDate = season.getStartDate() != null
            ? String.valueOf(season.getStartDate())
            : null;
        dto.endDate = season.getEndDate() != null
            ? String.valueOf(season.getEndDate())
            : null;
        dto.status = season.getStatus();
        return dto;
    }

    public static List<SeasonDto> createSeasonDtoList(List<ISeason> seasons) {
        List<SeasonDto> dtos = new List<SeasonDto>();
        for (ISeason season : seasons) {
            dtos.add(createSeasonDto(season));
        }
        return dtos;
    }

    // ── Inner DTO classes ──

    public class LeagueDto {
        public String id;
        public String name;
    }

    public class DivisionDto {
        public String id;
        public String name;
        public String leagueId;
    }

    public class TeamDto {
        public String id;
        public String name;
        public String leagueId;
        public String city;
        public String stadium;
        public Decimal foundedYear;
        public String location;
        public String divisionId;
    }

    public class PlayerDto {
        public String id;
        public String name;
        public String teamId;
        public String position;
        public Decimal jerseyNumber;
        public String dateOfBirth;
        public String status;
    }

    public class SeasonDto {
        public String id;
        public String name;
        public String leagueId;
        public String startDate;
        public String endDate;
        public String status;
    }
}