/**
 * @description Lightning controller for Season Management component
 * @author Sports Management Team
 * @date 2024
 */
public with sharing class SeasonManagementController {
    private static SeasonService seasonService = new SeasonService();

    /**
     * @description Sets the service instance for testing (dependency injection)
     * @param service The SeasonService instance to use
     */
    @TestVisible
    private static void setServiceForTesting(SeasonService service) {
        seasonService = service;
    }

    /**
     * @description Gets all seasons
     * @return List of Season__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Season__c> getAllSeasons() {
        try {
            List<ISeason> seasons = seasonService.getAllSeasonsAsInterface();
            return convertToSeasonRecords(seasons);
        } catch (Exception e) {
            StructuredLogger.logError('SeasonManagementController', 'getAllSeasons', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw in test mode for debugging
            }
            return null; // Return null instead of throwing for better LWC handling
        }
    }

    /**
     * @description Gets a specific season by ID
     * @param seasonId The ID of the season to retrieve
     * @return Season__c record
     */
    @AuraEnabled(cacheable=true)
    public static Season__c getSeasonById(String seasonId) {
        try {
            if (String.isBlank(seasonId)) {
                return null;
            }
            ISeason season = seasonService.getSeasonByIdAsInterface(seasonId);
            return season != null ? convertToSeasonRecord(season) : null;
        } catch (Exception e) {
            StructuredLogger.logError('SeasonManagementController', 'getSeasonById', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw in test mode for debugging
            }
            return null; // Return null instead of throwing for better LWC handling
        }
    }

    /**
     * @description Gets seasons by league
     * @param leagueId The ID of the league
     * @return List of Season__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Season__c> getSeasonsByLeague(String leagueId) {
        try {
            if (String.isBlank(leagueId)) {
                return new List<Season__c>();
            }
            List<ISeason> seasons = seasonService.getSeasonsByLeagueAsInterface(leagueId);
            return convertToSeasonRecords(seasons);
        } catch (Exception e) {
            StructuredLogger.logError('SeasonManagementController', 'getSeasonsByLeague', e);
            return new List<Season__c>(); // Return empty list instead of throwing
        }
    }

    /**
     * @description Creates a new season
     * @param seasonName The name of the season
     * @param leagueId The ID of the league
     * @param startDate The start date of the season
     * @param endDate The end date of the season
     * @param status The status of the season
     * @return ID of the created season
     */
    @AuraEnabled
    public static String createSeason(String seasonName, String leagueId, Date startDate, Date endDate, String status) {
        try {
            if (String.isBlank(seasonName) || String.isBlank(leagueId)) {
                throw new SeasonManagementException('Season name and league are required');
            }

            ISeason newSeason = new SeasonWrapper(null, seasonName, leagueId, startDate, endDate, status);
            Id seasonId = seasonService.createSeason(newSeason);
            return String.valueOf(seasonId);
        } catch (Exception e) {
            StructuredLogger.logError('SeasonManagementController', 'createSeason', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw original exception in test mode for debugging
            }
            throw new AuraHandledException('Error creating season: ' + e.getMessage());
        }
    }

    /**
     * @description Updates an existing season
     * @param seasonId The ID of the season to update
     * @param seasonName The new name for the season
     * @param leagueId The new league ID for the season
     * @param startDate The new start date
     * @param endDate The new end date
     * @param status The new status
     */
    @AuraEnabled
    public static void updateSeason(String seasonId, String seasonName, String leagueId, Date startDate, Date endDate, String status) {
        try {
            if (String.isBlank(seasonId) || String.isBlank(seasonName) || String.isBlank(leagueId)) {
                throw new SeasonManagementException('Season ID, name, and league are required');
            }

            Season__c season = new Season__c(
                Id = seasonId,
                Name = seasonName,
                League__c = leagueId,
                Start_Date__c = startDate,
                End_Date__c = endDate,
                Status__c = status
            );
            seasonService.updateSeason(season);
        } catch (Exception e) {
            StructuredLogger.logError('SeasonManagementController', 'updateSeason', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw original exception in test mode for debugging
            }
            throw new AuraHandledException('Error updating season: ' + e.getMessage());
        }
    }

    /**
     * @description Deletes a season
     * @param seasonId The ID of the season to delete
     */
    @AuraEnabled
    public static void deleteSeason(String seasonId) {
        try {
            if (String.isBlank(seasonId)) {
                throw new SeasonManagementException('Season ID is required');
            }

            seasonService.deleteSeason(seasonId);
        } catch (Exception e) {
            StructuredLogger.logError('SeasonManagementController', 'deleteSeason', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw original exception in test mode for debugging
            }
            throw new AuraHandledException('Error deleting season: ' + e.getMessage());
        }
    }

    /**
     * @description Converts a list of ISeason objects to Season__c records
     * @param seasons List of ISeason objects
     * @return List of Season__c records
     */
    private static List<Season__c> convertToSeasonRecords(List<ISeason> seasons) {
        List<Season__c> seasonRecords = new List<Season__c>();
        for (ISeason season : seasons) {
            seasonRecords.add(convertToSeasonRecord(season));
        }
        return seasonRecords;
    }

    /**
     * @description Converts an ISeason object to a Season__c record
     * @param season ISeason object
     * @return Season__c record
     */
    private static Season__c convertToSeasonRecord(ISeason season) {
        if (season == null) {
            return null;
        }

        // If it's a SeasonWrapper with an original record, return the original record
        if (season instanceof SeasonWrapper) {
            SeasonWrapper wrapper = (SeasonWrapper) season;
            Season__c originalRecord = wrapper.getOriginalRecord();
            if (originalRecord != null) {
                return originalRecord; // Return the original record with all fields and relationships
            }
        }

        // For mock testing or when no original record is available, reconstruct the Season__c record
        Season__c seasonRecord = new Season__c(
            Id = season.getId(),
            Name = season.getName(),
            League__c = season.getLeagueId(),
            Start_Date__c = season.getStartDate(),
            End_Date__c = season.getEndDate(),
            Status__c = season.getStatus()
        );

        return seasonRecord;
    }

    public class SeasonManagementException extends Exception {}
}