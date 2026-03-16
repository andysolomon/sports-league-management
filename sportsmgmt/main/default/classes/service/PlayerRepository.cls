/**
 * @description Repository class for Player__c CRUD operations
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class PlayerRepository {

    /**
     * Inserts a new Player__c record and returns the Id.
     */
    public virtual Id create(IPlayer player) {
        if (player == null) {
            throw new PlayerRepositoryException('Player cannot be null');
        }

        Player__c record;
        if (player instanceof PlayerWrapper) {
            PlayerWrapper wrapper = (PlayerWrapper) player;
            Player__c originalRecord = wrapper.getOriginalRecord();
            if (originalRecord != null) {
                record = originalRecord.clone(false, false, false, false);
                record.Name = player.getName();
                record.Team__c = player.getTeamId();
                record.Position__c = player.getPosition();
                record.Jersey_Number__c = player.getJerseyNumber();
                record.Date_of_Birth__c = player.getDateOfBirth();
                record.Status__c = player.getStatus();
            } else {
                record = new Player__c(
                    Name = player.getName(),
                    Team__c = player.getTeamId(),
                    Position__c = player.getPosition(),
                    Jersey_Number__c = player.getJerseyNumber(),
                    Date_of_Birth__c = player.getDateOfBirth(),
                    Status__c = player.getStatus()
                );
            }
        } else {
            record = new Player__c(
                Name = player.getName(),
                Team__c = player.getTeamId(),
                Position__c = player.getPosition(),
                Jersey_Number__c = player.getJerseyNumber(),
                Date_of_Birth__c = player.getDateOfBirth(),
                Status__c = player.getStatus()
            );
        }

        // Validate unique jersey number per team
        validateUniqueJerseyNumber(record.Jersey_Number__c, record.Team__c, null);

        insert record;
        return record.Id;
    }

    /**
     * Retrieves a Player__c record by Id.
     */
    public virtual Player__c retrieve(Id playerId) {
        if (playerId == null) {
            throw new PlayerRepositoryException('Player Id cannot be null');
        }
        return [SELECT Id, Name, Team__c, Team__r.Name, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c FROM Player__c WHERE Id = :playerId LIMIT 1];
    }

    /**
     * Updates a Player__c record.
     */
    public virtual void updatePlayer(Player__c record) {
        if (record == null || record.Id == null) {
            throw new PlayerRepositoryException('Invalid Player record');
        }

        // Validate unique jersey number per team on update
        validateUniqueJerseyNumber(record.Jersey_Number__c, record.Team__c, record.Id);

        update record;
    }

    /**
     * Deletes a Player__c record.
     */
    public virtual void deletePlayer(Id playerId) {
        if (playerId == null) {
            throw new PlayerRepositoryException('Player Id cannot be null');
        }

        delete new Player__c(Id = playerId);
    }

    /**
     * Returns all players on a team.
     */
    public virtual List<Player__c> listByTeam(Id teamId) {
        if (teamId == null) {
            return new List<Player__c>();
        }
        return [SELECT Id, Name, Team__c, Team__r.Name, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c FROM Player__c WHERE Team__c = :teamId ORDER BY Name];
    }

    /**
     * Returns all players with full details.
     */
    public virtual List<Player__c> getAllPlayers() {
        return [SELECT Id, Name, Team__c, Team__r.Name, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c FROM Player__c ORDER BY Team__r.Name, Name LIMIT 50];
    }

    /**
     * Validates unique jersey number within a team
     */
    private void validateUniqueJerseyNumber(Decimal jerseyNumber, Id teamId, Id excludeId) {
        if (jerseyNumber == null || teamId == null) {
            return;
        }

        String query = 'SELECT COUNT() FROM Player__c WHERE Jersey_Number__c = :jerseyNumber AND Team__c = :teamId';

        if (excludeId != null) {
            query += ' AND Id != :excludeId';
        }

        Integer count = Database.countQuery(query);
        if (count > 0) {
            throw new PlayerRepositoryException('Jersey number must be unique within the team');
        }
    }

    public class PlayerRepositoryException extends Exception {}
}
