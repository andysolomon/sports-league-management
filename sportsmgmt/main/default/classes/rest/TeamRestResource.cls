/**
 * @description REST resource for Team data
 * @author Sports Management Team
 * @date 2024
 */
@RestResource(urlMapping='/sportsmgmt/v1/teams/*')
global with sharing class TeamRestResource {
    @TestVisible private static TeamService service = new TeamService();

    @HttpGet
    global static void doGet() {
        RestResponse res = RestContext.response;
        try {
            String recordId = RestUtils.extractIdFromUri(
                RestContext.request.requestURI, '/sportsmgmt/v1/teams');
            if (recordId != null) {
                Team__c team = service.getTeam(recordId);
                if (team == null) {
                    res.statusCode = 404;
                    res.responseBody = Blob.valueOf(JSON.serialize(
                        RestResponseDto.error('Team not found', 'NOT_FOUND')));
                    return;
                }
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createTeamDto(team))));
            } else if (RestContext.request.params.containsKey('leagueId')) {
                String leagueId = RestContext.request.params.get('leagueId');
                List<Team__c> teams = service.listTeamsByLeague(leagueId);
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createTeamDtoList(teams))));
            } else {
                List<Team__c> teams = service.getAllTeams();
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createTeamDtoList(teams))));
            }
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }
}