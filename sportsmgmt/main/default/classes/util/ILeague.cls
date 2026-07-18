/**
 * @description Interface for League objects to support service layer abstraction
 * @author Sports Management Team
 * @date 2024
 */
public interface ILeague {
    /**
     * Gets the record Id of the league.
     */
    Id getId();

    /**
     * Gets the name of the league.
     */
    String getName();
}