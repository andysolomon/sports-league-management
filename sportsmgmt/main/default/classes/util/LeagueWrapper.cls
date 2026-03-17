/**
 * @description Wrapper class for League__c records implementing ILeague interface
 * @author Sports Management Team
 * @date 2024
 */
public class LeagueWrapper implements ILeague {
    private League__c originalRecord;
    private Id leagueId;
    private String leagueName;

    /**
     * Constructor that takes a League__c record and wraps it
     */
    public LeagueWrapper(League__c league) {
        if (league != null) {
            this.originalRecord = league;
            this.leagueId = league.Id;
            this.leagueName = league.Name;
        }
    }

    /**
     * Constructor for creating new league instances
     */
    public LeagueWrapper(Id id, String name) {
        this.leagueId = id;
        this.leagueName = name;
        this.originalRecord = null;
    }

    /**
     * Gets the record Id of the league.
     */
    public Id getId() {
        return this.leagueId;
    }

    /**
     * Gets the name of the league.
     */
    public String getName() {
        return this.leagueName;
    }

    /**
     * Gets the original League__c record if available
     */
    public League__c getOriginalRecord() {
        return this.originalRecord;
    }
}