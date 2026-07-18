/**
 * @description Test class for DivisionRepository with proper test data setup
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class DivisionRepositoryTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test league
        League__c testLeague = new League__c(
            Name = 'Test League'
        );
        insert testLeague;
        
        // Create test divisions
        List<Division__c> testDivisions = new List<Division__c>{
            new Division__c(Name = 'Eastern Division', League__c = testLeague.Id),
            new Division__c(Name = 'Western Division', League__c = testLeague.Id)
        };
        insert testDivisions;
        
        // Create test teams
        List<Team__c> testTeams = new List<Team__c>{
            new Team__c(
                Name = 'Test Team 1',
                City__c = 'Test City 1',
                Location__c = 'Test City 1, State',
                Stadium__c = 'Test Stadium 1',
                Founded_Year__c = 2020,
                League__c = testLeague.Id,
                Division__c = testDivisions[0].Id
            ),
            new Team__c(
                Name = 'Test Team 2',
                City__c = 'Test City 2',
                Location__c = 'Test City 2, State',
                Stadium__c = 'Test Stadium 2',
                Founded_Year__c = 2021,
                League__c = testLeague.Id,
                Division__c = testDivisions[1].Id
            )
        };
        insert testTeams;
    }
    
    @IsTest
    static void testCreate_ValidDivision() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        IDivision newDivision = new DivisionWrapper(null, 'New Division', league.Id);
        
        // When
        Test.startTest();
        Id result = repo.create(newDivision);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return created division ID');
        Division__c created = [SELECT Id, Name, League__c FROM Division__c WHERE Id = :result];
        Assert.areEqual('New Division', created.Name, 'Should have correct name');
        Assert.areEqual(league.Id, created.League__c, 'Should have correct league');
    }
    
    @IsTest
    static void testCreate_NullDivision() {
        // Given
        DivisionRepository repo = new DivisionRepository();
        
        // When/Then
        Test.startTest();
        try {
            repo.create(null);
            Assert.fail('Should throw exception for null division');
        } catch (DivisionRepository.DivisionRepositoryException e) {
            Assert.areEqual('Division cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testRetrieve_ValidId() {
        // Given
        Division__c testDivision = [SELECT Id FROM Division__c LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        Division__c result = repo.retrieve(testDivision.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return division');
        Assert.areEqual(testDivision.Id, result.Id, 'Should return correct division');
        Assert.isNotNull(result.League__r, 'Should include league relationship');
    }
    
    @IsTest
    static void testRetrieve_NullId() {
        // Given
        DivisionRepository repo = new DivisionRepository();
        
        // When/Then
        Test.startTest();
        try {
            repo.retrieve(null);
            Assert.fail('Should throw exception for null ID');
        } catch (DivisionRepository.DivisionRepositoryException e) {
            Assert.areEqual('Division Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testUpdateDivision_ValidRecord() {
        // Given
        Division__c testDivision = [SELECT Id, Name, League__c FROM Division__c LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        testDivision.Name = 'Updated Division Name';
        
        // When
        Test.startTest();
        repo.updateDivision(testDivision);
        Test.stopTest();
        
        // Then
        Division__c updated = [SELECT Name FROM Division__c WHERE Id = :testDivision.Id];
        Assert.areEqual('Updated Division Name', updated.Name, 'Should have updated name');
    }
    
    @IsTest
    static void testUpdateDivision_NullRecord() {
        // Given
        DivisionRepository repo = new DivisionRepository();
        
        // When/Then
        Test.startTest();
        try {
            repo.updateDivision(null);
            Assert.fail('Should throw exception for null record');
        } catch (DivisionRepository.DivisionRepositoryException e) {
            Assert.areEqual('Invalid Division record', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testDeleteDivision_ValidId_NoTeams() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        Division__c divisionToDelete = new Division__c(Name = 'To Be Deleted', League__c = league.Id);
        insert divisionToDelete;

        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        repo.deleteDivision(divisionToDelete.Id);
        Test.stopTest();
        
        // Then
        List<Division__c> remaining = [SELECT Id FROM Division__c WHERE Id = :divisionToDelete.Id];
        Assert.areEqual(0, remaining.size(), 'Division should be deleted');
    }

    @IsTest
    static void testDeleteDivision_WithTeams_ThrowsException() {
        // Given
        Division__c testDivisionWithTeam = [SELECT Id FROM Division__c WHERE Name = 'Eastern Division' LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        
        // When/Then
        Test.startTest();
        try {
            repo.deleteDivision(testDivisionWithTeam.Id);
            Assert.fail('Should throw exception when deleting division with teams');
        } catch (DivisionRepository.DivisionRepositoryException e) {
            Assert.isTrue(e.getMessage().contains('Cannot delete division with assigned teams'), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testDeleteDivision_NullId() {
        // Given
        DivisionRepository repo = new DivisionRepository();
        
        // When/Then
        Test.startTest();
        try {
            repo.deleteDivision(null);
            Assert.fail('Should throw exception for null ID');
        } catch (DivisionRepository.DivisionRepositoryException e) {
            Assert.areEqual('Division Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testListByLeague_ValidLeagueId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        List<Division__c> result = repo.listByLeague(league.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of divisions');
        Assert.areEqual(2, result.size(), 'Should return 2 test divisions');
        for (Division__c division : result) {
            Assert.areEqual(league.Id, division.League__c, 'All divisions should belong to the league');
        }
    }
    
    @IsTest
    static void testGetAllDivisions() {
        // Given
        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        List<Division__c> result = repo.getAllDivisions();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of divisions');
        Assert.areEqual(2, result.size(), 'Should return 2 test divisions');
    }
    
    @IsTest
    static void testAssignTeamToDivision_ValidIds() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        Division__c division = [SELECT Id FROM Division__c LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        repo.assignTeamToDivision(team.Id, division.Id);
        Test.stopTest();
        
        // Then
        Team__c updatedTeam = [SELECT Division__c FROM Team__c WHERE Id = :team.Id];
        Assert.areEqual(division.Id, updatedTeam.Division__c, 'Team should be assigned to division');
    }
    
    @IsTest
    static void testAssignTeamToDivision_RemoveAssignment() {
        // Given
        Team__c team = [SELECT Id FROM Team__c WHERE Division__c != null LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        repo.assignTeamToDivision(team.Id, null);
        Test.stopTest();
        
        // Then
        Team__c updatedTeam = [SELECT Division__c FROM Team__c WHERE Id = :team.Id];
        Assert.isNull(updatedTeam.Division__c, 'Team should be removed from division');
    }
    
    @IsTest
    static void testAssignTeamToDivision_NullTeamId() {
        // Given
        Division__c division = [SELECT Id FROM Division__c LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        
        // When/Then
        Test.startTest();
        try {
            repo.assignTeamToDivision(null, division.Id);
            Assert.fail('Should throw exception for null team ID');
        } catch (DivisionRepository.DivisionRepositoryException e) {
            Assert.areEqual('Team Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testGetTeamsByDivision_ValidDivisionId() {
        // Given
        Division__c division = [SELECT Id FROM Division__c WHERE Id IN (SELECT Division__c FROM Team__c) LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repo.getTeamsByDivision(division.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of teams');
        Assert.areEqual(1, result.size(), 'Should return 1 team in this division');
        Assert.areEqual(division.Id, result[0].Division__c, 'Team should belong to the division');
    }
    
    @IsTest
    static void testGetTeamsByDivision_NullDivisionId() {
        // Given
        DivisionRepository repo = new DivisionRepository();
        
        // When
        Test.startTest();
        List<Team__c> result = repo.getTeamsByDivision(null);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return empty list for null division ID');
        Assert.areEqual(0, result.size(), 'Should return empty list for null division ID');
    }
    
    @IsTest
    static void testBulkOperations() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        DivisionRepository repo = new DivisionRepository();
        List<IDivision> bulkDivisions = new List<IDivision>();
        
        for (Integer i = 1; i <= 10; i++) {
            bulkDivisions.add(new DivisionWrapper(null, 'Bulk Division ' + i, league.Id));
        }
        
        // When
        Test.startTest();
        List<Id> createdIds = new List<Id>();
        for (IDivision division : bulkDivisions) {
            createdIds.add(repo.create(division));
        }
        Test.stopTest();
        
        // Then
        Assert.areEqual(10, createdIds.size(), 'Should create 10 divisions');
        List<Division__c> created = [SELECT Id FROM Division__c WHERE Id IN :createdIds];
        Assert.areEqual(10, created.size(), 'Should have 10 divisions in database');
    }
} 