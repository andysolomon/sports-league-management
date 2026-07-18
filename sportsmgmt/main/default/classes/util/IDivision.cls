/**
 * @description Interface for Division objects to support service layer abstraction
 * @author Sports Management Team
 * @date 2024
 */
public interface IDivision {
    /**
     * Gets the record Id of the division.
     */
    Id getId();

    /**
     * Gets the name of the division.
     */
    String getName();

    /**
     * Gets the League Id that the division belongs to.
     */
    Id getLeagueId();
} 