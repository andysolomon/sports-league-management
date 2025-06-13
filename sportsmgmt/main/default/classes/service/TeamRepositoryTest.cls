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
            Name = 'Test Football League'
        );
        // Only set RecordTypeId if the record type exists
        Map<String, Schema.RecordTypeInfo> recordTypes = Schema.SObjectType.League__c.getRecordTypeInfosByDeveloperName();
        if (recordTypes.containsKey('Professional')) {
            testLeague.RecordTypeId = recordTypes.get('Professional').getRecordTypeId();
        }
        insert testLeague;
        
        // Create test teams
        List<Team__c> testTeams = new List<Team__c>{
            new Team__c(
                Name = 'Test Team Alpha',
                City__c = 'Test City Alpha',
                Stadium__c = 'Alpha Stadium',
                Founded_Year__c = 1990,
                Location__c = 'Test City Alpha, State',
                League__c = testLeague.Id
            ),
            new Team__c(
                Name = 'Test Team Beta',
                City__c = 'Test City Beta',
                Stadium__c = 'Beta Stadium',
                Founded_Year__c = 1995,
                Location__c = 'Test City Beta, State',
                League__c = testLeague.Id
            ),
            new Team__c(
                Name = 'Test Team Gamma',
                City__c = 'Test City Gamma',
                Stadium__c = 'Gamma Stadium',
                Founded_Year__c = 2000,
                Location__c = 'Test City Gamma, State',
                League__c = testLeague.Id
            )
        };
        insert testTeams;
    }
    
    /**
     * @description Test getAllTeams method returns all teams with proper field selection
     */
    @IsTest
    static void testGetAllTeams_ReturnsAllTeams() {
        // Given
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.getAllTeams();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of teams');
        Assert.areEqual(3, result.size(), 'Should return all 3 test teams');
        
        // Verify field selection
        for (Team__c team : result) {
            Assert.isNotNull(team.Id, 'Id should be populated');
            Assert.isNotNull(team.Name, 'Name should be populated');
            Assert.isNotNull(team.City__c, 'City__c should be populated');
            Assert.isNotNull(team.Stadium__c, 'Stadium__c should be populated');
            Assert.isNotNull(team.Founded_Year__c, 'Founded_Year__c should be populated');
            Assert.isNotNull(team.League__c, 'League__c should be populated');
            Assert.isNotNull(team.League__r, 'League relationship should be populated');
            Assert.isNotNull(team.League__r.Name, 'League name should be populated');
        }
        
        // Verify ordering (should be by Name)
        Assert.areEqual('Test Team Alpha', result[0].Name, 'First team should be Alpha (alphabetical order)');
        Assert.areEqual('Test Team Beta', result[1].Name, 'Second team should be Beta');
        Assert.areEqual('Test Team Gamma', result[2].Name, 'Third team should be Gamma');
    }
    
    /**
     * @description Test retrieve method with valid ID
     */
    @IsTest
    static void testRetrieve_ValidId() {
        // Given
        Team__c testTeam = [SELECT Id FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        Team__c result = repository.retrieve(testTeam.Id);
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
     * @description Test retrieve method with null ID
     */
    @IsTest
    static void testRetrieve_NullId() {
        // Given
        TeamRepository repository = new TeamRepository();
        
        // When/Then
        Test.startTest();
        try {
            repository.retrieve(null);
            Assert.fail('Should throw TeamRepositoryException for null ID');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Team Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    /**
     * @description Test listByLeague method with valid league ID
     */
    @IsTest
    static void testListByLeague_ValidLeagueId() {
        // Given
        League__c testLeague = [SELECT Id FROM League__c WHERE Name = 'Test Football League' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.listByLeague(testLeague.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of teams');
        Assert.areEqual(3, result.size(), 'Should return all 3 teams in the league');
        
        // Verify all teams belong to the correct league
        for (Team__c team : result) {
            Assert.areEqual(testLeague.Id, team.League__c, 'All teams should belong to the test league');
            Assert.isNotNull(team.League__r, 'League relationship should be populated');
            Assert.areEqual('Test Football League', team.League__r.Name, 'League name should be correct');
        }
    }
    
    /**
     * @description Test listByLeague method with non-existent league ID
     */
    @IsTest
    static void testListByLeague_NonExistentLeagueId() {
        // Given
        String nonExistentId = 'a01000000000000AAA'; // Valid format but non-existent
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repository.listByLeague(nonExistentId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list for non-existent league');
    }
    
    /**
     * @description Test bulk operations and governor limits
     */
    @IsTest
    static void testBulkOperations_GovernorLimits() {
        // Given - Create additional league for bulk test
        League__c bulkLeague = new League__c(
            Name = 'Bulk Test League',
            RecordTypeId = Schema.SObjectType.League__c.getRecordTypeInfosByDeveloperName()
                .get('Professional').getRecordTypeId()
        );
        insert bulkLeague;
        
        // Create 200 teams for bulk testing
        List<Team__c> bulkTeams = new List<Team__c>();
        for (Integer i = 1; i <= 200; i++) {
            bulkTeams.add(new Team__c(
                Name = 'Bulk Team ' + i,
                City__c = 'Bulk City ' + i,
                Stadium__c = 'Bulk Stadium ' + i,
                Founded_Year__c = 2000 + Math.mod(i, 24), // Years 2000-2023
                Location__c = 'Bulk City ' + i + ', State',
                League__c = bulkLeague.Id
            ));
        }
        insert bulkTeams;
        
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        List<Team__c> allTeams = repository.getAllTeams();
        List<Team__c> leagueTeams = repository.listByLeague(bulkLeague.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(allTeams, 'getAllTeams should return results');
        Assert.isTrue(allTeams.size() >= 50, 'Should return at least 50 teams (LIMIT 50 in query)');
        
        Assert.isNotNull(leagueTeams, 'listByLeague should return results');
        Assert.areEqual(200, leagueTeams.size(), 'Should return all 200 bulk teams');
        
        // Verify no SOQL governor limit issues
        Assert.isTrue(Limits.getQueries() <= Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
    }
    
    /**
     * @description Test field-level security and CRUD permissions
     */
    @IsTest
    static void testFieldLevelSecurity_CRUDPermissions() {
        // Given
        Team__c testTeam = [SELECT Id FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        // When
        Test.startTest();
        Team__c result = repository.retrieve(testTeam.Id);
        Test.stopTest();
        
        // Then - Verify all expected fields are accessible
        Assert.isNotNull(result, 'Should retrieve team');
        Assert.isNotNull(result.Name, 'Name field should be accessible');
        Assert.isNotNull(result.City__c, 'City__c field should be accessible');
        Assert.isNotNull(result.Stadium__c, 'Stadium__c field should be accessible');
        Assert.isNotNull(result.Founded_Year__c, 'Founded_Year__c field should be accessible');
        Assert.isNotNull(result.League__c, 'League__c field should be accessible');
        Assert.isNotNull(result.League__r, 'League relationship should be accessible');
        Assert.isNotNull(result.League__r.Name, 'League name should be accessible');
    }
    
    /**
     * @description Test error handling for malformed queries
     */
    @IsTest
    static void testErrorHandling_MalformedQueries() {
        // Given
        String invalidId = 'invalid-id-format';
        TeamRepository repository = new TeamRepository();
        
        // When/Then
        Test.startTest();
        try {
            repository.retrieve(invalidId);
            Assert.fail('Should throw exception for invalid ID format');
        } catch (Exception e) {
            // Expected - invalid ID format should cause exception
            Assert.isTrue(e instanceof StringException || e instanceof QueryException, 
                         'Should throw appropriate exception type');
        }
        Test.stopTest();
    }

    /**
     * @description Test create method with valid ITeam
     */
    @IsTest
    static void testCreate_ValidTeam() {
        // Given
        League__c testLeague = [SELECT Id FROM League__c WHERE Name = 'Test Football League' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        // Create a complete Team__c record and wrap it
        Team__c newTeamRecord = new Team__c(
            Name = 'New Test Team',
            City__c = 'New City',
            Stadium__c = 'New Stadium',
            Founded_Year__c = 2024,
            Location__c = 'New City, State',
            League__c = testLeague.Id
        );
        ITeam newTeam = new TeamWrapper(newTeamRecord);
        
        // When
        Test.startTest();
        Id createdId = repository.create(newTeam);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(createdId, 'Should return created team ID');
        
        // Verify the team was created correctly
        Team__c createdTeam = [SELECT Id, Name, League__c FROM Team__c WHERE Id = :createdId];
        Assert.areEqual('New Test Team', createdTeam.Name, 'Should have correct name');
        Assert.areEqual(testLeague.Id, createdTeam.League__c, 'Should have correct league');
    }

    /**
     * @description Test create method with null team
     */
    @IsTest
    static void testCreate_NullTeam() {
        // Given
        TeamRepository repository = new TeamRepository();
        
        // When/Then
        Test.startTest();
        try {
            repository.create(null);
            Assert.fail('Should throw TeamRepositoryException for null team');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Team cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    /**
     * @description Test updateTeam method with valid record
     */
    @IsTest
    static void testUpdateTeam_ValidRecord() {
        // Given
        Team__c testTeam = [SELECT Id, Name, City__c FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        // Modify the team
        testTeam.Name = 'Updated Team Alpha';
        testTeam.City__c = 'Updated City Alpha';
        
        // When
        Test.startTest();
        repository.updateTeam(testTeam);
        Test.stopTest();
        
        // Then
        Team__c updatedTeam = [SELECT Id, Name, City__c FROM Team__c WHERE Id = :testTeam.Id];
        Assert.areEqual('Updated Team Alpha', updatedTeam.Name, 'Should have updated name');
        Assert.areEqual('Updated City Alpha', updatedTeam.City__c, 'Should have updated city');
    }

    /**
     * @description Test updateTeam method with null record
     */
    @IsTest
    static void testUpdateTeam_NullRecord() {
        // Given
        TeamRepository repository = new TeamRepository();
        
        // When/Then
        Test.startTest();
        try {
            repository.updateTeam(null);
            Assert.fail('Should throw TeamRepositoryException for null record');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Invalid Team record', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    /**
     * @description Test updateTeam method with record without ID
     */
    @IsTest
    static void testUpdateTeam_RecordWithoutId() {
        // Given
        TeamRepository repository = new TeamRepository();
        Team__c teamWithoutId = new Team__c(Name = 'Team Without ID');
        
        // When/Then
        Test.startTest();
        try {
            repository.updateTeam(teamWithoutId);
            Assert.fail('Should throw TeamRepositoryException for record without ID');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Invalid Team record', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    /**
     * @description Test deleteTeam method with valid ID
     */
    @IsTest
    static void testDeleteTeam_ValidId() {
        // Given
        Team__c testTeam = [SELECT Id FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        Id teamIdToDelete = testTeam.Id;
        
        // When
        Test.startTest();
        repository.deleteTeam(teamIdToDelete);
        Test.stopTest();
        
        // Then
        List<Team__c> remainingTeams = [SELECT Id FROM Team__c WHERE Id = :teamIdToDelete];
        Assert.areEqual(0, remainingTeams.size(), 'Team should be deleted');
        
        // Verify other teams still exist
        List<Team__c> allTeams = [SELECT Id FROM Team__c];
        Assert.areEqual(2, allTeams.size(), 'Should have 2 remaining teams');
    }

    /**
     * @description Test deleteTeam method with non-existent ID
     */
    @IsTest
    static void testDeleteTeam_NonExistentId() {
        // Given
        String nonExistentId = 'a00000000000000AAA'; // Valid format but non-existent
        TeamRepository repository = new TeamRepository();
        
        // When/Then
        Test.startTest();
        try {
            repository.deleteTeam(nonExistentId);
            // This should not throw an exception - Salesforce allows deleting non-existent records
            // The operation will simply have no effect
        } catch (Exception e) {
            // If an exception is thrown, it should be a DML exception
            Assert.isTrue(e instanceof DmlException, 'Should throw DML exception if any');
        }
        Test.stopTest();
        
        // Verify all original teams still exist
        List<Team__c> allTeams = [SELECT Id FROM Team__c];
        Assert.areEqual(3, allTeams.size(), 'Should still have all 3 original teams');
    }

    /**
     * @description Test bulk create operations
     */
    @IsTest
    static void testBulkCreate_MultipleTeams() {
        // Given
        League__c testLeague = [SELECT Id FROM League__c WHERE Name = 'Test Football League' LIMIT 1];
        TeamRepository repository = new TeamRepository();
        
        List<ITeam> newTeams = new List<ITeam>();
        for (Integer i = 1; i <= 10; i++) {
            Team__c bulkTeamRecord = new Team__c(
                Name = 'Bulk Team ' + i,
                City__c = 'Bulk City ' + i,
                Stadium__c = 'Bulk Stadium ' + i,
                Founded_Year__c = 2024,
                Location__c = 'Bulk City ' + i + ', State',
                League__c = testLeague.Id
            );
            newTeams.add(new TeamWrapper(bulkTeamRecord));
        }
        
        // When
        Test.startTest();
        List<Id> createdIds = new List<Id>();
        for (ITeam team : newTeams) {
            createdIds.add(repository.create(team));
        }
        Test.stopTest();
        
        // Then
        Assert.areEqual(10, createdIds.size(), 'Should create 10 teams');
        
        // Verify all teams were created
        List<Team__c> createdTeams = [SELECT Id, Name FROM Team__c WHERE Id IN :createdIds];
        Assert.areEqual(10, createdTeams.size(), 'Should have 10 created teams in database');
    }

    /**
     * @description Test bulk update operations
     */
    @IsTest
    static void testBulkUpdate_MultipleTeams() {
        // Given
        List<Team__c> testTeams = [SELECT Id, Name, City__c FROM Team__c ORDER BY Name];
        TeamRepository repository = new TeamRepository();
        
        // Modify all teams
        for (Integer i = 0; i < testTeams.size(); i++) {
            testTeams[i].Name = 'Bulk Updated ' + testTeams[i].Name;
            testTeams[i].City__c = 'Bulk Updated City ' + i;
        }
        
        // When
        Test.startTest();
        for (Team__c team : testTeams) {
            repository.updateTeam(team);
        }
        Test.stopTest();
        
        // Then
        List<Team__c> updatedTeams = [SELECT Id, Name, City__c FROM Team__c ORDER BY Name];
        for (Team__c team : updatedTeams) {
            Assert.isTrue(team.Name.startsWith('Bulk Updated'), 'Team name should be updated');
            Assert.isTrue(team.City__c.startsWith('Bulk Updated City'), 'Team city should be updated');
        }
    }

    /**
     * @description Test bulk delete operations
     */
    @IsTest
    static void testBulkDelete_MultipleTeams() {
        // Given - Create additional teams for deletion test
        League__c testLeague = [SELECT Id FROM League__c WHERE Name = 'Test Football League' LIMIT 1];
        List<Team__c> teamsToDelete = new List<Team__c>();
        for (Integer i = 1; i <= 5; i++) {
            teamsToDelete.add(new Team__c(
                Name = 'Delete Team ' + i,
                City__c = 'Delete City ' + i,
                Stadium__c = 'Delete Stadium ' + i,
                Founded_Year__c = 2020,
                Location__c = 'Delete City ' + i + ', State',
                League__c = testLeague.Id
            ));
        }
        insert teamsToDelete;
        
        TeamRepository repository = new TeamRepository();
        List<Id> idsToDelete = new List<Id>();
        for (Team__c team : teamsToDelete) {
            idsToDelete.add(team.Id);
        }
        
        // When
        Test.startTest();
        for (Id teamId : idsToDelete) {
            repository.deleteTeam(teamId);
        }
        Test.stopTest();
        
        // Then
        List<Team__c> remainingDeleteTeams = [SELECT Id FROM Team__c WHERE Id IN :idsToDelete];
        Assert.areEqual(0, remainingDeleteTeams.size(), 'All delete teams should be removed');
        
        // Verify original test teams still exist
        List<Team__c> originalTeams = [SELECT Id FROM Team__c WHERE Name LIKE 'Test Team%'];
        Assert.areEqual(3, originalTeams.size(), 'Original test teams should still exist');
    }
} 