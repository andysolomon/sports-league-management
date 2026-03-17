/**
 * @description Test class for DivisionRestResource
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class DivisionRestResourceTest {

    @TestSetup
    static void setupTestData() {
        League__c league = new League__c(Name = 'Test League');
        insert league;

        List<Division__c> divisions = new List<Division__c>{
            new Division__c(Name = 'Eastern Division', League__c = league.Id),
            new Division__c(Name = 'Western Division', League__c = league.Id)
        };
        insert divisions;
    }

    @IsTest
    static void testGetAllDivisions() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/divisions';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        DivisionRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 divisions');
    }

    @IsTest
    static void testGetDivisionById() {
        // Given
        Division__c division = [SELECT Id FROM Division__c WHERE Name = 'Eastern Division' LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/divisions/' + division.Id;
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        DivisionRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('Eastern Division', data.get('name'), 'Should return correct division');
    }

    @IsTest
    static void testGetDivisionsByLeagueId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/divisions';
        req.httpMethod = 'GET';
        req.params.put('leagueId', league.Id);
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        DivisionRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 divisions for this league');
    }

    @IsTest
    static void testGetDivisionById_NotFound() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/divisions/a02000000000099AAA';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        DivisionRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.isTrue(res.statusCode == 404 || res.statusCode == 500, 'Should return error status');
    }
}