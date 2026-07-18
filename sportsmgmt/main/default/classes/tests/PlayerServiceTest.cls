/**
 * @description Test class for PlayerService with dependency injection mocking
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class PlayerServiceTest {

    /**
     * @description Mock repository for testing service layer in isolation
     */
    private class MockPlayerRepository extends PlayerRepository {
        public List<Player__c> mockPlayers;
        public Boolean shouldThrowException = false;
        public String expectedPlayerId;
        public IPlayer lastCreatedPlayer;
        public Player__c lastUpdatedPlayer;
        public Id lastDeletedPlayerId;

        public MockPlayerRepository() {
            this.mockPlayers = new List<Player__c>();
        }

        public override Id create(IPlayer player) {
            if (shouldThrowException) {
                throw new PlayerRepositoryException('Mock repository error');
            }
            this.lastCreatedPlayer = player;
            return 'a04000000000001AAA'; // Mock ID
        }

        public override Player__c retrieve(Id playerId) {
            if (shouldThrowException) {
                throw new PlayerRepositoryException('Mock repository error');
            }
            this.expectedPlayerId = String.valueOf(playerId);
            return mockPlayers.isEmpty() ? null : mockPlayers[0];
        }

        public override void updatePlayer(Player__c record) {
            if (shouldThrowException) {
                throw new PlayerRepositoryException('Mock repository error');
            }
            this.lastUpdatedPlayer = record;
        }

        public override void deletePlayer(Id playerId) {
            if (shouldThrowException) {
                throw new PlayerRepositoryException('Mock repository error');
            }
            this.lastDeletedPlayerId = playerId;
        }

        public override List<Player__c> listByTeam(Id teamId) {
            if (shouldThrowException) {
                throw new PlayerRepositoryException('Mock repository error');
            }
            return mockPlayers;
        }

        public override List<Player__c> getAllPlayers() {
            if (shouldThrowException) {
                throw new PlayerRepositoryException('Mock repository error');
            }
            return mockPlayers;
        }
    }

    /**
     * @description Test getAllPlayersAsInterface method returns wrapped player objects
     */
    @IsTest
    static void testGetAllPlayersAsInterface_Success() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        List<Player__c> mockPlayers = (List<Player__c>)JSON.deserialize(
            '[' +
            '  {"sobjectType": "Player__c", "Id": "a04000000000001AAA", "Name": "Alice Johnson", "Team__c": "a02000000000001AAA", "Position__c": "Forward", "Jersey_Number__c": 10, "Date_of_Birth__c": "1995-03-15", "Status__c": "Active"},' +
            '  {"sobjectType": "Player__c", "Id": "a04000000000002AAA", "Name": "Bob Smith", "Team__c": "a02000000000001AAA", "Position__c": "Goalkeeper", "Jersey_Number__c": 1, "Date_of_Birth__c": "1993-07-22", "Status__c": "Active"}' +
            ']',
            List<Player__c>.class
        );
        mockRepo.mockPlayers = mockPlayers;
        PlayerService service = new PlayerService(mockRepo);

        // When
        Test.startTest();
        List<IPlayer> result = service.getAllPlayersAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of IPlayer objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock players');

        // Verify first player
        IPlayer firstPlayer = result[0];
        Assert.isNotNull(firstPlayer.getId(), 'Should have an ID');
        Assert.areEqual('Alice Johnson', firstPlayer.getName(), 'Should return correct player name');
        Assert.isNotNull(firstPlayer.getTeamId(), 'Should have a team ID');
        Assert.areEqual('Forward', firstPlayer.getPosition(), 'Should have correct position');
        Assert.areEqual(10, firstPlayer.getJerseyNumber(), 'Should have correct jersey number');
        Assert.isNotNull(firstPlayer.getDateOfBirth(), 'Should have a date of birth');
        Assert.areEqual('Active', firstPlayer.getStatus(), 'Should have correct status');
    }

    /**
     * @description Test getAllPlayersAsInterface method with empty result
     */
    @IsTest
    static void testGetAllPlayersAsInterface_EmptyResult() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        mockRepo.mockPlayers = new List<Player__c>();
        PlayerService service = new PlayerService(mockRepo);

        // When
        Test.startTest();
        List<IPlayer> result = service.getAllPlayersAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list');
    }

    /**
     * @description Test getPlayerByIdAsInterface method with valid ID
     */
    @IsTest
    static void testGetPlayerByIdAsInterface_ValidId() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        Player__c mockPlayer = (Player__c)JSON.deserialize(
            '{"sobjectType": "Player__c", "Id": "a04000000000001AAA", "Name": "Alice Johnson", "Team__c": "a02000000000001AAA", "Position__c": "Forward", "Jersey_Number__c": 10, "Date_of_Birth__c": "1995-03-15", "Status__c": "Active"}',
            Player__c.class
        );
        mockRepo.mockPlayers.add(mockPlayer);
        PlayerService service = new PlayerService(mockRepo);
        String playerId = 'a04000000000001AAA';

        // When
        Test.startTest();
        IPlayer result = service.getPlayerByIdAsInterface(playerId);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return IPlayer object');
        Assert.areEqual(playerId, result.getId(), 'Should return correct player ID');
        Assert.areEqual('Alice Johnson', result.getName(), 'Should return correct player name');
        Assert.isNotNull(result.getTeamId(), 'Should have a team ID');
        Assert.areEqual('Forward', result.getPosition(), 'Should have correct position');
        Assert.areEqual(10, result.getJerseyNumber(), 'Should have correct jersey number');
        Assert.areEqual('Active', result.getStatus(), 'Should have correct status');
    }

    /**
     * @description Test getPlayerByIdAsInterface method with null/blank ID
     */
    @IsTest
    static void testGetPlayerByIdAsInterface_NullId() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        PlayerService service = new PlayerService(mockRepo);

        // When
        Test.startTest();
        IPlayer resultNull = service.getPlayerByIdAsInterface(null);
        IPlayer resultBlank = service.getPlayerByIdAsInterface('');
        Test.stopTest();

        // Then
        Assert.isNull(resultNull, 'Should return null for null ID');
        Assert.isNull(resultBlank, 'Should return null for blank ID');
    }

    /**
     * @description Test getPlayersByTeamAsInterface method with valid team ID
     */
    @IsTest
    static void testGetPlayersByTeamAsInterface_ValidTeamId() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        List<Player__c> mockPlayers = (List<Player__c>)JSON.deserialize(
            '[' +
            '  {"sobjectType": "Player__c", "Id": "a04000000000001AAA", "Name": "Alice Johnson", "Team__c": "a02000000000001AAA", "Position__c": "Forward", "Jersey_Number__c": 10, "Date_of_Birth__c": "1995-03-15", "Status__c": "Active"},' +
            '  {"sobjectType": "Player__c", "Id": "a04000000000002AAA", "Name": "Bob Smith", "Team__c": "a02000000000001AAA", "Position__c": "Goalkeeper", "Jersey_Number__c": 1, "Date_of_Birth__c": "1993-07-22", "Status__c": "Active"}' +
            ']',
            List<Player__c>.class
        );
        mockRepo.mockPlayers = mockPlayers;
        PlayerService service = new PlayerService(mockRepo);
        String teamId = 'a02000000000001AAA';

        // When
        Test.startTest();
        List<IPlayer> result = service.getPlayersByTeamAsInterface(teamId);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of IPlayer objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock players');

        for (IPlayer player : result) {
            Assert.isNotNull(player.getTeamId(), 'All players should have a team ID');
        }
    }

    /**
     * @description Test getPlayersByTeamAsInterface method with null/blank team ID
     */
    @IsTest
    static void testGetPlayersByTeamAsInterface_NullTeamId() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        PlayerService service = new PlayerService(mockRepo);

        // When
        Test.startTest();
        List<IPlayer> resultNull = service.getPlayersByTeamAsInterface(null);
        List<IPlayer> resultBlank = service.getPlayersByTeamAsInterface('');
        Test.stopTest();

        // Then
        Assert.isNotNull(resultNull, 'Should return empty list for null team ID');
        Assert.areEqual(0, resultNull.size(), 'Should return empty list for null team ID');
        Assert.isNotNull(resultBlank, 'Should return empty list for blank team ID');
        Assert.areEqual(0, resultBlank.size(), 'Should return empty list for blank team ID');
    }

    /**
     * @description Test createPlayer method with valid player
     */
    @IsTest
    static void testCreatePlayer_ValidPlayer() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        PlayerService service = new PlayerService(mockRepo);
        IPlayer newPlayer = new PlayerWrapper(
            null, 'New Player', 'a02000000000001AAA', 'Midfielder', 7,
            Date.newInstance(1998, 1, 10), 'Active'
        );

        // When
        Test.startTest();
        Id result = service.createPlayer(newPlayer);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return created player ID');
        Assert.areEqual('a04000000000001AAA', result, 'Should return mock ID');
        Assert.areEqual(newPlayer, mockRepo.lastCreatedPlayer, 'Should pass player to repository');
    }

    /**
     * @description Test exception propagation from repository layer
     */
    @IsTest
    static void testExceptionPropagation_DatabaseError() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();
        mockRepo.shouldThrowException = true;
        PlayerService service = new PlayerService(mockRepo);

        // When/Then
        Test.startTest();
        try {
            service.getAllPlayersAsInterface();
            Assert.fail('Should propagate exception from repository');
        } catch (PlayerRepository.PlayerRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate correct error message');
        }
        Test.stopTest();
    }

    /**
     * @description Test dependency injection with null repository
     */
    @IsTest
    static void testDependencyInjection_NullRepository() {
        // When/Then
        Test.startTest();
        try {
            PlayerService service = new PlayerService(null);
            Assert.fail('Should throw exception for null repository');
        } catch (PlayerService.PlayerServiceException e) {
            Assert.areEqual('Repository cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }

    /**
     * @description Test PlayerWrapper functionality with IPlayer interface
     */
    @IsTest
    static void testPlayerWrapper_IPlayerImplementation() {
        // Given
        Player__c mockPlayer = (Player__c)JSON.deserialize(
            '{"sobjectType": "Player__c", "Id": "a04000000000001AAA", "Name": "Test Player", "Team__c": "a02000000000001AAA", "Position__c": "Forward", "Jersey_Number__c": 10, "Date_of_Birth__c": "1995-03-15", "Status__c": "Active"}',
            Player__c.class
        );

        // When
        IPlayer wrapper = new PlayerWrapper(mockPlayer);

        // Then
        Assert.areEqual(mockPlayer.Id, wrapper.getId(), 'Wrapper should return correct ID');
        Assert.areEqual(mockPlayer.Name, wrapper.getName(), 'Wrapper should return correct name');
        Assert.areEqual(mockPlayer.Team__c, wrapper.getTeamId(), 'Wrapper should return correct team ID');
        Assert.areEqual(mockPlayer.Position__c, wrapper.getPosition(), 'Wrapper should return correct position');
        Assert.areEqual(mockPlayer.Jersey_Number__c, wrapper.getJerseyNumber(), 'Wrapper should return correct jersey number');
        Assert.areEqual(mockPlayer.Date_of_Birth__c, wrapper.getDateOfBirth(), 'Wrapper should return correct date of birth');
        Assert.areEqual(mockPlayer.Status__c, wrapper.getStatus(), 'Wrapper should return correct status');
    }

    /**
     * @description Test bulk operations handling
     */
    @IsTest
    static void testBulkOperations_LargeDataSets() {
        // Given
        MockPlayerRepository mockRepo = new MockPlayerRepository();

        List<Player__c> bulkPlayers = new List<Player__c>();
        for (Integer i = 1; i <= 200; i++) {
            Player__c player = new Player__c(
                Name = 'Bulk Player ' + i,
                Team__c = 'a02000000000001AAA'
            );
            bulkPlayers.add(player);
        }
        mockRepo.mockPlayers = bulkPlayers;

        PlayerService service = new PlayerService(mockRepo);

        // When
        Test.startTest();
        List<IPlayer> result = service.getAllPlayersAsInterface();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should handle bulk operations');
        Assert.areEqual(200, result.size(), 'Should return all 200 players');

        // Verify governor limits are respected
        Assert.isTrue(Limits.getQueries() <= Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
        Assert.isTrue(Limits.getCpuTime() <= Limits.getLimitCpuTime(), 'Should not exceed CPU time limits');
    }
}
