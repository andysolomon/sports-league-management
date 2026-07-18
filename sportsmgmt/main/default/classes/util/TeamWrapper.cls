public class TeamWrapper extends AbstractTeam {
    private Team__c originalRecord;
    
    /**
     * Constructor that takes a Team__c record and wraps it
     */
    public TeamWrapper(Team__c team) {
        super(team.Id, team.Name, team.League__c);
        this.originalRecord = team;
    }
    
    /**
     * Constructor for creating new team instances
     */
    public TeamWrapper(Id id, String name, Id leagueId) {
        super(id, name, leagueId);
        this.originalRecord = null;
    }
    
    /**
     * Gets the original Team__c record if available
     */
    public Team__c getOriginalRecord() {
        return this.originalRecord;
    }
} 