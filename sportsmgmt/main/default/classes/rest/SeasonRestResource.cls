/**
 * @description REST resource for Season data
 * @author Sports Management Team
 * @date 2024
 */
@RestResource(urlMapping='/sportsmgmt/v1/seasons/*')
global with sharing class SeasonRestResource {
    @TestVisible private static SeasonService service = new SeasonService();

    @HttpGet
    global static void doGet() {
        RestResponse res = RestContext.response;
        try {
            String recordId = RestUtils.extractIdFromUri(
                RestContext.request.requestURI, '/sportsmgmt/v1/seasons');
            if (recordId != null) {
                ISeason season = service.getSeasonByIdAsInterface(recordId);
                if (season == null) {
                    res.statusCode = 404;
                    res.responseBody = Blob.valueOf(JSON.serialize(
                        RestResponseDto.error('Season not found', 'NOT_FOUND')));
                    return;
                }
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createSeasonDto(season))));
            } else if (RestContext.request.params.containsKey('leagueId')) {
                String leagueId = RestContext.request.params.get('leagueId');
                List<ISeason> seasons = service.getSeasonsByLeagueAsInterface(leagueId);
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createSeasonDtoList(seasons))));
            } else {
                List<ISeason> seasons = service.getAllSeasonsAsInterface();
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createSeasonDtoList(seasons))));
            }
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }
}