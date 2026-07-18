/**
 * @description REST resource for Division data
 * @author Sports Management Team
 * @date 2024
 */
@RestResource(urlMapping='/sportsmgmt/v1/divisions/*')
global with sharing class DivisionRestResource {
    @TestVisible private static DivisionService service = new DivisionService();

    @HttpGet
    global static void doGet() {
        RestResponse res = RestContext.response;
        try {
            String recordId = RestUtils.extractIdFromUri(
                RestContext.request.requestURI, '/sportsmgmt/v1/divisions');
            if (recordId != null) {
                IDivision division = service.getDivisionByIdAsInterface(recordId);
                if (division == null) {
                    res.statusCode = 404;
                    res.responseBody = Blob.valueOf(JSON.serialize(
                        RestResponseDto.error('Division not found', 'NOT_FOUND')));
                    return;
                }
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createDivisionDto(division))));
            } else if (RestContext.request.params.containsKey('leagueId')) {
                String leagueId = RestContext.request.params.get('leagueId');
                List<IDivision> divisions = service.getDivisionsByLeagueAsInterface(leagueId);
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createDivisionDtoList(divisions))));
            } else {
                List<IDivision> divisions = service.getAllDivisionsAsInterface();
                res.statusCode = 200;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    RestResponseDto.success(RestResponseDto.createDivisionDtoList(divisions))));
            }
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                RestResponseDto.error(e.getMessage(), 'INTERNAL_ERROR')));
        }
    }
}