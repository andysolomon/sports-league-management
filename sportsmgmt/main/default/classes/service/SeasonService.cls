/**
 * @description Service class for Season management with dependency injection support
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class SeasonService {
    private SeasonRepository repository;

    /**
     * Default constructor uses the standard repository implementation.
     */
    public SeasonService() {
        this(new SeasonRepository());
    }

    /**
     * Constructor for dependency injection (e.g., for tests).
     */
    public SeasonService(SeasonRepository repo) {
        if (repo == null) {
            throw new SeasonServiceException('Repository cannot be null');
        }
        this.repository = repo;
    }

    /**
     * Creates a new season and returns its Id.
     */
    public virtual Id createSeason(ISeason season) {
        return repository.create(season);
    }

    /**
     * Retrieves a season record by Id.
     */
    public virtual Season__c getSeason(Id seasonId) {
        return repository.retrieve(seasonId);
    }

    /**
     * Updates a season using the provided Season__c sObject.
     */
    public virtual void updateSeason(Season__c record) {
        repository.updateSeason(record);
    }

    /**
     * Deletes a season by Id.
     */
    public virtual void deleteSeason(Id seasonId) {
        repository.deleteSeason(seasonId);
    }

    /**
     * Lists all seasons within a league.
     */
    public virtual List<Season__c> listSeasonsByLeague(Id leagueId) {
        return repository.listByLeague(leagueId);
    }

    /**
     * Gets all seasons with full details.
     */
    public virtual List<Season__c> getAllSeasons() {
        return repository.getAllSeasons();
    }

    /**
     * Gets all seasons wrapped in ISeason interface for Lightning components.
     */
    public virtual List<ISeason> getAllSeasonsAsInterface() {
        List<Season__c> seasons = repository.getAllSeasons();
        List<ISeason> wrappedSeasons = new List<ISeason>();
        for (Season__c season : seasons) {
            wrappedSeasons.add(new SeasonWrapper(season));
        }
        return wrappedSeasons;
    }

    /**
     * Gets a season by Id wrapped in ISeason interface for Lightning components.
     */
    public virtual ISeason getSeasonByIdAsInterface(String seasonId) {
        if (String.isBlank(seasonId)) {
            return null;
        }
        Season__c season = repository.retrieve(seasonId);
        return season != null ? new SeasonWrapper(season) : null;
    }

    /**
     * Gets seasons by league wrapped in ISeason interface for Lightning components.
     */
    public virtual List<ISeason> getSeasonsByLeagueAsInterface(String leagueId) {
        if (String.isBlank(leagueId)) {
            return new List<ISeason>();
        }
        List<Season__c> seasons = repository.listByLeague(leagueId);
        List<ISeason> wrappedSeasons = new List<ISeason>();
        for (Season__c season : seasons) {
            wrappedSeasons.add(new SeasonWrapper(season));
        }
        return wrappedSeasons;
    }

    public class SeasonServiceException extends Exception {}
}
