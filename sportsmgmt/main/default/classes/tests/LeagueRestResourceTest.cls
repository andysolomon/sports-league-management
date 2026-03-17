/**
 * @description Test class for LeagueRestResource
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class LeagueRestResourceTest {

    @TestSetup
    static void setupTestData() {
        List<League__c> leagues = new List<League__c>{
            new League__c(Name = 'Alpha League'),
            new League__c(Name = 'Beta League')
        };
        insert leagues;
    }

    @IsTest
    static void testGetAllLeagues() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/leagues';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        LeagueRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 leagues');
    }

    @IsTest
    static void testGetLeagueById() {
        // Given
        League__c league = [SELECT Id FROM League__c WHERE Name = 'Alpha League' LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/leagues/' + league.Id;
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        LeagueRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('Alpha League', data.get('name'), 'Should return correct league name');
    }

    @IsTest
    static void testGetLeagueById_NotFound() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/leagues/a01000000000099AAA';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        LeagueRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.isTrue(res.statusCode == 404 || res.statusCode == 500, 'Should return error status');
    }
}