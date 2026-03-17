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
}