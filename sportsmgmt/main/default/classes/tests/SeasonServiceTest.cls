/**
 * @description Test class for SeasonService with dependency injection mocking
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class SeasonServiceTest {

    /**
     * @description Mock repository for testing service layer in isolation
     */
    private class MockSeasonRepository extends SeasonRepository {
        public List<Season__c> mockSeasons;
        public Boolean shouldThrowException = false;
        public String expectedSeasonId;
        public ISeason lastCreatedSeason;
        public Season__c lastUpdatedSeason;
        public Id lastDeletedSeasonId;

        public MockSeasonRepository() {
            this.mockSeasons = new List<Season__c>();
        }

        public override Id create(ISeason season) {
            if (shouldThrowException) {
                throw new SeasonRepositoryException('Mock repository error');
            }
            this.lastCreatedSeason = season;
            return 'a03000000000001AAA'; // Mock ID
        }

        public override Season__c retrieve(Id seasonId) {
            if (shouldThrowException) {
                throw new SeasonRepositoryException('Mock repository error');
            }
            this.expectedSeasonId = String.valueOf(seasonId);
            return mockSeasons.isEmpty() ? null : mockSeasons[0];
        }

        public override void updateSeason(Season__c record) {
            if (shouldThrowException) {
                throw new SeasonRepositoryException('Mock repository error');
            }
            this.lastUpdatedSeason = record;
        }

        public override void deleteSeason(Id seasonId) {
            if (shouldThrowException) {
                throw new SeasonRepositoryException('Mock repository error');
            }
            this.lastDeletedSeasonId = seasonId;
        }

        public override List<Season__c> listByLeague(Id leagueId) {
            if (shouldThrowException) {
                throw new SeasonRepositoryException('Mock repository error');
            }
            return mockSeasons;
        }

        public override List<Season__c> getAllSeasons() {
            if (shouldThrowException) {
                throw new SeasonRepositoryException('Mock repository error');
            }
            return mockSeasons;
        }
    }

    /**
     * @description Test getAllSeasonsAsInterface method returns wrapped season objects
     */
    @IsTest
    static void testGetAllSeasonsAsInterface_Success() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        List<Season__c> mockSeasons = (List<Season__c>)JSON.deserialize(
            '[' +
            '  {"sobjectType": "Season__c", "Id": "a03000000000001AAA", "Name": "2024-2025 Season", "League__c": "a01000000000001AAA", "Start_Date__c": "2024-09-01", "End_Date__c": "2025-06-30", "Status__c": "Completed"},' +
            '  {"sobjectType": "Season__c", "Id": "a03000000000002AAA", "Name": "2025-2026 Season", "League__c": "a01000000000001AAA", "Start_Date__c": "2025-09-01", "End_Date__c": "2026-06-30", "Status__c": "Active"}' +
            ']',
            List<Season__c>.class
        );
        mockRepo.mockSeasons = mockSeasons;
        SeasonService service = new SeasonService(mockRepo);

        // When
        Test.startTest();
        List<ISeason> result = service.getAllSeasonsAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of ISeason objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock seasons');

        // Verify first season
        ISeason firstSeason = result[0];
        Assert.isNotNull(firstSeason.getId(), 'Should have an ID');
        Assert.areEqual('2024-2025 Season', firstSeason.getName(), 'Should return correct season name');
        Assert.isNotNull(firstSeason.getLeagueId(), 'Should have a league ID');
        Assert.isNotNull(firstSeason.getStartDate(), 'Should have a start date');
        Assert.isNotNull(firstSeason.getEndDate(), 'Should have an end date');
        Assert.areEqual('Completed', firstSeason.getStatus(), 'Should have correct status');
    }

    /**
     * @description Test getAllSeasonsAsInterface method with empty result
     */
    @IsTest
    static void testGetAllSeasonsAsInterface_EmptyResult() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        mockRepo.mockSeasons = new List<Season__c>(); // Empty list
        SeasonService service = new SeasonService(mockRepo);

        // When
        Test.startTest();
        List<ISeason> result = service.getAllSeasonsAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list');
    }

    /**
     * @description Test getSeasonByIdAsInterface method with valid ID
     */
    @IsTest
    static void testGetSeasonByIdAsInterface_ValidId() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        Season__c mockSeason = (Season__c)JSON.deserialize(
            '{"sobjectType": "Season__c", "Id": "a03000000000001AAA", "Name": "2024-2025 Season", "League__c": "a01000000000001AAA", "Start_Date__c": "2024-09-01", "End_Date__c": "2025-06-30", "Status__c": "Completed"}',
            Season__c.class
        );
        mockRepo.mockSeasons.add(mockSeason);
        SeasonService service = new SeasonService(mockRepo);
        String seasonId = 'a03000000000001AAA';

        // When
        Test.startTest();
        ISeason result = service.getSeasonByIdAsInterface(seasonId);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return ISeason object');
        Assert.areEqual(seasonId, result.getId(), 'Should return correct season ID');
        Assert.areEqual('2024-2025 Season', result.getName(), 'Should return correct season name');
        Assert.isNotNull(result.getLeagueId(), 'Should have a league ID');
        Assert.isNotNull(result.getStartDate(), 'Should have a start date');
        Assert.isNotNull(result.getEndDate(), 'Should have an end date');
        Assert.areEqual('Completed', result.getStatus(), 'Should have correct status');
    }

    /**
     * @description Test getSeasonByIdAsInterface method with null/blank ID
     */
    @IsTest
    static void testGetSeasonByIdAsInterface_NullId() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        SeasonService service = new SeasonService(mockRepo);

        // When
        Test.startTest();
        ISeason resultNull = service.getSeasonByIdAsInterface(null);
        ISeason resultBlank = service.getSeasonByIdAsInterface('');
        Test.stopTest();

        // Then
        Assert.isNull(resultNull, 'Should return null for null ID');
        Assert.isNull(resultBlank, 'Should return null for blank ID');
    }

    /**
     * @description Test getSeasonsByLeagueAsInterface method with valid league ID
     */
    @IsTest
    static void testGetSeasonsByLeagueAsInterface_ValidLeagueId() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        List<Season__c> mockSeasons = (List<Season__c>)JSON.deserialize(
            '[' +
            '  {"sobjectType": "Season__c", "Id": "a03000000000001AAA", "Name": "2024-2025 Season", "League__c": "a01000000000001AAA", "Start_Date__c": "2024-09-01", "End_Date__c": "2025-06-30", "Status__c": "Completed"},' +
            '  {"sobjectType": "Season__c", "Id": "a03000000000002AAA", "Name": "2025-2026 Season", "League__c": "a01000000000001AAA", "Start_Date__c": "2025-09-01", "End_Date__c": "2026-06-30", "Status__c": "Active"}' +
            ']',
            List<Season__c>.class
        );
        mockRepo.mockSeasons = mockSeasons;
        SeasonService service = new SeasonService(mockRepo);
        String leagueId = 'a01000000000001AAA';

        // When
        Test.startTest();
        List<ISeason> result = service.getSeasonsByLeagueAsInterface(leagueId);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of ISeason objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock seasons');

        // Verify all seasons belong to the correct league
        for (ISeason season : result) {
            Assert.isNotNull(season.getLeagueId(), 'All seasons should have a league ID');
        }
    }

    /**
     * @description Test getSeasonsByLeagueAsInterface method with null/blank league ID
     */
    @IsTest
    static void testGetSeasonsByLeagueAsInterface_NullLeagueId() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        SeasonService service = new SeasonService(mockRepo);

        // When
        Test.startTest();
        List<ISeason> resultNull = service.getSeasonsByLeagueAsInterface(null);
        List<ISeason> resultBlank = service.getSeasonsByLeagueAsInterface('');
        Test.stopTest();

        // Then
        Assert.isNotNull(resultNull, 'Should return empty list for null league ID');
        Assert.areEqual(0, resultNull.size(), 'Should return empty list for null league ID');
        Assert.isNotNull(resultBlank, 'Should return empty list for blank league ID');
        Assert.areEqual(0, resultBlank.size(), 'Should return empty list for blank league ID');
    }

    /**
     * @description Test createSeason method with valid season
     */
    @IsTest
    static void testCreateSeason_ValidSeason() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        SeasonService service = new SeasonService(mockRepo);
        ISeason newSeason = new SeasonWrapper(
            null, 'New Season', 'a01000000000001AAA',
            Date.newInstance(2026, 9, 1), Date.newInstance(2027, 6, 30), 'Upcoming'
        );

        // When
        Test.startTest();
        Id result = service.createSeason(newSeason);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return created season ID');
        Assert.areEqual('a03000000000001AAA', result, 'Should return mock ID');
        Assert.areEqual(newSeason, mockRepo.lastCreatedSeason, 'Should pass season to repository');
    }

    /**
     * @description Test exception propagation from repository layer
     */
    @IsTest
    static void testExceptionPropagation_DatabaseError() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();
        mockRepo.shouldThrowException = true; // Will throw exceptions
        SeasonService service = new SeasonService(mockRepo);

        // When/Then
        Test.startTest();
        try {
            service.getAllSeasonsAsInterface();
            Assert.fail('Should propagate exception from repository');
        } catch (SeasonRepository.SeasonRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate correct error message');
        }
        Test.stopTest();
    }

    /**
     * @description Test dependency injection with null repository
     */
    @IsTest
    static void testDependencyInjection_NullRepository() {
        // When/Then
        Test.startTest();
        try {
            SeasonService service = new SeasonService(null);
            Assert.fail('Should throw exception for null repository');
        } catch (SeasonService.SeasonServiceException e) {
            Assert.areEqual('Repository cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    /**
     * @description Test SeasonWrapper functionality with ISeason interface
     */
    @IsTest
    static void testSeasonWrapper_ISeasonImplementation() {
        // Given
        Season__c mockSeason = (Season__c)JSON.deserialize(
            '{"sobjectType": "Season__c", "Id": "a03000000000001AAA", "Name": "Test Season", "League__c": "a01000000000001AAA", "Start_Date__c": "2024-09-01", "End_Date__c": "2025-06-30", "Status__c": "Active"}',
            Season__c.class
        );

        // When
        ISeason wrapper = new SeasonWrapper(mockSeason);

        // Then
        Assert.areEqual(mockSeason.Id, wrapper.getId(), 'Wrapper should return correct ID');
        Assert.areEqual(mockSeason.Name, wrapper.getName(), 'Wrapper should return correct name');
        Assert.areEqual(mockSeason.League__c, wrapper.getLeagueId(), 'Wrapper should return correct league ID');
        Assert.areEqual(mockSeason.Start_Date__c, wrapper.getStartDate(), 'Wrapper should return correct start date');
        Assert.areEqual(mockSeason.End_Date__c, wrapper.getEndDate(), 'Wrapper should return correct end date');
        Assert.areEqual(mockSeason.Status__c, wrapper.getStatus(), 'Wrapper should return correct status');
    }

    /**
     * @description Test bulk operations handling
     */
    @IsTest
    static void testBulkOperations_LargeDataSets() {
        // Given
        MockSeasonRepository mockRepo = new MockSeasonRepository();

        // Create large mock dataset
        List<Season__c> bulkSeasons = new List<Season__c>();
        for (Integer i = 1; i <= 200; i++) {
            Season__c season = new Season__c(
                Name = 'Bulk Season ' + i,
                League__c = 'a01000000000001AAA'
            );
            bulkSeasons.add(season);
        }
        mockRepo.mockSeasons = bulkSeasons;

        SeasonService service = new SeasonService(mockRepo);

        // When
        Test.startTest();
        List<ISeason> result = service.getAllSeasonsAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should handle bulk operations');
        Assert.areEqual(200, result.size(), 'Should return all 200 seasons');

        // Verify governor limits are respected
        Assert.isTrue(Limits.getQueries() <= Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
        Assert.isTrue(Limits.getCpuTime() <= Limits.getLimitCpuTime(), 'Should not exceed CPU time limits');
    }
}
