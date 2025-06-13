public with sharing class TeamService {
    private TeamRepository repository;

    /**
     * Default constructor uses the standard repository implementation.
     */
    public TeamService() {
        this(new TeamRepository());
    }

    /**
     * Constructor for dependency injection (e.g., for tests).
     */
    public TeamService(TeamRepository repo) {
        if (repo == null) {
            throw new TeamServiceException('Repository cannot be null');
        }
        this.repository = repo;
    }

    /**
     * Creates a new team and returns its Id.
     */
    public Id createTeam(ITeam team) {
        return repository.create(team);
    }

    /**
     * Retrieves a team record by Id.
     */
    public Team__c getTeam(Id teamId) {
        return repository.retrieve(teamId);
    }

    /**
     * Updates a team using the provided Team__c sObject.
     */
    public void updateTeam(Team__c record) {
        repository.updateTeam(record);
    }

    /**
     * Deletes a team by Id.
     */
    public void deleteTeam(Id teamId) {
        repository.deleteTeam(teamId);
    }

    /**
     * Lists all teams within a league.
     */
    public List<Team__c> listTeamsByLeague(Id leagueId) {
        return repository.listByLeague(leagueId);
    }

    public class TeamServiceException extends Exception {}
} 