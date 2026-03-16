/**
 * @description Interface for Season objects to support service layer abstraction
 * @author Sports Management Team
 * @date 2024
 */
public interface ISeason {
    /**
     * Gets the record Id of the season.
     */
    Id getId();

    /**
     * Gets the name of the season.
     */
    String getName();

    /**
     * Gets the League Id that the season belongs to.
     */
    Id getLeagueId();

    /**
     * Gets the start date of the season.
     */
    Date getStartDate();

    /**
     * Gets the end date of the season.
     */
    Date getEndDate();

    /**
     * Gets the status of the season.
     */
    String getStatus();
}
