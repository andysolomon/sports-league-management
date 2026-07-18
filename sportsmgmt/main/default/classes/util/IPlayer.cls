public interface IPlayer {
    /**
     * Gets the record Id of the player.
     */
    Id getId();

    /**
     * Gets the name of the player.
     */
    String getName();

    /**
     * Gets the Team Id that the player belongs to.
     */
    Id getTeamId();

    /**
     * Gets the playing position of the player.
     */
    String getPosition();

    /**
     * Gets the jersey number of the player.
     */
    Decimal getJerseyNumber();

    /**
     * Gets the date of birth of the player.
     */
    Date getDateOfBirth();

    /**
     * Gets the current status of the player.
     */
    String getStatus();
}
