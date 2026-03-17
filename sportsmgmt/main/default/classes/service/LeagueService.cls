/**
 * @description Service class for League management with dependency injection support
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class LeagueService {
    private LeagueRepository repository;

    /**
     * Default constructor uses the standard repository implementation.
     */
    public LeagueService() {
        this(new LeagueRepository());
    }

    /**
     * Constructor for dependency injection (e.g., for tests).
     */
    public LeagueService(LeagueRepository repo) {
        if (repo == null) {
            throw new LeagueServiceException('Repository cannot be null');
        }
        this.repository = repo;
    }

    /**
     * Gets all leagues wrapped in ILeague interface.
     */
    public virtual List<ILeague> getAllLeaguesAsInterface() {
        List<League__c> leagues = repository.getAllLeagues();
        List<ILeague> wrappedLeagues = new List<ILeague>();
        for (League__c league : leagues) {
            wrappedLeagues.add(new LeagueWrapper(league));
        }
        return wrappedLeagues;
    }

    /**
     * Gets a league by Id wrapped in ILeague interface.
     */
    public virtual ILeague getLeagueByIdAsInterface(String leagueId) {
        if (String.isBlank(leagueId)) {
            return null;
        }
        League__c league = repository.retrieve(leagueId);
        return league != null ? new LeagueWrapper(league) : null;
    }

    public class LeagueServiceException extends Exception {}
}