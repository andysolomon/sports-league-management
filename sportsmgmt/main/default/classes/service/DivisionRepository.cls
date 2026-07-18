/**
 * @description Repository class for Division__c CRUD operations
 * @author Sports Management Team
 * @date 2024
 */
public virtual with sharing class DivisionRepository {
    
    /**
     * Inserts a new Division__c record and returns the Id.
     */
    public virtual Id create(IDivision division) {
        if (division == null) {
            throw new DivisionRepositoryException('Division cannot be null');
        }
        
        Division__c record;
        // If it's a DivisionWrapper with an original record, use that for full field support
        if (division instanceof DivisionWrapper) {
            DivisionWrapper wrapper = (DivisionWrapper) division;
            Division__c originalRecord = wrapper.getOriginalRecord();
            if (originalRecord != null) {
                record = originalRecord.clone(false, false, false, false);
                // Apply current DivisionWrapper values to ensure we use the most up-to-date data
                record.Name = division.getName();
                record.League__c = division.getLeagueId();
            } else {
                record = new Division__c(
                    Name = division.getName(),
                    League__c = division.getLeagueId()
                );
            }
        } else {
            record = new Division__c(
                Name = division.getName(),
                League__c = division.getLeagueId()
            );
        }
        
        // Validate league-division uniqueness
        validateUniqueDivisionName(record.Name, record.League__c, null);
        
        insert record;
        return record.Id;
    }

    /**
     * Retrieves a Division__c record by Id.
     */
    public virtual Division__c retrieve(Id divisionId) {
        if (divisionId == null) {
            throw new DivisionRepositoryException('Division Id cannot be null');
        }
        return [SELECT Id, Name, League__c, League__r.Name FROM Division__c WHERE Id = :divisionId LIMIT 1];
    }

    /**
     * Updates a Division__c record.
     */
    public virtual void updateDivision(Division__c record) {
        if (record == null || record.Id == null) {
            throw new DivisionRepositoryException('Invalid Division record');
        }
        
        // Validate league-division uniqueness on update
        validateUniqueDivisionName(record.Name, record.League__c, record.Id);
        
        update record;
    }

    /**
     * Deletes a Division__c record.
     */
    public virtual void deleteDivision(Id divisionId) {
        if (divisionId == null) {
            throw new DivisionRepositoryException('Division Id cannot be null');
        }
        
        // Check if division has teams assigned
        Integer teamCount = [SELECT COUNT() FROM Team__c WHERE Division__c = :divisionId];
        if (teamCount > 0) {
            throw new DivisionRepositoryException('Cannot delete division with assigned teams. Please reassign teams first.');
        }
        
        delete new Division__c(Id = divisionId);
    }

    /**
     * Returns all divisions in a league.
     */
    public virtual List<Division__c> listByLeague(Id leagueId) {
        if (leagueId == null) {
            return new List<Division__c>();
        }
        return [SELECT Id, Name, League__c, League__r.Name FROM Division__c WHERE League__c = :leagueId ORDER BY Name];
    }

    /**
     * Returns all divisions with full details.
     */
    public virtual List<Division__c> getAllDivisions() {
        return [SELECT Id, Name, League__c, League__r.Name FROM Division__c ORDER BY League__r.Name, Name LIMIT 50];
    }
    
    /**
     * Assigns a team to a division
     */
    public virtual void assignTeamToDivision(Id teamId, Id divisionId) {
        if (teamId == null) {
            throw new DivisionRepositoryException('Team Id cannot be null');
        }
        
        Team__c team = [SELECT Id, League__c FROM Team__c WHERE Id = :teamId LIMIT 1];
        
        if (divisionId != null) {
            Division__c division = [SELECT Id, League__c FROM Division__c WHERE Id = :divisionId LIMIT 1];
            
            // Validate that team and division belong to the same league
            if (team.League__c != division.League__c) {
                throw new DivisionRepositoryException('Team and division must belong to the same league');
            }
        }
        
        team.Division__c = divisionId;
        update team;
    }
    
    /**
     * Gets teams by division
     */
    public virtual List<Team__c> getTeamsByDivision(Id divisionId) {
        if (divisionId == null) {
            return new List<Team__c>();
        }
        return [SELECT Id, Name, City__c, Stadium__c, Founded_Year__c, Location__c, League__c, League__r.Name, Division__c, Division__r.Name 
                FROM Team__c WHERE Division__c = :divisionId ORDER BY Name];
    }
    
    /**
     * Validates unique division name within a league
     */
    private void validateUniqueDivisionName(String divisionName, Id leagueId, Id excludeId) {
        if (String.isBlank(divisionName) || leagueId == null) {
            return;
        }
        
        String query = 'SELECT COUNT() FROM Division__c WHERE Name = :divisionName AND League__c = :leagueId';
        List<Object> parameters = new List<Object>{divisionName, leagueId};
        
        if (excludeId != null) {
            query += ' AND Id != :excludeId';
            parameters.add(excludeId);
        }
        
        Integer count = Database.countQuery(query);
        if (count > 0) {
            throw new DivisionRepositoryException('Division name must be unique within the league');
        }
    }

    public class DivisionRepositoryException extends Exception {}
} 