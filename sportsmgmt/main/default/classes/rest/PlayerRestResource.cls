/**
 * @description REST resource for Player data
 * @author Sports Management Team
 * @date 2024
 */
@RestResource(urlMapping='/sportsmgmt/v1/players/*')
global with sharing class PlayerRestResource {
    @TestVisible private static PlayerService service = new PlayerService();

    @HttpGet
    global static void doGet() {
        RestResponse res = RestContext.response;
        try {
            String recordId = RestUtils.extractIdFromUri(
                RestContext.request.requestURI, '/sportsmgmt/v1/players');
            if (recordId != null) {
                IPlayer player = service.getPlayerByIdAsInterface(recordId);
                if (player == null) {
                    res.statusCode = 404;
                    res.responseBody = Blob.valueOf(JSON.serialize(
                        RestResponseDto.error('Player not found', 'NOT_FOUND')));
                    return;
                }
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createPlayerDto(player))));
            } else if (RestContext.request.params.containsKey('teamId')) {
                String teamId = RestContext.request.params.get('teamId');
                List<IPlayer> players = service.getPlayersByTeamAsInterface(teamId);
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createPlayerDtoList(players))));
            } else {
                List<IPlayer> players = service.getAllPlayersAsInterface();
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createPlayerDtoList(players))));
            }
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }

    @HttpPost
    global static void doPost() {
        RestResponse res = RestContext.response;
        try {
            Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
                RestContext.request.requestBody.toString());

            String name = (String)body.get('name');
            String teamId = (String)body.get('teamId');
            if (String.isBlank(name) || String.isBlank(teamId)) {
                res.statusCode = 400;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.error('name and teamId are required', 'VALIDATION_ERROR')));
                return;
            }

            String position = (String)body.get('position');
            Decimal jerseyNumber = body.get('jerseyNumber') != null
                ? Decimal.valueOf(String.valueOf(body.get('jerseyNumber'))) : null;
            Date dateOfBirth = body.get('dateOfBirth') != null
                ? Date.valueOf((String)body.get('dateOfBirth')) : null;
            String status = (String)body.get('status');

            PlayerWrapper wrapper = new PlayerWrapper(
                null, name, teamId, position, jerseyNumber, dateOfBirth, status);
            Id newId = service.createPlayer(wrapper);

            IPlayer created = service.getPlayerByIdAsInterface(newId);
            res.statusCode = 201;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.success(RestResponseDto.createPlayerDto(created))));
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }

    @HttpPut
    global static void doPut() {
        RestResponse res = RestContext.response;
        try {
            String recordId = RestUtils.extractIdFromUri(
                RestContext.request.requestURI, '/sportsmgmt/v1/players');
            if (String.isBlank(recordId)) {
                res.statusCode = 400;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.error('Player ID is required in the URL', 'VALIDATION_ERROR')));
                return;
            }

            Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
                RestContext.request.requestBody.toString());

            Player__c record = new Player__c(Id = recordId);
            if (body.containsKey('name')) record.Name = (String)body.get('name');
            if (body.containsKey('position')) record.Position__c = (String)body.get('position');
            if (body.containsKey('jerseyNumber')) {
                record.Jersey_Number__c = body.get('jerseyNumber') != null
                    ? Decimal.valueOf(String.valueOf(body.get('jerseyNumber'))) : null;
            }
            if (body.containsKey('dateOfBirth')) {
                record.Date_of_Birth__c = body.get('dateOfBirth') != null
                    ? Date.valueOf((String)body.get('dateOfBirth')) : null;
            }
            if (body.containsKey('status')) record.Status__c = (String)body.get('status');
            if (body.containsKey('teamId')) record.Team__c = (String)body.get('teamId');

            service.updatePlayer(record);

            IPlayer updated = service.getPlayerByIdAsInterface(recordId);
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.success(RestResponseDto.createPlayerDto(updated))));
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }

    @HttpDelete
    global static void doDelete() {
        RestResponse res = RestContext.response;
        try {
            String recordId = RestUtils.extractIdFromUri(
                RestContext.request.requestURI, '/sportsmgmt/v1/players');
            if (String.isBlank(recordId)) {
                res.statusCode = 400;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.error('Player ID is required in the URL', 'VALIDATION_ERROR')));
                return;
            }

            service.deletePlayer(recordId);
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.success(null)));
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }
}