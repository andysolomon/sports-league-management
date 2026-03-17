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

    @HttpPut
    global static void doPut() {
        RestResponse res = RestContext.response;
        try {
            String recordId = RestUtils.extractIdFromUri(
                RestContext.request.requestURI, '/sportsmgmt/v1/teams');
            if (String.isBlank(recordId)) {
                res.statusCode = 400;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.error('Team ID is required in the URL', 'VALIDATION_ERROR')));
                return;
            }

            Map<String, Object> body = (Map<String, Object>)JSON.deserializeUntyped(
                RestContext.request.requestBody.toString());

            Team__c record = new Team__c(Id = recordId);
            if (body.containsKey('name')) record.Name = (String)body.get('name');
            if (body.containsKey('city')) record.City__c = (String)body.get('city');
            if (body.containsKey('stadium')) record.Stadium__c = (String)body.get('stadium');
            if (body.containsKey('foundedYear')) {
                record.Founded_Year__c = body.get('foundedYear') != null
                    ? Decimal.valueOf(String.valueOf(body.get('foundedYear'))) : null;
            }
            if (body.containsKey('location')) record.Location__c = (String)body.get('location');
            if (body.containsKey('divisionId')) record.Division__c = (String)body.get('divisionId');

            service.updateTeam(record);

            Team__c updated = service.getTeam(recordId);
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.success(RestResponseDto.createTeamDto(updated))));
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }
}