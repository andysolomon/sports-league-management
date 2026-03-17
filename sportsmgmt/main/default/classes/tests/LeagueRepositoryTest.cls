/**
 * @description Test class for LeagueRepository with proper test data setup
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class LeagueRepositoryTest {

    @TestSetup
    static void setupTestData() {
        List<League__c> testLeagues = new List<League__c>{
            new League__c(Name = 'Alpha League'),
            new League__c(Name = 'Beta League')
        };
        insert testLeagues;
    }

    @IsTest
    static void testRetrieve_ValidId() {
        // Given
        League__c testLeague = [SELECT Id FROM League__c WHERE Name = 'Alpha League' LIMIT 1];
        LeagueRepository repo = new LeagueRepository();

        // When
        Test.startTest();
        League__c result = repo.retrieve(testLeague.Id);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return league');
        Assert.areEqual(testLeague.Id, result.Id, 'Should return correct league');
        Assert.areEqual('Alpha League', result.Name, 'Should return correct name');
    }

    @IsTest
    static void testRetrieve_NullId() {
        // Given
        LeagueRepository repo = new LeagueRepository();

        // When/Then
        Test.startTest();
        try {
            repo.retrieve(null);
            Assert.fail('Should throw exception for null ID');
        } catch (LeagueRepository.LeagueRepositoryException e) {
            Assert.areEqual('League Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testGetAllLeagues() {
        // Given
        LeagueRepository repo = new LeagueRepository();

        // When
        Test.startTest();
        List<League__c> result = repo.getAllLeagues();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of leagues');
        Assert.areEqual(2, result.size(), 'Should return 2 test leagues');
        // Verify ordering by name
        Assert.areEqual('Alpha League', result[0].Name, 'Should be ordered by name');
        Assert.areEqual('Beta League', result[1].Name, 'Should be ordered by name');
    }

    @IsTest
    static void testBulkOperations() {
        // Given
        List<League__c> bulkLeagues = new List<League__c>();
        for (Integer i = 1; i <= 10; i++) {
            bulkLeagues.add(new League__c(Name = 'Bulk League ' + i));
        }
        insert bulkLeagues;

        LeagueRepository repo = new LeagueRepository();

        // When
        Test.startTest();
        List<League__c> result = repo.getAllLeagues();
        Test.stopTest();

        // Then
        Assert.areEqual(12, result.size(), 'Should return all 12 leagues (2 setup + 10 bulk)');
    }
}