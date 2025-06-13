/**
 * @description Test class for DivisionManagementController
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class DivisionManagementControllerTest {
    
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
                League__c = testLeague.Id
            )
        };
        insert testTeams;
    }
    
    @IsTest
    static void testGetAllDivisions_Success() {
        // When
        Test.startTest();
        List<Division__c> result = DivisionManagementController.getAllDivisions();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of divisions');
        Assert.areEqual(2, result.size(), 'Should return 2 test divisions');
    }
    
    @IsTest
    static void testGetDivisionById_ValidId() {
        // Given
        Division__c testDivision = [SELECT Id FROM Division__c LIMIT 1];
        
        // When
        Test.startTest();
        Division__c result = DivisionManagementController.getDivisionById(testDivision.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return division');
        Assert.areEqual(testDivision.Id, result.Id, 'Should return correct division');
    }
    
    @IsTest
    static void testGetDivisionById_BlankId() {
        // When
        Test.startTest();
        Division__c result = DivisionManagementController.getDivisionById('');
        Test.stopTest();
        
        // Then
        Assert.isNull(result, 'Should return null for blank ID');
    }
    
    @IsTest
    static void testGetDivisionsByLeague_ValidLeagueId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        
        // When
        Test.startTest();
        List<Division__c> result = DivisionManagementController.getDivisionsByLeague(league.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of divisions');
        Assert.areEqual(2, result.size(), 'Should return 2 divisions for the league');
    }
    
    @IsTest
    static void testGetDivisionsByLeague_BlankLeagueId() {
        // When
        Test.startTest();
        List<Division__c> result = DivisionManagementController.getDivisionsByLeague('');
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return empty list for blank league ID');
        Assert.areEqual(0, result.size(), 'Should return empty list for blank league ID');
    }
    
    @IsTest
    static void testCreateDivision_ValidData() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        
        // When
        Test.startTest();
        String result = DivisionManagementController.createDivision('New Division', league.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return created division ID');
        Division__c created = [SELECT Name, League__c FROM Division__c WHERE Id = :result];
        Assert.areEqual('New Division', created.Name, 'Should have correct name');
        Assert.areEqual(league.Id, created.League__c, 'Should have correct league');
    }
    
    @IsTest
    static void testCreateDivision_BlankName() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        
        // When/Then
        Test.startTest();
        try {
            DivisionManagementController.createDivision('', league.Id);
            Assert.fail('Should throw exception for blank name');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('Division name and league are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testCreateDivision_BlankLeague() {
        // When/Then
        Test.startTest();
        try {
            DivisionManagementController.createDivision('Test Division', '');
            Assert.fail('Should throw exception for blank league');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('Division name and league are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testUpdateDivision_ValidData() {
        // Given
        Division__c testDivision = [SELECT Id FROM Division__c LIMIT 1];
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        
        // When
        Test.startTest();
        DivisionManagementController.updateDivision(testDivision.Id, 'Updated Division', league.Id);
        Test.stopTest();
        
        // Then
        Division__c updated = [SELECT Name FROM Division__c WHERE Id = :testDivision.Id];
        Assert.areEqual('Updated Division', updated.Name, 'Should have updated name');
    }
    
    @IsTest
    static void testUpdateDivision_BlankId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        
        // When/Then
        Test.startTest();
        try {
            DivisionManagementController.updateDivision('', 'Updated Division', league.Id);
            Assert.fail('Should throw exception for blank ID');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('Division ID, name, and league are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testDeleteDivision_ValidId() {
        // Given
        Division__c testDivision = [SELECT Id FROM Division__c LIMIT 1];
        
        // When
        Test.startTest();
        DivisionManagementController.deleteDivision(testDivision.Id);
        Test.stopTest();
        
        // Then
        List<Division__c> remaining = [SELECT Id FROM Division__c WHERE Id = :testDivision.Id];
        Assert.areEqual(0, remaining.size(), 'Division should be deleted');
    }
    
    @IsTest
    static void testDeleteDivision_BlankId() {
        // When/Then
        Test.startTest();
        try {
            DivisionManagementController.deleteDivision('');
            Assert.fail('Should throw exception for blank ID');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('Division ID is required'), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testAssignTeamToDivision_ValidIds() {
        // Given
        Team__c team = [SELECT Id FROM Team__c WHERE Division__c = null LIMIT 1];
        Division__c division = [SELECT Id FROM Division__c LIMIT 1];
        
        // When
        Test.startTest();
        DivisionManagementController.assignTeamToDivision(team.Id, division.Id);
        Test.stopTest();
        
        // Then
        Team__c updatedTeam = [SELECT Division__c FROM Team__c WHERE Id = :team.Id];
        Assert.areEqual(division.Id, updatedTeam.Division__c, 'Team should be assigned to division');
    }
    
    @IsTest
    static void testAssignTeamToDivision_RemoveAssignment() {
        // Given
        Team__c team = [SELECT Id FROM Team__c WHERE Division__c != null LIMIT 1];
        
        // When
        Test.startTest();
        DivisionManagementController.assignTeamToDivision(team.Id, null);
        Test.stopTest();
        
        // Then
        Team__c updatedTeam = [SELECT Division__c FROM Team__c WHERE Id = :team.Id];
        Assert.isNull(updatedTeam.Division__c, 'Team should be removed from division');
    }
    
    @IsTest
    static void testAssignTeamToDivision_BlankTeamId() {
        // Given
        Division__c division = [SELECT Id FROM Division__c LIMIT 1];
        
        // When/Then
        Test.startTest();
        try {
            DivisionManagementController.assignTeamToDivision('', division.Id);
            Assert.fail('Should throw exception for blank team ID');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('Team ID is required'), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testGetTeamsByDivision_ValidDivisionId() {
        // Given
        Division__c division = [SELECT Id FROM Division__c WHERE Id IN (SELECT Division__c FROM Team__c) LIMIT 1];
        
        // When
        Test.startTest();
        List<Team__c> result = DivisionManagementController.getTeamsByDivision(division.Id);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of teams');
        Assert.areEqual(1, result.size(), 'Should return 1 team in this division');
    }
    
    @IsTest
    static void testGetTeamsByDivision_BlankDivisionId() {
        // When
        Test.startTest();
        List<Team__c> result = DivisionManagementController.getTeamsByDivision('');
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return empty list for blank division ID');
        Assert.areEqual(0, result.size(), 'Should return empty list for blank division ID');
    }
} 