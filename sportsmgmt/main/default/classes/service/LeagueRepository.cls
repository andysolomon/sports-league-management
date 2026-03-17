/**
 * @description Repository class for League__c read operations
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class LeagueRepository {

    /**
     * Retrieves a League__c record by Id.
     */
    public virtual League__c retrieve(Id leagueId) {
        if (leagueId == null) {
            throw new LeagueRepositoryException('League Id cannot be null');
        }
        return [SELECT Id, Name FROM League__c WHERE Id = :leagueId LIMIT 1];
    }

    /**
     * Returns all leagues ordered by name.
     */
    public virtual List<League__c> getAllLeagues() {
        return [SELECT Id, Name FROM League__c ORDER BY Name LIMIT 50];
    }

    public class LeagueRepositoryException extends Exception {}
}