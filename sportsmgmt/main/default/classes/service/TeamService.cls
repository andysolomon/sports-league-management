public virtual with sharing class TeamService {
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
    public virtual Id createTeam(ITeam team) {
        return repository.create(team);
    }

    /**
     * Retrieves a team record by Id.
     */
    public virtual Team__c getTeam(Id teamId) {
        return repository.retrieve(teamId);
    }

    /**
     * Updates a team using the provided Team__c sObject.
     */
    public virtual void updateTeam(Team__c record) {
        repository.updateTeam(record);
    }

    /**
     * Deletes a team by Id.
     */
    public virtual void deleteTeam(Id teamId) {
        repository.deleteTeam(teamId);
    }

    /**
     * Lists all teams within a league.
     */
    public virtual List<Team__c> listTeamsByLeague(Id leagueId) {
        return repository.listByLeague(leagueId);
    }

    /**
     * Gets all teams with full details.
     */
    public virtual List<Team__c> getAllTeams() {
        return repository.getAllTeams();
    }

    /**
     * Gets all teams wrapped in ITeam interface for Lightning components.
     */
    public virtual List<ITeam> getAllTeamsAsInterface() {
        List<Team__c> teams = repository.getAllTeams();
        List<ITeam> wrappedTeams = new List<ITeam>();
        for (Team__c team : teams) {
            wrappedTeams.add(new TeamWrapper(team));
        }
        return wrappedTeams;
    }

    /**
     * Gets a team by Id wrapped in ITeam interface for Lightning components.
     */
    public virtual ITeam getTeamByIdAsInterface(String teamId) {
        if (String.isBlank(teamId)) {
            return null;
        }
        Team__c team = repository.retrieve(teamId);
        return team != null ? new TeamWrapper(team) : null;
    }

    /**
     * Gets teams by league wrapped in ITeam interface for Lightning components.
     */
    public virtual List<ITeam> getTeamsByLeagueAsInterface(String leagueId) {
        if (String.isBlank(leagueId)) {
            return new List<ITeam>();
        }
        List<Team__c> teams = repository.listByLeague(leagueId);
        List<ITeam> wrappedTeams = new List<ITeam>();
        for (Team__c team : teams) {
            wrappedTeams.add(new TeamWrapper(team));
        }
        return wrappedTeams;
    }

    public class TeamServiceException extends Exception {}
} 