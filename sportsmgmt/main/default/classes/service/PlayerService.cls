/**
 * @description Service class for Player management with dependency injection support
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class PlayerService {
    private PlayerRepository repository;

    /**
     * Default constructor uses the standard repository implementation.
     */
    public PlayerService() {
        this(new PlayerRepository());
    }

    /**
     * Constructor for dependency injection (e.g., for tests).
     */
    public PlayerService(PlayerRepository repo) {
        if (repo == null) {
            throw new PlayerServiceException('Repository cannot be null');
        }
        this.repository = repo;
    }

    /**
     * Creates a new player and returns its Id.
     */
    public virtual Id createPlayer(IPlayer player) {
        return repository.create(player);
    }

    /**
     * Retrieves a player record by Id.
     */
    public virtual Player__c getPlayer(Id playerId) {
        return repository.retrieve(playerId);
    }

    /**
     * Updates a player using the provided Player__c sObject.
     */
    public virtual void updatePlayer(Player__c record) {
        repository.updatePlayer(record);
    }

    /**
     * Deletes a player by Id.
     */
    public virtual void deletePlayer(Id playerId) {
        repository.deletePlayer(playerId);
    }

    /**
     * Lists all players within a team.
     */
    public virtual List<Player__c> listPlayersByTeam(Id teamId) {
        return repository.listByTeam(teamId);
    }

    /**
     * Gets all players with full details.
     */
    public virtual List<Player__c> getAllPlayers() {
        return repository.getAllPlayers();
    }

    /**
     * Gets all players wrapped in IPlayer interface for Lightning components.
     */
    public virtual List<IPlayer> getAllPlayersAsInterface() {
        List<Player__c> players = repository.getAllPlayers();
        List<IPlayer> wrappedPlayers = new List<IPlayer>();
        for (Player__c player : players) {
            wrappedPlayers.add(new PlayerWrapper(player));
        }
        return wrappedPlayers;
    }

    /**
     * Gets a player by Id wrapped in IPlayer interface for Lightning components.
     */
    public virtual IPlayer getPlayerByIdAsInterface(String playerId) {
        if (String.isBlank(playerId)) {
            return null;
        }
        Player__c player = repository.retrieve(playerId);
        return player != null ? new PlayerWrapper(player) : null;
    }

    /**
     * Gets players by team wrapped in IPlayer interface for Lightning components.
     */
    public virtual List<IPlayer> getPlayersByTeamAsInterface(String teamId) {
        if (String.isBlank(teamId)) {
            return new List<IPlayer>();
        }
        List<Player__c> players = repository.listByTeam(teamId);
        List<IPlayer> wrappedPlayers = new List<IPlayer>();
        for (Player__c player : players) {
            wrappedPlayers.add(new PlayerWrapper(player));
        }
        return wrappedPlayers;
    }

    public class PlayerServiceException extends Exception {}
}
