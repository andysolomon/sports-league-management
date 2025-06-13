/**
 * @description Lightning controller for Team Details component
 * @author Sports Management Team
 * @date 2024
 */
public with sharing class TeamDetailsController {
    private static TeamService teamService = new TeamService();

    /**
     * @description Gets all teams for selection
     * @return List of Team__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Team__c> getAllTeams() {
        try {
            return teamService.getAllTeams();
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving teams: ' + e.getMessage());
        }
    }

    /**
     * @description Gets a specific team by ID
     * @param teamId The ID of the team to retrieve
     * @return Team__c record
     */
    @AuraEnabled(cacheable=true)
    public static Team__c getTeamById(Id teamId) {
        try {
            if (teamId == null) {
                throw new AuraHandledException('Team ID cannot be null');
            }
            return teamService.getTeam(teamId);
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving team: ' + e.getMessage());
        }
    }

    /**
     * @description Gets teams by league
     * @param leagueId The ID of the league
     * @return List of Team__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Team__c> getTeamsByLeague(Id leagueId) {
        try {
            if (leagueId == null) {
                throw new AuraHandledException('League ID cannot be null');
            }
            return teamService.listTeamsByLeague(leagueId);
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving teams by league: ' + e.getMessage());
        }
    }
} 