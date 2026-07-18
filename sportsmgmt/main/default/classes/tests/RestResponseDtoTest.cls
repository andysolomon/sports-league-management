/**
 * @description Test class for RestResponseDto and all DTO inner classes
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class RestResponseDtoTest {

    @IsTest
    static void testSuccessFactory() {
        // When
        RestResponseDto response = RestResponseDto.success('test data');

        // Then
        Assert.isTrue(response.success, 'Should be success');
        Assert.areEqual('test data', response.data, 'Should contain data');
        Assert.isNull(response.message, 'Should have no message');
        Assert.isNull(response.errorCode, 'Should have no error code');
    }

    @IsTest
    static void testErrorFactory() {
        // When
        RestResponseDto response = RestResponseDto.error('Something went wrong', 'INTERNAL_ERROR');

        // Then
        Assert.isFalse(response.success, 'Should not be success');
        Assert.isNull(response.data, 'Should have no data');
        Assert.areEqual('Something went wrong', response.message, 'Should contain message');
        Assert.areEqual('INTERNAL_ERROR', response.errorCode, 'Should contain error code');
    }

    @IsTest
    static void testLeagueDto() {
        // Given
        ILeague league = new LeagueWrapper('a01000000000001AAA', 'Test League');

        // When
        RestResponseDto.LeagueDto dto = RestResponseDto.createLeagueDto(league);

        // Then
        Assert.areEqual('a01000000000001AAA', dto.id, 'Should have correct ID');
        Assert.areEqual('Test League', dto.name, 'Should have correct name');
    }

    @IsTest
    static void testLeagueDtoList() {
        // Given
        List<ILeague> leagues = new List<ILeague>{
            new LeagueWrapper('a01000000000001AAA', 'League A'),
            new LeagueWrapper('a01000000000002AAA', 'League B')
        };

        // When
        List<RestResponseDto.LeagueDto> dtos = RestResponseDto.createLeagueDtoList(leagues);

        // Then
        Assert.areEqual(2, dtos.size(), 'Should return 2 DTOs');
        Assert.areEqual('League A', dtos[0].name, 'Should have correct name');
    }

    @IsTest
    static void testDivisionDto() {
        // Given
        IDivision division = new DivisionWrapper('a02000000000001AAA', 'East', 'a01000000000001AAA');

        // When
        RestResponseDto.DivisionDto dto = RestResponseDto.createDivisionDto(division);

        // Then
        Assert.areEqual('a02000000000001AAA', dto.id, 'Should have correct ID');
        Assert.areEqual('East', dto.name, 'Should have correct name');
        Assert.areEqual('a01000000000001AAA', dto.leagueId, 'Should have correct league ID');
    }

    @IsTest
    static void testDivisionDtoList() {
        // Given
        List<IDivision> divisions = new List<IDivision>{
            new DivisionWrapper('a02000000000001AAA', 'East', 'a01000000000001AAA'),
            new DivisionWrapper('a02000000000002AAA', 'West', 'a01000000000001AAA')
        };

        // When
        List<RestResponseDto.DivisionDto> dtos = RestResponseDto.createDivisionDtoList(divisions);

        // Then
        Assert.areEqual(2, dtos.size(), 'Should return 2 DTOs');
    }

    @IsTest
    static void testTeamDto() {
        // Given
        Team__c team = new Team__c(
            Name = 'Test Team',
            City__c = 'Test City',
            Stadium__c = 'Test Stadium',
            Founded_Year__c = 2020,
            Location__c = 'Test City, State'
        );

        // When
        RestResponseDto.TeamDto dto = RestResponseDto.createTeamDto(team);

        // Then
        Assert.areEqual('Test Team', dto.name, 'Should have correct name');
        Assert.areEqual('Test City', dto.city, 'Should have correct city');
        Assert.areEqual('Test Stadium', dto.stadium, 'Should have correct stadium');
        Assert.areEqual(2020, dto.foundedYear, 'Should have correct founded year');
        Assert.areEqual('Test City, State', dto.location, 'Should have correct location');
    }

    @IsTest
    static void testTeamDtoList() {
        // Given
        List<Team__c> teams = new List<Team__c>{
            new Team__c(Name = 'Team A'),
            new Team__c(Name = 'Team B')
        };

        // When
        List<RestResponseDto.TeamDto> dtos = RestResponseDto.createTeamDtoList(teams);

        // Then
        Assert.areEqual(2, dtos.size(), 'Should return 2 DTOs');
    }

    @IsTest
    static void testPlayerDto() {
        // Given
        Player__c player = new Player__c(
            Name = 'John Doe',
            Position__c = 'Forward',
            Jersey_Number__c = 10,
            Date_of_Birth__c = Date.newInstance(1990, 5, 15),
            Status__c = 'Active'
        );
        IPlayer playerInterface = new PlayerWrapper(player);

        // When
        RestResponseDto.PlayerDto dto = RestResponseDto.createPlayerDto(playerInterface);

        // Then
        Assert.areEqual('John Doe', dto.name, 'Should have correct name');
        Assert.areEqual('Forward', dto.position, 'Should have correct position');
        Assert.areEqual(10, dto.jerseyNumber, 'Should have correct jersey number');
        Assert.areEqual('1990-05-15', dto.dateOfBirth, 'Should have ISO 8601 date');
        Assert.areEqual('Active', dto.status, 'Should have correct status');
    }

    @IsTest
    static void testPlayerDtoList() {
        // Given
        List<IPlayer> players = new List<IPlayer>{
            new PlayerWrapper(new Player__c(Name = 'Player A')),
            new PlayerWrapper(new Player__c(Name = 'Player B'))
        };

        // When
        List<RestResponseDto.PlayerDto> dtos = RestResponseDto.createPlayerDtoList(players);

        // Then
        Assert.areEqual(2, dtos.size(), 'Should return 2 DTOs');
    }

    @IsTest
    static void testPlayerDto_NullDateOfBirth() {
        // Given
        Player__c player = new Player__c(Name = 'No DOB Player');
        IPlayer playerInterface = new PlayerWrapper(player);

        // When
        RestResponseDto.PlayerDto dto = RestResponseDto.createPlayerDto(playerInterface);

        // Then
        Assert.isNull(dto.dateOfBirth, 'Should handle null date of birth');
    }

    @IsTest
    static void testSeasonDto() {
        // Given
        Season__c season = new Season__c(
            Name = '2024 Season',
            Start_Date__c = Date.newInstance(2024, 1, 1),
            End_Date__c = Date.newInstance(2024, 12, 31),
            Status__c = 'Active'
        );
        ISeason seasonInterface = new SeasonWrapper(season);

        // When
        RestResponseDto.SeasonDto dto = RestResponseDto.createSeasonDto(seasonInterface);

        // Then
        Assert.areEqual('2024 Season', dto.name, 'Should have correct name');
        Assert.areEqual('2024-01-01', dto.startDate, 'Should have ISO 8601 start date');
        Assert.areEqual('2024-12-31', dto.endDate, 'Should have ISO 8601 end date');
        Assert.areEqual('Active', dto.status, 'Should have correct status');
    }

    @IsTest
    static void testSeasonDtoList() {
        // Given
        List<ISeason> seasons = new List<ISeason>{
            new SeasonWrapper(new Season__c(Name = 'Season A')),
            new SeasonWrapper(new Season__c(Name = 'Season B'))
        };

        // When
        List<RestResponseDto.SeasonDto> dtos = RestResponseDto.createSeasonDtoList(seasons);

        // Then
        Assert.areEqual(2, dtos.size(), 'Should return 2 DTOs');
    }

    @IsTest
    static void testSeasonDto_NullDates() {
        // Given
        Season__c season = new Season__c(Name = 'No Dates Season');
        ISeason seasonInterface = new SeasonWrapper(season);

        // When
        RestResponseDto.SeasonDto dto = RestResponseDto.createSeasonDto(seasonInterface);

        // Then
        Assert.isNull(dto.startDate, 'Should handle null start date');
        Assert.isNull(dto.endDate, 'Should handle null end date');
    }

    @IsTest
    static void testJsonSerializationStructure() {
        // Given
        RestResponseDto response = RestResponseDto.success(
            new List<RestResponseDto.LeagueDto>()
        );

        // When
        String jsonStr = JSON.serialize(response);
        Map<String, Object> parsed = (Map<String, Object>)JSON.deserializeUntyped(jsonStr);

        // Then
        Assert.isTrue((Boolean)parsed.get('success'), 'JSON should have success field');
        Assert.isNotNull(parsed.get('data'), 'JSON should have data field');
    }
}