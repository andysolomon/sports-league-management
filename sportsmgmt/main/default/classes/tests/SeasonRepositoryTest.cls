/**
 * @description Test class for SeasonRepository with proper test data setup
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class SeasonRepositoryTest {

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
                Name = '2024-2025 Season',
                League__c = testLeague.Id,
                Start_Date__c = Date.newInstance(2024, 9, 1),
                End_Date__c = Date.newInstance(2025, 6, 30),
                Status__c = 'Completed'
            ),
            new Season__c(
                Name = '2025-2026 Season',
                League__c = testLeague.Id,
                Start_Date__c = Date.newInstance(2025, 9, 1),
                End_Date__c = Date.newInstance(2026, 6, 30),
                Status__c = 'Active'
            )
        };
        insert testSeasons;
    }

    @IsTest
    static void testCreate_ValidSeason() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        SeasonRepository repo = new SeasonRepository();
        ISeason newSeason = new SeasonWrapper(
            null, 'New Season', league.Id,
            Date.newInstance(2026, 9, 1), Date.newInstance(2027, 6, 30), 'Upcoming'
        );

        // When
        Test.startTest();
        Id result = repo.create(newSeason);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return created season ID');
        Season__c created = [SELECT Id, Name, League__c, Start_Date__c, End_Date__c, Status__c FROM Season__c WHERE Id = :result];
        Assert.areEqual('New Season', created.Name, 'Should have correct name');
        Assert.areEqual(league.Id, created.League__c, 'Should have correct league');
        Assert.areEqual(Date.newInstance(2026, 9, 1), created.Start_Date__c, 'Should have correct start date');
        Assert.areEqual(Date.newInstance(2027, 6, 30), created.End_Date__c, 'Should have correct end date');
        Assert.areEqual('Upcoming', created.Status__c, 'Should have correct status');
    }

    @IsTest
    static void testCreate_NullSeason() {
        // Given
        SeasonRepository repo = new SeasonRepository();

        // When/Then
        Test.startTest();
        try {
            repo.create(null);
            Assert.fail('Should throw exception for null season');
        } catch (SeasonRepository.SeasonRepositoryException e) {
            Assert.areEqual('Season cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreate_EndDateBeforeStartDate() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        SeasonRepository repo = new SeasonRepository();
        ISeason invalidSeason = new SeasonWrapper(
            null, 'Invalid Season', league.Id,
            Date.newInstance(2026, 9, 1), Date.newInstance(2026, 1, 1), 'Upcoming'
        );

        // When/Then
        Test.startTest();
        try {
            repo.create(invalidSeason);
            Assert.fail('Should throw exception for end date before start date');
        } catch (SeasonRepository.SeasonRepositoryException e) {
            Assert.areEqual('End date must be on or after start date', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreate_DuplicateName() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        SeasonRepository repo = new SeasonRepository();
        ISeason duplicateSeason = new SeasonWrapper(
            null, '2024-2025 Season', league.Id,
            Date.newInstance(2024, 9, 1), Date.newInstance(2025, 6, 30), 'Upcoming'
        );

        // When/Then
        Test.startTest();
        try {
            repo.create(duplicateSeason);
            Assert.fail('Should throw exception for duplicate name');
        } catch (SeasonRepository.SeasonRepositoryException e) {
            Assert.areEqual('Season name must be unique within the league', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testRetrieve_ValidId() {
        // Given
        Season__c testSeason = [SELECT Id FROM Season__c LIMIT 1];
        SeasonRepository repo = new SeasonRepository();

        // When
        Test.startTest();
        Season__c result = repo.retrieve(testSeason.Id);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return season');
        Assert.areEqual(testSeason.Id, result.Id, 'Should return correct season');
        Assert.isNotNull(result.League__r, 'Should include league relationship');
        Assert.isNotNull(result.Start_Date__c, 'Should include start date');
        Assert.isNotNull(result.End_Date__c, 'Should include end date');
        Assert.isNotNull(result.Status__c, 'Should include status');
    }

    @IsTest
    static void testRetrieve_NullId() {
        // Given
        SeasonRepository repo = new SeasonRepository();

        // When/Then
        Test.startTest();
        try {
            repo.retrieve(null);
            Assert.fail('Should throw exception for null ID');
        } catch (SeasonRepository.SeasonRepositoryException e) {
            Assert.areEqual('Season Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpdateSeason_ValidRecord() {
        // Given
        Season__c testSeason = [SELECT Id, Name, League__c, Start_Date__c, End_Date__c, Status__c FROM Season__c LIMIT 1];
        SeasonRepository repo = new SeasonRepository();
        testSeason.Name = 'Updated Season Name';

        // When
        Test.startTest();
        repo.updateSeason(testSeason);
        Test.stopTest();

        // Then
        Season__c updated = [SELECT Name FROM Season__c WHERE Id = :testSeason.Id];
        Assert.areEqual('Updated Season Name', updated.Name, 'Should have updated name');
    }

    @IsTest
    static void testUpdateSeason_NullRecord() {
        // Given
        SeasonRepository repo = new SeasonRepository();

        // When/Then
        Test.startTest();
        try {
            repo.updateSeason(null);
            Assert.fail('Should throw exception for null record');
        } catch (SeasonRepository.SeasonRepositoryException e) {
            Assert.areEqual('Invalid Season record', e.getMessage(), 'Should have correct error message');
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
            Start_Date__c = Date.newInstance(2030, 1, 1),
            End_Date__c = Date.newInstance(2030, 12, 31),
            Status__c = 'Upcoming'
        );
        insert seasonToDelete;

        SeasonRepository repo = new SeasonRepository();

        // When
        Test.startTest();
        repo.deleteSeason(seasonToDelete.Id);
        Test.stopTest();

        // Then
        List<Season__c> remaining = [SELECT Id FROM Season__c WHERE Id = :seasonToDelete.Id];
        Assert.areEqual(0, remaining.size(), 'Season should be deleted');
    }

    @IsTest
    static void testDeleteSeason_NullId() {
        // Given
        SeasonRepository repo = new SeasonRepository();

        // When/Then
        Test.startTest();
        try {
            repo.deleteSeason(null);
            Assert.fail('Should throw exception for null ID');
        } catch (SeasonRepository.SeasonRepositoryException e) {
            Assert.areEqual('Season Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testListByLeague_ValidLeagueId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        SeasonRepository repo = new SeasonRepository();

        // When
        Test.startTest();
        List<Season__c> result = repo.listByLeague(league.Id);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of seasons');
        Assert.areEqual(2, result.size(), 'Should return 2 test seasons');
        for (Season__c season : result) {
            Assert.areEqual(league.Id, season.League__c, 'All seasons should belong to the league');
        }
        // Verify ordering by Start_Date__c DESC (most recent first)
        Assert.isTrue(result[0].Start_Date__c >= result[1].Start_Date__c, 'Should be ordered by start date descending');
    }

    @IsTest
    static void testListByLeague_NullLeagueId() {
        // Given
        SeasonRepository repo = new SeasonRepository();

        // When
        Test.startTest();
        List<Season__c> result = repo.listByLeague(null);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list for null league ID');
        Assert.areEqual(0, result.size(), 'Should return empty list for null league ID');
    }

    @IsTest
    static void testGetAllSeasons() {
        // Given
        SeasonRepository repo = new SeasonRepository();

        // When
        Test.startTest();
        List<Season__c> result = repo.getAllSeasons();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of seasons');
        Assert.areEqual(2, result.size(), 'Should return 2 test seasons');
    }

    @IsTest
    static void testBulkOperations() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        SeasonRepository repo = new SeasonRepository();
        List<ISeason> bulkSeasons = new List<ISeason>();

        for (Integer i = 1; i <= 10; i++) {
            bulkSeasons.add(new SeasonWrapper(
                null, 'Bulk Season ' + i, league.Id,
                Date.newInstance(2030 + i, 1, 1), Date.newInstance(2030 + i, 12, 31), 'Upcoming'
            ));
        }

        // When
        Test.startTest();
        List<Id> createdIds = new List<Id>();
        for (ISeason season : bulkSeasons) {
            createdIds.add(repo.create(season));
        }
        Test.stopTest();

        // Then
        Assert.areEqual(10, createdIds.size(), 'Should create 10 seasons');
        List<Season__c> created = [SELECT Id FROM Season__c WHERE Id IN :createdIds];
        Assert.areEqual(10, created.size(), 'Should have 10 seasons in database');
    }
}
