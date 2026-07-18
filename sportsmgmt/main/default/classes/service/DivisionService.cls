/**
 * @description Service class for Division management with dependency injection support
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class DivisionService {
    private DivisionRepository repository;

    /**
     * Default constructor uses the standard repository implementation.
     */
    public DivisionService() {
        this(new DivisionRepository());
    }

    /**
     * Constructor for dependency injection (e.g., for tests).
     */
    public DivisionService(DivisionRepository repo) {
        if (repo == null) {
            throw new DivisionServiceException('Repository cannot be null');
        }
        this.repository = repo;
    }

    /**
     * Creates a new division and returns its Id.
     */
    public virtual Id createDivision(IDivision division) {
        return repository.create(division);
    }

    /**
     * Retrieves a division record by Id.
     */
    public virtual Division__c getDivision(Id divisionId) {
        return repository.retrieve(divisionId);
    }

    /**
     * Updates a division using the provided Division__c sObject.
     */
    public virtual void updateDivision(Division__c record) {
        repository.updateDivision(record);
    }

    /**
     * Deletes a division by Id.
     */
    public virtual void deleteDivision(Id divisionId) {
        repository.deleteDivision(divisionId);
    }

    /**
     * Lists all divisions within a league.
     */
    public virtual List<Division__c> listDivisionsByLeague(Id leagueId) {
        return repository.listByLeague(leagueId);
    }

    /**
     * Gets all divisions with full details.
     */
    public virtual List<Division__c> getAllDivisions() {
        return repository.getAllDivisions();
    }

    /**
     * Gets all divisions wrapped in IDivision interface for Lightning components.
     */
    public virtual List<IDivision> getAllDivisionsAsInterface() {
        List<Division__c> divisions = repository.getAllDivisions();
        List<IDivision> wrappedDivisions = new List<IDivision>();
        for (Division__c division : divisions) {
            wrappedDivisions.add(new DivisionWrapper(division));
        }
        return wrappedDivisions;
    }

    /**
     * Gets a division by Id wrapped in IDivision interface for Lightning components.
     */
    public virtual IDivision getDivisionByIdAsInterface(String divisionId) {
        if (String.isBlank(divisionId)) {
            return null;
        }
        Division__c division = repository.retrieve(divisionId);
        return division != null ? new DivisionWrapper(division) : null;
    }

    /**
     * Gets divisions by league wrapped in IDivision interface for Lightning components.
     */
    public virtual List<IDivision> getDivisionsByLeagueAsInterface(String leagueId) {
        if (String.isBlank(leagueId)) {
            return new List<IDivision>();
        }
        List<Division__c> divisions = repository.listByLeague(leagueId);
        List<IDivision> wrappedDivisions = new List<IDivision>();
        for (Division__c division : divisions) {
            wrappedDivisions.add(new DivisionWrapper(division));
        }
        return wrappedDivisions;
    }
    
    /**
     * Assigns a team to a division
     */
    public virtual void assignTeamToDivision(Id teamId, Id divisionId) {
        repository.assignTeamToDivision(teamId, divisionId);
    }
    
    /**
     * Gets teams by division
     */
    public virtual List<Team__c> getTeamsByDivision(Id divisionId) {
        return repository.getTeamsByDivision(divisionId);
    }
    
    /**
     * Moves a team from one division to another
     */
    public virtual void moveTeamToDivision(Id teamId, Id newDivisionId) {
        repository.assignTeamToDivision(teamId, newDivisionId);
    }
    
    /**
     * Removes a team from its current division (sets Division__c to null)
     */
    public virtual void removeTeamFromDivision(Id teamId) {
        repository.assignTeamToDivision(teamId, null);
    }

    public class DivisionServiceException extends Exception {}
} 