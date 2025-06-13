/**
 * @description Wrapper class for Division__c records implementing IDivision interface
 * @author Sports Management Team
 * @date 2024
 */
public class DivisionWrapper implements IDivision {
    private Division__c originalRecord;
    private Id divisionId;
    private String divisionName;
    private Id leagueId;
    
    /**
     * Constructor that takes a Division__c record and wraps it
     */
    public DivisionWrapper(Division__c division) {
        if (division != null) {
            this.originalRecord = division;
            this.divisionId = division.Id;
            this.divisionName = division.Name;
            this.leagueId = division.League__c;
        }
    }
    
    /**
     * Constructor for creating new division instances
     */
    public DivisionWrapper(Id id, String name, Id leagueId) {
        this.divisionId = id;
        this.divisionName = name;
        this.leagueId = leagueId;
        this.originalRecord = null;
    }
    
    /**
     * Gets the record Id of the division.
     */
    public Id getId() {
        return this.divisionId;
    }

    /**
     * Gets the name of the division.
     */
    public String getName() {
        return this.divisionName;
    }

    /**
     * Gets the League Id that the division belongs to.
     */
    public Id getLeagueId() {
        return this.leagueId;
    }
    
    /**
     * Gets the original Division__c record if available
     */
    public Division__c getOriginalRecord() {
        return this.originalRecord;
    }
} 