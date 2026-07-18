/**
 * @description Test class for PlayerRestResource
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class PlayerRestResourceTest {

    @TestSetup
    static void setupTestData() {
        League__c league = new League__c(Name = 'Test League');
        insert league;

        Team__c team = new Team__c(
            Name = 'Test Team',
            City__c = 'Test City',
            Location__c = 'Test City, State',
            League__c = league.Id
        );
        insert team;

        List<Player__c> players = new List<Player__c>{
            new Player__c(
                Name = 'Player Alpha',
                Team__c = team.Id,
                Position__c = 'Forward',
                Jersey_Number__c = 10,
                Date_of_Birth__c = Date.newInstance(1990, 5, 15),
                Status__c = 'Active'
            ),
            new Player__c(
                Name = 'Player Beta',
                Team__c = team.Id,
                Position__c = 'Defender',
                Jersey_Number__c = 5,
                Date_of_Birth__c = Date.newInstance(1992, 8, 20),
                Status__c = 'Active'
            )
        };
        insert players;
    }

    @IsTest
    static void testGetAllPlayers() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 players');
    }

    @IsTest
    static void testGetPlayerById() {
        // Given
        Player__c player = [SELECT Id FROM Player__c WHERE Name = 'Player Alpha' LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players/' + player.Id;
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('Player Alpha', data.get('name'), 'Should return correct player name');
        Assert.areEqual('Forward', data.get('position'), 'Should return correct position');
    }

    @IsTest
    static void testGetPlayersByTeamId() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players';
        req.httpMethod = 'GET';
        req.params.put('teamId', team.Id);
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        List<Object> data = (List<Object>)body.get('data');
        Assert.areEqual(2, data.size(), 'Should return 2 players for this team');
    }

    @IsTest
    static void testGetPlayerById_NotFound() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players/a03000000000099AAA';
        req.httpMethod = 'GET';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doGet();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.isTrue(res.statusCode == 404 || res.statusCode == 500, 'Should return error status');
    }

    @IsTest
    static void testCreatePlayer_Success() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        Map<String, Object> requestBody = new Map<String, Object>{
            'name' => 'New Player',
            'teamId' => team.Id,
            'position' => 'Midfielder',
            'jerseyNumber' => 7,
            'dateOfBirth' => '1995-03-10',
            'status' => 'Active'
        };

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players';
        req.httpMethod = 'POST';
        req.requestBody = Blob.valueOf(JSON.serialize(requestBody));
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doPost();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(201, res.statusCode, 'Should return 201');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('New Player', data.get('name'), 'Should return correct name');
        Assert.areEqual('Midfielder', data.get('position'), 'Should return correct position');
    }

    @IsTest
    static void testCreatePlayer_MissingName() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        Map<String, Object> requestBody = new Map<String, Object>{
            'teamId' => team.Id,
            'position' => 'Midfielder'
        };

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players';
        req.httpMethod = 'POST';
        req.requestBody = Blob.valueOf(JSON.serialize(requestBody));
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doPost();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(400, res.statusCode, 'Should return 400 for missing name');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isFalse((Boolean)body.get('success'), 'Should not be successful');
    }

    @IsTest
    static void testUpdatePlayer_Success() {
        // Given
        Player__c player = [SELECT Id FROM Player__c WHERE Name = 'Player Alpha' LIMIT 1];
        Map<String, Object> requestBody = new Map<String, Object>{
            'name' => 'Player Alpha Updated',
            'position' => 'Goalkeeper'
        };

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players/' + player.Id;
        req.httpMethod = 'PUT';
        req.requestBody = Blob.valueOf(JSON.serialize(requestBody));
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doPut();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Map<String, Object> data = (Map<String, Object>)body.get('data');
        Assert.areEqual('Player Alpha Updated', data.get('name'), 'Should return updated name');
        Assert.areEqual('Goalkeeper', data.get('position'), 'Should return updated position');
    }

    @IsTest
    static void testUpdatePlayer_NoId() {
        // Given
        Map<String, Object> requestBody = new Map<String, Object>{
            'name' => 'Updated Name'
        };

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players';
        req.httpMethod = 'PUT';
        req.requestBody = Blob.valueOf(JSON.serialize(requestBody));
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doPut();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(400, res.statusCode, 'Should return 400 for missing ID');
    }

    @IsTest
    static void testDeletePlayer_Success() {
        // Given
        Player__c player = [SELECT Id FROM Player__c WHERE Name = 'Player Beta' LIMIT 1];

        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players/' + player.Id;
        req.httpMethod = 'DELETE';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doDelete();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(200, res.statusCode, 'Should return 200');
        Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
            res.responseBody.toString());
        Assert.isTrue((Boolean)body.get('success'), 'Should be successful');

        List<Player__c> remaining = [SELECT Id FROM Player__c WHERE Id = :player.Id];
        Assert.areEqual(0, remaining.size(), 'Player should be deleted');
    }

    @IsTest
    static void testDeletePlayer_NoId() {
        // Given
        RestRequest req = new RestRequest();
        req.requestURI = '/services/apexrest/sportsmgmt/v1/players';
        req.httpMethod = 'DELETE';
        RestContext.request = req;
        RestContext.response = new RestResponse();

        // When
        Test.startTest();
        PlayerRestResource.doDelete();
        Test.stopTest();

        // Then
        RestResponse res = RestContext.response;
        Assert.areEqual(400, res.statusCode, 'Should return 400 for missing ID');
    }
}