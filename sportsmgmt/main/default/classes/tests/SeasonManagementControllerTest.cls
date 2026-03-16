/**
 * @description Test class for SeasonManagementController
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class SeasonManagementControllerTest {

    @TestSetup
    static void setupTestData() {
        // Create test league
        League__c testLeague = new League__c(
            Name = 'Test League'
        );
        insert testLeague;

        // Create test seasons
        List<Season__c> testSeasons = new List<Season__c>{
            new Season__c(
                Name = '2024 Season',
                League__c = testLeague.Id,
                Start_Date__c = Date.newInstance(2024, 1, 1),
                End_Date__c = Date.newInstance(2024, 6, 30),
                Status__c = 'Completed'
            ),
            new Season__c(
                Name = '2025 Season',
                League__c = testLeague.Id,
                Start_Date__c = Date.newInstance(2025, 1, 1),
                End_Date__c = Date.newInstance(2025, 6, 30),
                Status__c = 'Active'
            )
        };
        insert testSeasons;
    }

    @IsTest
    static void testGetAllSeasons_Success() {
        // When
        Test.startTest();
        List<Season__c> result = SeasonManagementController.getAllSeasons();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of seasons');
        Assert.areEqual(2, result.size(), 'Should return 2 test seasons');
    }

    @IsTest
    static void testGetSeasonById_ValidId() {
        // Given
        Season__c testSeason = [SELECT Id FROM Season__c LIMIT 1];

        // When
        Test.startTest();
        Season__c result = SeasonManagementController.getSeasonById(testSeason.Id);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return season');
        Assert.areEqual(testSeason.Id, result.Id, 'Should return correct season');
    }

    @IsTest
    static void testGetSeasonById_BlankId() {
        // When
        Test.startTest();
        Season__c result = SeasonManagementController.getSeasonById('');
        Test.stopTest();

        // Then
        Assert.isNull(result, 'Should return null for blank ID');
    }

    @IsTest
    static void testGetSeasonsByLeague_ValidLeagueId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];

        // When
        Test.startTest();
        List<Season__c> result = SeasonManagementController.getSeasonsByLeague(league.Id);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of seasons');
        Assert.areEqual(2, result.size(), 'Should return 2 seasons for the league');
    }

    @IsTest
    static void testGetSeasonsByLeague_BlankLeagueId() {
        // When
        Test.startTest();
        List<Season__c> result = SeasonManagementController.getSeasonsByLeague('');
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list for blank league ID');
        Assert.areEqual(0, result.size(), 'Should return empty list for blank league ID');
    }

    @IsTest
    static void testCreateSeason_ValidData() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];

        // When
        Test.startTest();
        String result = SeasonManagementController.createSeason(
            'New Season', league.Id, Date.newInstance(2026, 1, 1), Date.newInstance(2026, 6, 30), 'Upcoming'
        );
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return created season ID');
        Season__c created = [SELECT Name, League__c, Start_Date__c, End_Date__c, Status__c FROM Season__c WHERE Id = :result];
        Assert.areEqual('New Season', created.Name, 'Should have correct name');
        Assert.areEqual(league.Id, created.League__c, 'Should have correct league');
        Assert.areEqual(Date.newInstance(2026, 1, 1), created.Start_Date__c, 'Should have correct start date');
        Assert.areEqual(Date.newInstance(2026, 6, 30), created.End_Date__c, 'Should have correct end date');
        Assert.areEqual('Upcoming', created.Status__c, 'Should have correct status');
    }

    @IsTest
    static void testCreateSeason_BlankName() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];

        // When/Then
        Test.startTest();
        try {
            SeasonManagementController.createSeason('', league.Id, Date.newInstance(2026, 1, 1), Date.newInstance(2026, 6, 30), 'Upcoming');
            Assert.fail('Should throw exception for blank name');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Season name and league are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreateSeason_BlankLeague() {
        // When/Then
        Test.startTest();
        try {
            SeasonManagementController.createSeason('Test Season', '', Date.newInstance(2026, 1, 1), Date.newInstance(2026, 6, 30), 'Upcoming');
            Assert.fail('Should throw exception for blank league');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Season name and league are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpdateSeason_ValidData() {
        // Given
        Season__c testSeason = [SELECT Id FROM Season__c LIMIT 1];
        League__c league = [SELECT Id FROM League__c LIMIT 1];

        // When
        Test.startTest();
        SeasonManagementController.updateSeason(
            testSeason.Id, 'Updated Season', league.Id, Date.newInstance(2026, 3, 1), Date.newInstance(2026, 9, 30), 'Active'
        );
        Test.stopTest();

        // Then
        Season__c updated = [SELECT Name, Start_Date__c, End_Date__c, Status__c FROM Season__c WHERE Id = :testSeason.Id];
        Assert.areEqual('Updated Season', updated.Name, 'Should have updated name');
        Assert.areEqual(Date.newInstance(2026, 3, 1), updated.Start_Date__c, 'Should have updated start date');
        Assert.areEqual(Date.newInstance(2026, 9, 30), updated.End_Date__c, 'Should have updated end date');
        Assert.areEqual('Active', updated.Status__c, 'Should have updated status');
    }

    @IsTest
    static void testUpdateSeason_BlankId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];

        // When/Then
        Test.startTest();
        try {
            SeasonManagementController.updateSeason('', 'Updated Season', league.Id, Date.newInstance(2026, 3, 1), Date.newInstance(2026, 9, 30), 'Active');
            Assert.fail('Should throw exception for blank ID');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Season ID, name, and league are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testDeleteSeason_ValidId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        Season__c seasonToDelete = new Season__c(
            Name = 'To Be Deleted',
            League__c = league.Id,
            Start_Date__c = Date.newInstance(2027, 1, 1),
            End_Date__c = Date.newInstance(2027, 6, 30),
            Status__c = 'Upcoming'
        );
        insert seasonToDelete;

        // When
        Test.startTest();
        SeasonManagementController.deleteSeason(seasonToDelete.Id);
        Test.stopTest();

        // Then
        List<Season__c> remaining = [SELECT Id FROM Season__c WHERE Id = :seasonToDelete.Id];
        Assert.areEqual(0, remaining.size(), 'Season should be deleted');
    }

    @IsTest
    static void testDeleteSeason_BlankId() {
        // When/Then
        Test.startTest();
        try {
            SeasonManagementController.deleteSeason('');
            Assert.fail('Should throw exception for blank ID');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Season ID is required'), 'Should have correct error message');
        }
        Test.stopTest();
    }
}