/**
 * @description Repository class for Season__c CRUD operations
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class SeasonRepository {

    /**
     * Inserts a new Season__c record and returns the Id.
     */
    public virtual Id create(ISeason season) {
        if (season == null) {
            throw new SeasonRepositoryException('Season cannot be null');
        }

        Season__c record;
        // If it's a SeasonWrapper with an original record, use that for full field support
        if (season instanceof SeasonWrapper) {
            SeasonWrapper wrapper = (SeasonWrapper) season;
            Season__c originalRecord = wrapper.getOriginalRecord();
            if (originalRecord != null) {
                record = originalRecord.clone(false, false, false, false);
                // Apply current SeasonWrapper values to ensure we use the most up-to-date data
                record.Name = season.getName();
                record.League__c = season.getLeagueId();
                record.Start_Date__c = season.getStartDate();
                record.End_Date__c = season.getEndDate();
                record.Status__c = season.getStatus();
            } else {
                record = new Season__c(
                    Name = season.getName(),
                    League__c = season.getLeagueId(),
                    Start_Date__c = season.getStartDate(),
                    End_Date__c = season.getEndDate(),
                    Status__c = season.getStatus()
                );
            }
        } else {
            record = new Season__c(
                Name = season.getName(),
                League__c = season.getLeagueId(),
                Start_Date__c = season.getStartDate(),
                End_Date__c = season.getEndDate(),
                Status__c = season.getStatus()
            );
        }

        // Validate end date is on or after start date
        if (record.Start_Date__c != null && record.End_Date__c != null && record.End_Date__c < record.Start_Date__c) {
            throw new SeasonRepositoryException('End date must be on or after start date');
        }

        // Validate league-season name uniqueness
        validateUniqueSeasonName(record.Name, record.League__c, null);

        insert record;
        return record.Id;
    }

    /**
     * Retrieves a Season__c record by Id.
     */
    public virtual Season__c retrieve(Id seasonId) {
        if (seasonId == null) {
            throw new SeasonRepositoryException('Season Id cannot be null');
        }
        return [SELECT Id, Name, League__c, League__r.Name, Start_Date__c, End_Date__c, Status__c FROM Season__c WHERE Id = :seasonId LIMIT 1];
    }

    /**
     * Updates a Season__c record.
     */
    public virtual void updateSeason(Season__c record) {
        if (record == null || record.Id == null) {
            throw new SeasonRepositoryException('Invalid Season record');
        }

        // Validate league-season name uniqueness on update
        validateUniqueSeasonName(record.Name, record.League__c, record.Id);

        update record;
    }

    /**
     * Deletes a Season__c record.
     */
    public virtual void deleteSeason(Id seasonId) {
        if (seasonId == null) {
            throw new SeasonRepositoryException('Season Id cannot be null');
        }

        delete new Season__c(Id = seasonId);
    }

    /**
     * Returns all seasons in a league.
     */
    public virtual List<Season__c> listByLeague(Id leagueId) {
        if (leagueId == null) {
            return new List<Season__c>();
        }
        return [SELECT Id, Name, League__c, League__r.Name, Start_Date__c, End_Date__c, Status__c FROM Season__c WHERE League__c = :leagueId ORDER BY Start_Date__c DESC];
    }

    /**
     * Returns all seasons with full details.
     */
    public virtual List<Season__c> getAllSeasons() {
        return [SELECT Id, Name, League__c, League__r.Name, Start_Date__c, End_Date__c, Status__c FROM Season__c ORDER BY League__r.Name, Start_Date__c DESC LIMIT 50];
    }

    /**
     * Validates unique season name within a league
     */
    private void validateUniqueSeasonName(String seasonName, Id leagueId, Id excludeId) {
        if (String.isBlank(seasonName) || leagueId == null) {
            return;
        }

        String query = 'SELECT COUNT() FROM Season__c WHERE Name = :seasonName AND League__c = :leagueId';
        List<Object> parameters = new List<Object>{seasonName, leagueId};

        if (excludeId != null) {
            query += ' AND Id != :excludeId';
            parameters.add(excludeId);
        }

        Integer count = Database.countQuery(query);
        if (count > 0) {
            throw new SeasonRepositoryException('Season name must be unique within the league');
        }
    }

    public class SeasonRepositoryException extends Exception {}
}
