/**
 * @description Test class for PlayerRepository with proper test data setup
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class PlayerRepositoryTest {

    @TestSetup
    static void setupTestData() {
        // Create test league
        League__c testLeague = new League__c(
            Name = 'Test League'
        );
        insert testLeague;

        // Create test team
        Team__c testTeam = new Team__c(
            Name = 'Test Team',
            League__c = testLeague.Id,
            Location__c = 'Test City'
        );
        insert testTeam;

        // Create test players
        List<Player__c> testPlayers = new List<Player__c>{
            new Player__c(
                Name = 'Alice Johnson',
                Team__c = testTeam.Id,
                Position__c = 'Forward',
                Jersey_Number__c = 10,
                Date_of_Birth__c = Date.newInstance(1995, 3, 15),
                Status__c = 'Active'
            ),
            new Player__c(
                Name = 'Bob Smith',
                Team__c = testTeam.Id,
                Position__c = 'Goalkeeper',
                Jersey_Number__c = 1,
                Date_of_Birth__c = Date.newInstance(1993, 7, 22),
                Status__c = 'Active'
            )
        };
        insert testPlayers;
    }

    @IsTest
    static void testCreate_ValidPlayer() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        PlayerRepository repo = new PlayerRepository();
        IPlayer newPlayer = new PlayerWrapper(
            null, 'New Player', team.Id, 'Midfielder', 7,
            Date.newInstance(1998, 1, 10), 'Active'
        );

        // When
        Test.startTest();
        Id result = repo.create(newPlayer);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return created player ID');
        Player__c created = [SELECT Id, Name, Team__c, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c FROM Player__c WHERE Id = :result];
        Assert.areEqual('New Player', created.Name, 'Should have correct name');
        Assert.areEqual(team.Id, created.Team__c, 'Should have correct team');
        Assert.areEqual('Midfielder', created.Position__c, 'Should have correct position');
        Assert.areEqual(7, created.Jersey_Number__c, 'Should have correct jersey number');
        Assert.areEqual(Date.newInstance(1998, 1, 10), created.Date_of_Birth__c, 'Should have correct date of birth');
        Assert.areEqual('Active', created.Status__c, 'Should have correct status');
    }

    @IsTest
    static void testCreate_NullPlayer() {
        // Given
        PlayerRepository repo = new PlayerRepository();

        // When/Then
        Test.startTest();
        try {
            repo.create(null);
            Assert.fail('Should throw exception for null player');
        } catch (PlayerRepository.PlayerRepositoryException e) {
            Assert.areEqual('Player cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreate_DuplicateJerseyNumber() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        PlayerRepository repo = new PlayerRepository();
        IPlayer duplicatePlayer = new PlayerWrapper(
            null, 'Duplicate Jersey', team.Id, 'Defender', 10,
            Date.newInstance(2000, 5, 1), 'Active'
        );

        // When/Then
        Test.startTest();
        try {
            repo.create(duplicatePlayer);
            Assert.fail('Should throw exception for duplicate jersey number');
        } catch (PlayerRepository.PlayerRepositoryException e) {
            Assert.areEqual('Jersey number must be unique within the team', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreate_NullJerseyNumber() {
        // Given — null jersey number should be allowed (optional field)
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        PlayerRepository repo = new PlayerRepository();
        IPlayer playerNoJersey = new PlayerWrapper(
            null, 'No Jersey', team.Id, 'Defender', null,
            Date.newInstance(2000, 5, 1), 'Active'
        );

        // When
        Test.startTest();
        Id result = repo.create(playerNoJersey);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should create player without jersey number');
    }

    @IsTest
    static void testRetrieve_ValidId() {
        // Given
        Player__c testPlayer = [SELECT Id FROM Player__c LIMIT 1];
        PlayerRepository repo = new PlayerRepository();

        // When
        Test.startTest();
        Player__c result = repo.retrieve(testPlayer.Id);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return player');
        Assert.areEqual(testPlayer.Id, result.Id, 'Should return correct player');
        Assert.isNotNull(result.Team__r, 'Should include team relationship');
        Assert.isNotNull(result.Position__c, 'Should include position');
        Assert.isNotNull(result.Jersey_Number__c, 'Should include jersey number');
        Assert.isNotNull(result.Date_of_Birth__c, 'Should include date of birth');
        Assert.isNotNull(result.Status__c, 'Should include status');
    }

    @IsTest
    static void testRetrieve_NullId() {
        // Given
        PlayerRepository repo = new PlayerRepository();

        // When/Then
        Test.startTest();
        try {
            repo.retrieve(null);
            Assert.fail('Should throw exception for null ID');
        } catch (PlayerRepository.PlayerRepositoryException e) {
            Assert.areEqual('Player Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpdatePlayer_ValidRecord() {
        // Given
        Player__c testPlayer = [SELECT Id, Name, Team__c, Position__c, Jersey_Number__c, Date_of_Birth__c, Status__c FROM Player__c LIMIT 1];
        PlayerRepository repo = new PlayerRepository();
        testPlayer.Name = 'Updated Player Name';

        // When
        Test.startTest();
        repo.updatePlayer(testPlayer);
        Test.stopTest();

        // Then
        Player__c updated = [SELECT Name FROM Player__c WHERE Id = :testPlayer.Id];
        Assert.areEqual('Updated Player Name', updated.Name, 'Should have updated name');
    }

    @IsTest
    static void testUpdatePlayer_NullRecord() {
        // Given
        PlayerRepository repo = new PlayerRepository();

        // When/Then
        Test.startTest();
        try {
            repo.updatePlayer(null);
            Assert.fail('Should throw exception for null record');
        } catch (PlayerRepository.PlayerRepositoryException e) {
            Assert.areEqual('Invalid Player record', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testDeletePlayer_ValidId() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        Player__c playerToDelete = new Player__c(
            Name = 'To Be Deleted',
            Team__c = team.Id,
            Position__c = 'Defender',
            Jersey_Number__c = 99,
            Status__c = 'Active'
        );
        insert playerToDelete;

        PlayerRepository repo = new PlayerRepository();

        // When
        Test.startTest();
        repo.deletePlayer(playerToDelete.Id);
        Test.stopTest();

        // Then
        List<Player__c> remaining = [SELECT Id FROM Player__c WHERE Id = :playerToDelete.Id];
        Assert.areEqual(0, remaining.size(), 'Player should be deleted');
    }

    @IsTest
    static void testDeletePlayer_NullId() {
        // Given
        PlayerRepository repo = new PlayerRepository();

        // When/Then
        Test.startTest();
        try {
            repo.deletePlayer(null);
            Assert.fail('Should throw exception for null ID');
        } catch (PlayerRepository.PlayerRepositoryException e) {
            Assert.areEqual('Player Id cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testListByTeam_ValidTeamId() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        PlayerRepository repo = new PlayerRepository();

        // When
        Test.startTest();
        List<Player__c> result = repo.listByTeam(team.Id);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of players');
        Assert.areEqual(2, result.size(), 'Should return 2 test players');
        for (Player__c player : result) {
            Assert.areEqual(team.Id, player.Team__c, 'All players should belong to the team');
        }
        // Verify ordering by Name
        Assert.isTrue(result[0].Name <= result[1].Name, 'Should be ordered by name ascending');
    }

    @IsTest
    static void testListByTeam_NullTeamId() {
        // Given
        PlayerRepository repo = new PlayerRepository();

        // When
        Test.startTest();
        List<Player__c> result = repo.listByTeam(null);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list for null team ID');
        Assert.areEqual(0, result.size(), 'Should return empty list for null team ID');
    }

    @IsTest
    static void testGetAllPlayers() {
        // Given
        PlayerRepository repo = new PlayerRepository();

        // When
        Test.startTest();
        List<Player__c> result = repo.getAllPlayers();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of players');
        Assert.areEqual(2, result.size(), 'Should return 2 test players');
    }

    @IsTest
    static void testBulkOperations() {
        // Given
        Team__c team = [SELECT Id FROM Team__c LIMIT 1];
        PlayerRepository repo = new PlayerRepository();
        List<IPlayer> bulkPlayers = new List<IPlayer>();

        for (Integer i = 1; i <= 10; i++) {
            bulkPlayers.add(new PlayerWrapper(
                null, 'Bulk Player ' + i, team.Id, 'Position ' + i, 20 + i,
                Date.newInstance(2000, 1, i), 'Active'
            ));
        }

        // When
        Test.startTest();
        List<Id> createdIds = new List<Id>();
        for (IPlayer player : bulkPlayers) {
            createdIds.add(repo.create(player));
        }
        Test.stopTest();

        // Then
        Assert.areEqual(10, createdIds.size(), 'Should create 10 players');
        List<Player__c> created = [SELECT Id FROM Player__c WHERE Id IN :createdIds];
        Assert.areEqual(10, created.size(), 'Should have 10 players in database');
    }
}
