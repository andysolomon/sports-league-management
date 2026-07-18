/**
 * @description Test class for TeamRestResource
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class TeamRestResourceTest {

    @TestSetup
    static void setupTestData() {
        League__c league = new League__c(Name = 'Test League');
        insert league;

        Division__c division = new Division__c(Name = 'Test Division', League__c = league.Id);
        insert division;

        List<Team__c> teams = new List<Team__c>{
            new Team__c(
                Name = 'Test Team Alpha',
                City__c = 'Alpha City',
                Stadium__c = 'Alpha Stadium',
                Founded_Year__c = 2020,
                Location__c = 'Alpha City, State',
                League__c = league.Id,
                Division__c = division.Id
            ),
            new Team__c(
                Name = 'Test Team Beta',
                City__c = 'Beta City',
                Stadium__c = 'Beta Stadium',
                Founded_Year__c = 2021,
                Location__c = 'Beta City, State',
                League__c = league.Id
            )
        };
        insert teams;
    }

    @IsTest
    static void testGetAllTeams() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/teams';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        TeamRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 teams');
    }

    @IsTest
    static void testGetTeamById_VerifyAllFields() {
        // Given
        Team__c team = [SELECT Id FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/teams/' + team.Id;
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        TeamRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('Test Team Alpha', data.get('name'), 'Should have correct name');
        Assert.areEqual('Alpha City', data.get('city'), 'Should have correct city');
        Assert.areEqual('Alpha Stadium', data.get('stadium'), 'Should have correct stadium');
        Assert.areEqual(2020, (Integer)((Decimal)data.get('foundedYear')).intValue(), 'Should have correct founded year');
        Assert.areEqual('Alpha City, State', data.get('location'), 'Should have correct location');
        Assert.isNotNull(data.get('divisionId'), 'Should have division ID');
    }

    @IsTest
    static void testGetTeamsByLeagueId() {
        // Given
        League__c league = [SELECT Id FROM League__c LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/teams';
        req.httpMethod = 'GET';
        req.params.put('leagueId', league.Id);
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        TeamRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 teams for this league');
    }

    @IsTest
    static void testGetTeamById_NotFound() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/teams/a00000000000099AAA';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        TeamRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.isTrue(res.statusCode == 404 || res.statusCode == 500, 'Should return error status');
    }

    @IsTest
    static void testUpdateTeam_Success() {
        // Given
        Team__c team = [SELECT Id FROM Team__c WHERE Name = 'Test Team Alpha' LIMIT 1];
        Map<String, Object> requestBody = new Map<String, Object>{
            'name' => 'Updated Team Alpha',
            'city' => 'New City',
            'stadium' => 'New Stadium'
        };

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/teams/' + team.Id;
        req.httpMethod = 'PUT';
        req.requestBody = Blob.valueOf(JSON.serialize(requestBody));
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        TeamRestResource.doPut();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('Updated Team Alpha', data.get('name'), 'Should return updated name');
        Assert.areEqual('New City', data.get('city'), 'Should return updated city');
        Assert.areEqual('New Stadium', data.get('stadium'), 'Should return updated stadium');
    }

    @IsTest
    static void testUpdateTeam_NoId() {
        // Given
        Map<String, Object> requestBody = new Map<String, Object>{
            'name' => 'Updated Name'
        };

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/teams';
        req.httpMethod = 'PUT';
        req.requestBody = Blob.valueOf(JSON.serialize(requestBody));
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        TeamRestResource.doPut();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(400, res.statusCode, 'Should return 400 for missing ID');
    }
}