/**
 * @description Lightning controller for Division Management component
 * @author Sports Management Team
 * @date 2024
 */
public with sharing class DivisionManagementController {
    private static DivisionService divisionService = new DivisionService();

    /**
     * @description Sets the service instance for testing (dependency injection)
     * @param service The DivisionService instance to use
     */
    @TestVisible
    private static void setServiceForTesting(DivisionService service) {
        divisionService = service;
    }

    /**
     * @description Gets all divisions for selection
     * @return List of Division__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Division__c> getAllDivisions() {
        try {
            List<IDivision> divisions = divisionService.getAllDivisionsAsInterface();
            return convertToDivisionRecords(divisions);
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'getAllDivisions', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw in test mode for debugging
            }
            return null; // Return null instead of throwing for better LWC handling
        }
    }

    /**
     * @description Gets a specific division by ID
     * @param divisionId The ID of the division to retrieve
     * @return Division__c record
     */
    @AuraEnabled(cacheable=true)
    public static Division__c getDivisionById(String divisionId) {
        try {
            if (String.isBlank(divisionId)) {
                return null;
            }
            IDivision division = divisionService.getDivisionByIdAsInterface(divisionId);
            return division != null ? convertToDivisionRecord(division) : null;
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'getDivisionById', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw in test mode for debugging
            }
            return null; // Return null instead of throwing for better LWC handling
        }
    }

    /**
     * @description Gets divisions by league
     * @param leagueId The ID of the league
     * @return List of Division__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Division__c> getDivisionsByLeague(String leagueId) {
        try {
            if (String.isBlank(leagueId)) {
                return new List<Division__c>();
            }
            List<IDivision> divisions = divisionService.getDivisionsByLeagueAsInterface(leagueId);
            return convertToDivisionRecords(divisions);
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'getDivisionsByLeague', e);
            return new List<Division__c>(); // Return empty list instead of throwing
        }
    }
    
    /**
     * @description Creates a new division
     * @param divisionName The name of the division
     * @param leagueId The ID of the league
     * @return ID of the created division
     */
    @AuraEnabled
    public static String createDivision(String divisionName, String leagueId) {
        try {
            if (String.isBlank(divisionName) || String.isBlank(leagueId)) {
                throw new DivisionManagementException('Division name and league are required');
            }
            
            IDivision newDivision = new DivisionWrapper(null, divisionName, leagueId);
            Id divisionId = divisionService.createDivision(newDivision);
            return String.valueOf(divisionId);
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'createDivision', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw original exception in test mode for debugging
            }
            throw new AuraHandledException('Error creating division: ' + e.getMessage());
        }
    }
    
    /**
     * @description Updates an existing division
     * @param divisionId The ID of the division to update
     * @param divisionName The new name for the division
     * @param leagueId The new league ID for the division
     */
    @AuraEnabled
    public static void updateDivision(String divisionId, String divisionName, String leagueId) {
        try {
            if (String.isBlank(divisionId) || String.isBlank(divisionName) || String.isBlank(leagueId)) {
                throw new DivisionManagementException('Division ID, name, and league are required');
            }
            
            Division__c division = new Division__c(
                Id = divisionId,
                Name = divisionName,
                League__c = leagueId
            );
            divisionService.updateDivision(division);
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'updateDivision', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw original exception in test mode for debugging
            }
            throw new AuraHandledException('Error updating division: ' + e.getMessage());
        }
    }
    
    /**
     * @description Deletes a division
     * @param divisionId The ID of the division to delete
     */
    @AuraEnabled
    public static void deleteDivision(String divisionId) {
        try {
            if (String.isBlank(divisionId)) {
                throw new DivisionManagementException('Division ID is required');
            }
            
            divisionService.deleteDivision(divisionId);
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'deleteDivision', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw original exception in test mode for debugging
            }
            throw new AuraHandledException('Error deleting division: ' + e.getMessage());
        }
    }
    
    /**
     * @description Assigns a team to a division
     * @param teamId The ID of the team
     * @param divisionId The ID of the division (can be null to remove assignment)
     */
    @AuraEnabled
    public static void assignTeamToDivision(String teamId, String divisionId) {
        try {
            if (String.isBlank(teamId)) {
                throw new DivisionManagementException('Team ID is required');
            }
            
            divisionService.assignTeamToDivision(teamId, divisionId);
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'assignTeamToDivision', e);
            if (Test.isRunningTest()) {
                throw e; // Re-throw original exception in test mode for debugging
            }
            throw new AuraHandledException('Error assigning team to division: ' + e.getMessage());
        }
    }
    
    /**
     * @description Gets teams by division
     * @param divisionId The ID of the division
     * @return List of Team__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Team__c> getTeamsByDivision(String divisionId) {
        try {
            if (String.isBlank(divisionId)) {
                return new List<Team__c>();
            }
            return divisionService.getTeamsByDivision(divisionId);
        } catch (Exception e) {
            StructuredLogger.logError('DivisionManagementController', 'getTeamsByDivision', e);
            return new List<Team__c>(); // Return empty list instead of throwing
        }
    }

    /**
     * @description Converts a list of IDivision objects to Division__c records
     * @param divisions List of IDivision objects
     * @return List of Division__c records
     */
    private static List<Division__c> convertToDivisionRecords(List<IDivision> divisions) {
        List<Division__c> divisionRecords = new List<Division__c>();
        for (IDivision division : divisions) {
            divisionRecords.add(convertToDivisionRecord(division));
        }
        return divisionRecords;
    }

    /**
     * @description Converts an IDivision object to a Division__c record
     * @param division IDivision object
     * @return Division__c record
     */
    private static Division__c convertToDivisionRecord(IDivision division) {
        if (division == null) {
            return null;
        }

        // If it's a DivisionWrapper with an original record, return the original record
        if (division instanceof DivisionWrapper) {
            DivisionWrapper wrapper = (DivisionWrapper) division;
            Division__c originalRecord = wrapper.getOriginalRecord();
            if (originalRecord != null) {
                return originalRecord; // Return the original record with all fields and relationships
            }
        }

        // For mock testing or when no original record is available, reconstruct the Division__c record
        Division__c divisionRecord = new Division__c(
            Id = division.getId(), 
            Name = division.getName(), 
            League__c = division.getLeagueId()
        );

        // For testing with mock data, we need to populate additional fields
        if (Test.isRunningTest()) {
            // Create mock league relationship
            if (division.getLeagueId() != null) {
                divisionRecord.League__c = division.getLeagueId();
                // Note: We can't create League__r relationship in tests with hardcoded IDs
                // The relationship will be populated when the record is queried from the database
            }
        }

        return divisionRecord;
    }

    public class DivisionManagementException extends Exception {}
} 