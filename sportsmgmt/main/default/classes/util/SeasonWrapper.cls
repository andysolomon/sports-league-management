/**
 * @description Wrapper class for Season__c records implementing ISeason interface
 * @author Sports Management Team
 * @date 2024
 */
public class SeasonWrapper implements ISeason {
    private Season__c originalRecord;
    private Id seasonId;
    private String seasonName;
    private Id leagueId;
    private Date startDate;
    private Date endDate;
    private String status;

    /**
     * Constructor that takes a Season__c record and wraps it
     */
    public SeasonWrapper(Season__c season) {
        if (season != null) {
            this.originalRecord = season;
            this.seasonId = season.Id;
            this.seasonName = season.Name;
            this.leagueId = season.League__c;
            this.startDate = season.Start_Date__c;
            this.endDate = season.End_Date__c;
            this.status = season.Status__c;
        }
    }

    /**
     * Constructor for creating new season instances
     */
    public SeasonWrapper(Id id, String name, Id leagueId, Date startDate, Date endDate, String status) {
        this.seasonId = id;
        this.seasonName = name;
        this.leagueId = leagueId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = status;
        this.originalRecord = null;
    }

    /**
     * Gets the record Id of the season.
     */
    public Id getId() {
        return this.seasonId;
    }

    /**
     * Gets the name of the season.
     */
    public String getName() {
        return this.seasonName;
    }

    /**
     * Gets the League Id that the season belongs to.
     */
    public Id getLeagueId() {
        return this.leagueId;
    }

    /**
     * Gets the start date of the season.
     */
    public Date getStartDate() {
        return this.startDate;
    }

    /**
     * Gets the end date of the season.
     */
    public Date getEndDate() {
        return this.endDate;
    }

    /**
     * Gets the status of the season.
     */
    public String getStatus() {
        return this.status;
    }

    /**
     * Gets the original Season__c record if available
     */
    public Season__c getOriginalRecord() {
        return this.originalRecord;
    }
}
