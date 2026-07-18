/**
 * @description Lightning controller for Player Roster component
 * @author Sports Management Team
 * @date 2024
 */
public with sharing class PlayerRosterController {
    private static PlayerService playerService = new PlayerService();

    /**
     * @description Sets the service instance for testing (dependency injection)
     * @param service The PlayerService instance to use
     */
    @TestVisible
    private static void setServiceForTesting(PlayerService service) {
        playerService = service;
    }

    /**
     * @description Gets all players
     * @return List of Player__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Player__c> getAllPlayers() {
        try {
            List<IPlayer> players = playerService.getAllPlayersAsInterface();
            return convertToPlayerRecords(players);
        } catch (Exception e) {
            StructuredLogger.logError('PlayerRosterController', 'getAllPlayers', e);
            if (Test.isRunningTest()) {
                throw e;
            }
            return null;
        }
    }

    /**
     * @description Gets a specific player by ID
     * @param playerId The ID of the player to retrieve
     * @return Player__c record
     */
    @AuraEnabled(cacheable=true)
    public static Player__c getPlayerById(String playerId) {
        try {
            if (String.isBlank(playerId)) {
                return null;
            }
            IPlayer player = playerService.getPlayerByIdAsInterface(playerId);
            return player != null ? convertToPlayerRecord(player) : null;
        } catch (Exception e) {
            StructuredLogger.logError('PlayerRosterController', 'getPlayerById', e);
            if (Test.isRunningTest()) {
                throw e;
            }
            return null;
        }
    }

    /**
     * @description Gets players by team
     * @param teamId The ID of the team
     * @return List of Player__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Player__c> getPlayersByTeam(String teamId) {
        try {
            if (String.isBlank(teamId)) {
                return new List<Player__c>();
            }
            List<IPlayer> players = playerService.getPlayersByTeamAsInterface(teamId);
            return convertToPlayerRecords(players);
        } catch (Exception e) {
            StructuredLogger.logError('PlayerRosterController', 'getPlayersByTeam', e);
            return new List<Player__c>();
        }
    }

    /**
     * @description Creates a new player
     * @param playerName The name of the player
     * @param teamId The ID of the team
     * @param position The playing position
     * @param jerseyNumber The jersey number
     * @param dateOfBirth The date of birth
     * @param status The player status
     * @return ID of the created player
     */
    @AuraEnabled
    public static String createPlayer(String playerName, String teamId, String position, Decimal jerseyNumber, Date dateOfBirth, String status) {
        try {
            if (String.isBlank(playerName) || String.isBlank(teamId)) {
                throw new PlayerRosterException('Player name and team are required');
            }

            IPlayer newPlayer = new PlayerWrapper(null, playerName, teamId, position, jerseyNumber, dateOfBirth, status);
            Id playerId = playerService.createPlayer(newPlayer);
            return String.valueOf(playerId);
        } catch (Exception e) {
            StructuredLogger.logError('PlayerRosterController', 'createPlayer', e);
            if (Test.isRunningTest()) {
                throw e;
            }
            throw new AuraHandledException('Error creating player: ' + e.getMessage());
        }
    }

    /**
     * @description Updates an existing player
     * @param playerId The ID of the player to update
     * @param playerName The new name
     * @param teamId The new team ID
     * @param position The new position
     * @param jerseyNumber The new jersey number
     * @param dateOfBirth The new date of birth
     * @param status The new status
     */
    @AuraEnabled
    public static void updatePlayer(String playerId, String playerName, String teamId, String position, Decimal jerseyNumber, Date dateOfBirth, String status) {
        try {
            if (String.isBlank(playerId) || String.isBlank(playerName) || String.isBlank(teamId)) {
                throw new PlayerRosterException('Player ID, name, and team are required');
            }

            Player__c player = new Player__c(
                Id = playerId,
                Name = playerName,
                Team__c = teamId,
                Position__c = position,
                Jersey_Number__c = jerseyNumber,
                Date_of_Birth__c = dateOfBirth,
                Status__c = status
            );
            playerService.updatePlayer(player);
        } catch (Exception e) {
            StructuredLogger.logError('PlayerRosterController', 'updatePlayer', e);
            if (Test.isRunningTest()) {
                throw e;
            }
            throw new AuraHandledException('Error updating player: ' + e.getMessage());
        }
    }

    /**
     * @description Deletes a player
     * @param playerId The ID of the player to delete
     */
    @AuraEnabled
    public static void deletePlayer(String playerId) {
        try {
            if (String.isBlank(playerId)) {
                throw new PlayerRosterException('Player ID is required');
            }

            playerService.deletePlayer(playerId);
        } catch (Exception e) {
            StructuredLogger.logError('PlayerRosterController', 'deletePlayer', e);
            if (Test.isRunningTest()) {
                throw e;
            }
            throw new AuraHandledException('Error deleting player: ' + e.getMessage());
        }
    }

    /**
     * @description Converts a list of IPlayer objects to Player__c records
     * @param players List of IPlayer objects
     * @return List of Player__c records
     */
    private static List<Player__c> convertToPlayerRecords(List<IPlayer> players) {
        List<Player__c> playerRecords = new List<Player__c>();
        for (IPlayer player : players) {
            playerRecords.add(convertToPlayerRecord(player));
        }
        return playerRecords;
    }

    /**
     * @description Converts an IPlayer object to a Player__c record
     * @param player IPlayer object
     * @return Player__c record
     */
    private static Player__c convertToPlayerRecord(IPlayer player) {
        if (player == null) {
            return null;
        }

        // If it's a PlayerWrapper with an original record, return the original record
        if (player instanceof PlayerWrapper) {
            PlayerWrapper wrapper = (PlayerWrapper) player;
            Player__c originalRecord = wrapper.getOriginalRecord();
            if (originalRecord != null) {
                return originalRecord;
            }
        }

        // For mock testing or when no original record is available, reconstruct the Player__c record
        Player__c playerRecord = new Player__c(
            Id = player.getId(),
            Name = player.getName(),
            Team__c = player.getTeamId(),
            Position__c = player.getPosition(),
            Jersey_Number__c = player.getJerseyNumber(),
            Date_of_Birth__c = player.getDateOfBirth(),
            Status__c = player.getStatus()
        );

        return playerRecord;
    }

    public class PlayerRosterException extends Exception {}
}
