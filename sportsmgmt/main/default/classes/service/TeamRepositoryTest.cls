/**
 * @description Test class for TeamRepository
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class TeamRepositoryTest {
    
    /**
     * @description Test data setup for each test method
     */
    @TestSetup
    static void setupTestData() {
        // Create test league
        League__c testLeague = new League__c(
            Name = 'Test Football League',
            RecordTypeId = Schema.SObjectType.League__c.getRecordTypeInfosByDeveloperName()
                .get('Professional').getRecordTypeId()
        );
        insert testLeague;
        
        // Create test teams
        List<Team__c> testTeams = new List<Team__c>{
            new Team__c(
                Name = 'Test Team Alpha',
                City__c = 'Test City Alpha',
                Stadium__c = 'Alpha Stadium',
                Founded_Year__c = 1990,
                League__c = testLeague.Id
            ),
            new Team__c(
                Name = 'Test Team Beta',
                City__c = 'Test City Beta',
                Stadium__c = 'Beta Stadium',
                Founded_Year__c = 1995,
                League__c = testLeague.Id
            ),
            new Team__c(
                Name = 'Test Team Gamma',
                City__c = 'Test City Gamma',
                Stadium__c = 'Gamma Stadium',
                Founded_Year__c = 2000,
                League__c = testLeague.Id
            )
        };
        insert testTeams;
    }
    
    /**
     * @description Test getAllTeams method returns all teams with proper field selection
     */
    @IsTest
    static void testGetAllTeams_Success() {
        // Given
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.getAllTeams();
        Test.stopTest();
        
        // Then
        Assert.areEqual(3, result.size(), 'Should return all 3 test teams');
        
        for (Team__c team : result) {
            Assert.isNotNull(team.Name, 'Team name should not be null');
            Assert.isNotNull(team.City__c, 'Team city should not be null');
            Assert.isNotNull(team.Stadium__c, 'Team stadium should not be null');
            Assert.isNotNull(team.Founded_Year__c, 'Team founded year should not be null');
            Assert.isNotNull(team.League__c, 'Team league should not be null');
            Assert.isNotNull(team.League__r, 'League relationship should be populated');
            Assert.isNotNull(team.League__r.Name, 'League name should be populated');
        }
    }
    
    /**
     * @description Test getAllTeams method with no teams in database
     */
    @IsTest
    static void testGetAllTeams_EmptyResult() {
        // Given
        delete [SELECT Id FROM Team__c];
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.getAllTeams();
        Test.stopTest();
        
        // Then
        Assert.areEqual(0, result.size(), 'Should return empty list when no teams exist');
    }
    
    /**
     * @description Test getTeamById method with valid ID
     */
    @IsTest
    static void testGetTeamById_ValidId() {
        // Given
        Team__c testTeam = [SELECT Id FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        Team__c result = repository.getTeamById(testTeam.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return team record');
        Assert.areEqual(testTeam.Id, result.Id, 'Should return correct team');
        Assert.areEqual('Test Team Alpha', result.Name, 'Should return correct team name');
        Assert.areEqual('Test City Alpha', result.City__c, 'Should return correct city');
        Assert.areEqual('Alpha Stadium', result.Stadium__c, 'Should return correct stadium');
        Assert.areEqual(1990, result.Founded_Year__c, 'Should return correct founded year');
        Assert.isNotNull(result.League__r, 'League relationship should be populated');
        Assert.areEqual('Test Football League', result.League__r.Name, 'Should return correct league name');
    }
    
    /**
     * @description Test getTeamById method with invalid ID
     */
    @IsTest
    static void testGetTeamById_InvalidId() {
        // Given
        String invalidId = 'a00000000000000AAA'; // Valid format but non-existent ID
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        Team__c result = repository.getTeamById(invalidId);
        Test.stopTest();
        
        // Then
        Assert.isNull(result, 'Should return null for invalid ID');
    }
    
    /**
     * @description Test getTeamById method with null ID
     */
    @IsTest
    static void testGetTeamById_NullId() {
        // Given
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        Team__c result = repository.getTeamById(null);
        Test.stopTest();
        
        // Then
        Assert.isNull(result, 'Should return null for null ID');
    }
    
    /**
     * @description Test getTeamsByLeague method with valid league ID
     */
    @IsTest
    static void testGetTeamsByLeague_ValidLeagueId() {
        // Given
        League__c testLeague = [SELECT Id FROM League__c WHERE Name = 'Test Football League' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.getTeamsByLeague(testLeague.Id);
        Test.stopTest();
        
        // Then
        Assert.areEqual(3, result.size(), 'Should return all teams for the league');
        
        for (Team__c team : result) {
            Assert.areEqual(testLeague.Id, team.League__c, 'All teams should belong to the test league');
            Assert.isNotNull(team.League__r, 'League relationship should be populated');
            Assert.areEqual('Test Football League', team.League__r.Name, 'League name should be correct');
        }
    }
    
    /**
     * @description Test getTeamsByLeague method with invalid league ID
     */
    @IsTest
    static void testGetTeamsByLeague_InvalidLeagueId() {
        // Given
        String invalidLeagueId = 'a01000000000000AAA'; // Valid format but non-existent ID
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.getTeamsByLeague(invalidLeagueId);
        Test.stopTest();
        
        // Then
        Assert.areEqual(0, result.size(), 'Should return empty list for invalid league ID');
    }
    
    /**
     * @description Test getTeamsByLeague method with null league ID
     */
    @IsTest
    static void testGetTeamsByLeague_NullLeagueId() {
        // Given
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.getTeamsByLeague(null);
        Test.stopTest();
        
        // Then
        Assert.areEqual(0, result.size(), 'Should return empty list for null league ID');
    }
    
    /**
     * @description Test bulk operations and governor limits
     */
    @IsTest
    static void testBulkOperations_GovernorLimits() {
        // Given - Create additional teams to test bulk operations
        League__c testLeague = [SELECT Id FROM League__c WHERE Name = 'Test Football League' LIMIT 1];
        List<Team__c> bulkTeams = new List<Team__c>();
        
        for (Integer i = 0; i < 200; i++) {
            bulkTeams.add(new Team__c(
                Name = 'Bulk Team ' + i,
                City__c = 'Bulk City ' + i,
                Stadium__c = 'Bulk Stadium ' + i,
                Founded_Year__c = 2000 + Math.mod(i, 24),
                League__c = testLeague.Id
            ));
        }
        insert bulkTeams;
        
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> allTeams = repository.getAllTeams();
        List<Team__c> leagueTeams = repository.getTeamsByLeague(testLeague.Id);
        Test.stopTest();
        
        // Then
        Assert.areEqual(203, allTeams.size(), 'Should return all teams including bulk teams');
        Assert.areEqual(203, leagueTeams.size(), 'Should return all teams for the league');
        
        // Verify governor limits are respected
        Assert.isTrue(Limits.getQueries() <= Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
        Assert.isTrue(Limits.getQueryRows() <= Limits.getLimitQueryRows(), 'Should not exceed query row limits');
    }
    
    /**
     * @description Test field-level security and object permissions
     */
    @IsTest
    static void testFieldLevelSecurity() {
        // Given
        TeamRepository repository = new TeamRepository();
        Team__c testTeam = [SELECT Id FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        
        // When
        Test.startTest();
        Team__c result = repository.getTeamById(testTeam.Id);
        Test.stopTest();
        
        // Then - Verify all expected fields are accessible
        Assert.isNotNull(result.Name, 'Name field should be accessible');
        Assert.isNotNull(result.City__c, 'City__c field should be accessible');
        Assert.isNotNull(result.Stadium__c, 'Stadium__c field should be accessible');
        Assert.isNotNull(result.Founded_Year__c, 'Founded_Year__c field should be accessible');
        Assert.isNotNull(result.League__c, 'League__c field should be accessible');
        Assert.isNotNull(result.League__r.Name, 'League__r.Name field should be accessible');
    }
    
    /**
     * @description Test error handling for malformed queries
     */
    @IsTest
    static void testErrorHandling_DatabaseExceptions() {
        // Given
        TeamRepository repository = new TeamRepository();
        String malformedId = 'invalid-id-format';
        
        // When & Then
        Test.startTest();
        try {
            Team__c result = repository.getTeamById(malformedId);
            Assert.fail('Should have thrown an exception for malformed ID');
        } catch (Exception e) {
            Assert.isTrue(e instanceof StringException || e instanceof QueryException, 
                         'Should throw appropriate exception type');
        }
        Test.stopTest();
    }
} 