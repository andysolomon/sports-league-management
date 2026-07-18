/**
 * @description Test class for SeasonRestResource
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class SeasonRestResourceTest {

    @TestSetup
    static void setupTestData() {
        League__c league = new League__c(Name = 'Test League');
        insert league;

        List<Season__c> seasons = new List<Season__c>{
            new Season__c(
                Name = '2024 Season',
                League__c = league.Id,
                Start_Date__c = Date.newInstance(2024, 1, 1),
                End_Date__c = Date.newInstance(2024, 12, 31),
                Status__c = 'Active'
            ),
            new Season__c(
                Name = '2023 Season',
                League__c = league.Id,
                Start_Date__c = Date.newInstance(2023, 1, 1),
                End_Date__c = Date.newInstance(2023, 12, 31),
                Status__c = 'Completed'
            )
        };
        insert seasons;
    }

    @IsTest
    static void testGetAllSeasons() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/seasons';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        SeasonRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 seasons');
    }

    @IsTest
    static void testGetSeasonById() {
        // Given
        Season__c season = [SELECT Id FROM Season__c WHERE Name = '2024 Season' LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/seasons/' + season.Id;
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        SeasonRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('2024 Season', data.get('name'), 'Should return correct season name');
        Assert.areEqual('Active', data.get('status'), 'Should return correct status');
    }

    @IsTest
    static void testGetSeasonsByLeagueId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/seasons';
        req.httpMethod = 'GET';
        req.params.put('leagueId', league.Id);
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        SeasonRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 seasons for this league');
    }

    @IsTest
    static void testGetSeasonById_NotFound() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/seasons/a04000000000099AAA';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        SeasonRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.isTrue(res.statusCode == 404 || res.statusCode == 500, 'Should return error status');
    }
}