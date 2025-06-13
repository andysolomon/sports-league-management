public virtual class TeamRepository {
    /**
     * Inserts a new Team__c record and returns the Id.
     */
    public virtual Id create(ITeam team) {
        if (team == null) {
            throw new TeamRepositoryException('Team cannot be null');
        }
        Team__c record = new Team__c(
            Name = team.getName(),
            League__c = team.getLeagueId()
        );
        insert record;
        return record.Id;
    }

    /**
     * Retrieves a Team__c record by Id.
     */
    public virtual Team__c retrieve(Id teamId) {
        if (teamId == null) {
            throw new TeamRepositoryException('Team Id cannot be null');
        }
        return [SELECT Id, Name, City__c, Stadium__c, Founded_Year__c, League__c, League__r.Name FROM Team__c WHERE Id = :teamId LIMIT 1];
    }

    /**
     * Updates a Team__c record.
     */
    public virtual void updateTeam(Team__c record) {
        if (record == null || record.Id == null) {
            throw new TeamRepositoryException('Invalid Team record');
        }
        update record;
    }

    /**
     * Deletes a Team__c record.
     */
    public virtual void deleteTeam(Id teamId) {
        delete new Team__c(Id = teamId);
    }

    /**
     * Returns all teams in a league.
     */
    public virtual List<Team__c> listByLeague(Id leagueId) {
        return [SELECT Id, Name, City__c, Stadium__c, Founded_Year__c, League__c, League__r.Name FROM Team__c WHERE League__c = :leagueId];
    }

    /**
     * Returns all teams with full details.
     */
    public virtual List<Team__c> getAllTeams() {
        return [SELECT Id, Name, City__c, Stadium__c, Founded_Year__c, League__c, League__r.Name FROM Team__c ORDER BY Name LIMIT 50];
    }

    public class TeamRepositoryException extends Exception {}
} 