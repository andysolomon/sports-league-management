/**
 * @description Test class for LeagueService with dependency injection mocking
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class LeagueServiceTest {

    /**
     * @description Mock repository for testing service layer in isolation
     */
    private class MockLeagueRepository extends LeagueRepository {
        public List<League__c> mockLeagues;
        public Boolean shouldThrowException = false;

        public MockLeagueRepository() {
            this.mockLeagues = new List<League__c>();
        }

        public override League__c retrieve(Id leagueId) {
            if (shouldThrowException) {
                throw new LeagueRepositoryException('Mock repository error');
            }
            return mockLeagues.isEmpty() ? null : mockLeagues[0];
        }

        public override List<League__c> getAllLeagues() {
            if (shouldThrowException) {
                throw new LeagueRepositoryException('Mock repository error');
            }
            return mockLeagues;
        }
    }

    @IsTest
    static void testGetAllLeaguesAsInterface_Success() {
        // Given
        MockLeagueRepository mockRepo = new MockLeagueRepository();
        List<League__c> mockLeagues = (List<League__c>)JSON.deserialize(
            '[' +
            '  {"sobjectType": "League__c", "Id": "a01000000000001AAA", "Name": "Mock League Alpha"},' +
            '  {"sobjectType": "League__c", "Id": "a01000000000002AAA", "Name": "Mock League Beta"}' +
            ']',
            List<League__c>.class
        );
        mockRepo.mockLeagues = mockLeagues;
        LeagueService service = new LeagueService(mockRepo);

        // When
        Test.startTest();
        List<ILeague> result = service.getAllLeaguesAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of ILeague objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock leagues');
        Assert.areEqual('Mock League Alpha', result[0].getName(), 'Should return correct league name');
    }

    @IsTest
    static void testGetAllLeaguesAsInterface_EmptyResult() {
        // Given
        MockLeagueRepository mockRepo = new MockLeagueRepository();
        mockRepo.mockLeagues = new List<League__c>();
        LeagueService service = new LeagueService(mockRepo);

        // When
        Test.startTest();
        List<ILeague> result = service.getAllLeaguesAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list');
    }

    @IsTest
    static void testGetLeagueByIdAsInterface_ValidId() {
        // Given
        MockLeagueRepository mockRepo = new MockLeagueRepository();
        League__c mockLeague = (League__c)JSON.deserialize(
            '{"sobjectType": "League__c", "Id": "a01000000000001AAA", "Name": "Mock League Alpha"}',
            League__c.class
        );
        mockRepo.mockLeagues.add(mockLeague);
        LeagueService service = new LeagueService(mockRepo);
        String leagueId = 'a01000000000001AAA';

        // When
        Test.startTest();
        ILeague result = service.getLeagueByIdAsInterface(leagueId);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return ILeague object');
        Assert.areEqual(leagueId, result.getId(), 'Should return correct league ID');
        Assert.areEqual('Mock League Alpha', result.getName(), 'Should return correct league name');
    }

    @IsTest
    static void testGetLeagueByIdAsInterface_NullId() {
        // Given
        MockLeagueRepository mockRepo = new MockLeagueRepository();
        LeagueService service = new LeagueService(mockRepo);

        // When
        Test.startTest();
        ILeague resultNull = service.getLeagueByIdAsInterface(null);
        ILeague resultBlank = service.getLeagueByIdAsInterface('');
        Test.stopTest();

        // Then
        Assert.isNull(resultNull, 'Should return null for null ID');
        Assert.isNull(resultBlank, 'Should return null for blank ID');
    }

    @IsTest
    static void testExceptionPropagation_DatabaseError() {
        // Given
        MockLeagueRepository mockRepo = new MockLeagueRepository();
        mockRepo.shouldThrowException = true;
        LeagueService service = new LeagueService(mockRepo);

        // When/Then
        Test.startTest();
        try {
            service.getAllLeaguesAsInterface();
            Assert.fail('Should propagate exception from repository');
        } catch (LeagueRepository.LeagueRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testDependencyInjection_NullRepository() {
        // When/Then
        Test.startTest();
        try {
            LeagueService service = new LeagueService(null);
            Assert.fail('Should throw exception for null repository');
        } catch (LeagueService.LeagueServiceException e) {
            Assert.areEqual('Repository cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testLeagueWrapper_ILeagueImplementation() {
        // Given
        League__c mockLeague = (League__c)JSON.deserialize(
            '{"sobjectType": "League__c", "Id": "a01000000000001AAA", "Name": "Test League"}',
            League__c.class
        );

        // When
        ILeague wrapper = new LeagueWrapper(mockLeague);

        // Then
        Assert.areEqual(mockLeague.Id, wrapper.getId(), 'Wrapper should return correct ID');
        Assert.areEqual(mockLeague.Name, wrapper.getName(), 'Wrapper should return correct name');
    }

    @IsTest
    static void testBulkOperations_LargeDataSets() {
        // Given
        MockLeagueRepository mockRepo = new MockLeagueRepository();
        List<League__c> bulkLeagues = new List<League__c>();
        for (Integer i = 1; i <= 200; i++) {
            bulkLeagues.add(new League__c(Name = 'Bulk League ' + i));
        }
        mockRepo.mockLeagues = bulkLeagues;
        LeagueService service = new LeagueService(mockRepo);

        // When
        Test.startTest();
        List<ILeague> result = service.getAllLeaguesAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should handle bulk operations');
        Assert.areEqual(200, result.size(), 'Should return all 200 leagues');
        Assert.isTrue(Limits.getQueries() <= Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
        Assert.isTrue(Limits.getCpuTime() <= Limits.getLimitCpuTime(), 'Should not exceed CPU time limits');
    }
}