public interface ITeam {
    /**
     * Gets the record Id of the team.
     */
    Id getId();

    /**
     * Gets the name of the team.
     */
    String getName();

    /**
     * Gets the League Id that the team belongs to.
     */
    Id getLeagueId();
} 