/**
 * @description Test class for PlayerRosterController using mock DI pattern
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class PlayerRosterControllerTest {

    // Dynamic ID generation — prefixes vary by org
    private static String teamPrefix = Team__c.SObjectType.getDescribe().getKeyPrefix();
    private static String playerPrefix = Player__c.SObjectType.getDescribe().getKeyPrefix();

    private static Id fakeTeamId(Integer seq) {
        return Id.valueOf(teamPrefix + '0'.repeat(12 - String.valueOf(seq).length()) + seq + 'AAA');
    }
    private static Id fakePlayerId(Integer seq) {
        return Id.valueOf(playerPrefix + '0'.repeat(12 - String.valueOf(seq).length()) + seq + 'AAA');
    }

    /**
     * @description Mock implementation of PlayerService for testing
     */
    private class MockPlayerService extends PlayerService {
        private List<IPlayer> mockPlayers;
        private IPlayer mockPlayer;
        private Boolean shouldThrowException = false;
        public IPlayer lastCreatedPlayer;
        public Player__c lastUpdatedRecord;
        public Id lastDeletedId;

        public MockPlayerService() {
            super(new PlayerRepository());
            setupMockData();
        }

        public MockPlayerService(Boolean throwException) {
            super(new PlayerRepository());
            this.shouldThrowException = throwException;
            if (!throwException) {
                setupMockData();
            }
        }

        private void setupMockData() {
            Player__c mockPlayerRecord1 = new Player__c(
                Id = fakePlayerId(1),
                Name = 'Mock Player Alpha',
                Team__c = fakeTeamId(1),
                Position__c = 'Forward',
                Jersey_Number__c = 10,
                Date_of_Birth__c = Date.newInstance(1995, 3, 15),
                Status__c = 'Active'
            );

            Player__c mockPlayerRecord2 = new Player__c(
                Id = fakePlayerId(2),
                Name = 'Mock Player Beta',
                Team__c = fakeTeamId(2),
                Position__c = 'Goalkeeper',
                Jersey_Number__c = 1,
                Date_of_Birth__c = Date.newInstance(1998, 7, 22),
                Status__c = 'Injured'
            );

            this.mockPlayer = new PlayerWrapper(mockPlayerRecord1);
            IPlayer mockPlayer2 = new PlayerWrapper(mockPlayerRecord2);
            this.mockPlayers = new List<IPlayer>{ this.mockPlayer, mockPlayer2 };
        }

        public override List<IPlayer> getAllPlayersAsInterface() {
            if (shouldThrowException) {
                throw new QueryException('Mock service error');
            }
            return mockPlayers != null ? mockPlayers : new List<IPlayer>();
        }

        public override IPlayer getPlayerByIdAsInterface(String playerId) {
            if (shouldThrowException) {
                throw new QueryException('Mock service error');
            }
            if (String.isBlank(playerId)) {
                return null;
            }
            return mockPlayer;
        }

        public override List<IPlayer> getPlayersByTeamAsInterface(String teamId) {
            if (shouldThrowException) {
                throw new QueryException('Mock service error');
            }
            if (String.isBlank(teamId)) {
                return new List<IPlayer>();
            }
            return mockPlayers != null ? mockPlayers : new List<IPlayer>();
        }

        public override Id createPlayer(IPlayer player) {
            if (shouldThrowException) {
                throw new QueryException('Mock service error');
            }
            this.lastCreatedPlayer = player;
            return fakePlayerId(3);
        }

        public override void updatePlayer(Player__c record) {
            if (shouldThrowException) {
                throw new QueryException('Mock service error');
            }
            this.lastUpdatedRecord = record;
        }

        public override void deletePlayer(Id playerId) {
            if (shouldThrowException) {
                throw new QueryException('Mock service error');
            }
            this.lastDeletedId = playerId;
        }
    }

    // ==================== getAllPlayers Tests ====================

    @IsTest
    static void testGetAllPlayers_Success() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When
        Test.startTest();
        List<Player__c> result = PlayerRosterController.getAllPlayers();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of players');
        Assert.areEqual(2, result.size(), 'Should return 2 mock players');
        Assert.areEqual('Mock Player Alpha', result[0].Name, 'Should return correct player name');
        Assert.areEqual('Mock Player Beta', result[1].Name, 'Should return correct player name');
    }

    @IsTest
    static void testGetAllPlayers_EmptyResult() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        mockService.mockPlayers = new List<IPlayer>();
        PlayerRosterController.setServiceForTesting(mockService);

        // When
        Test.startTest();
        List<Player__c> result = PlayerRosterController.getAllPlayers();
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list');
    }

    @IsTest
    static void testGetAllPlayers_ServiceException() {
        // Given
        MockPlayerService mockService = new MockPlayerService(true);
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            List<Player__c> result = PlayerRosterController.getAllPlayers();
            Assert.fail('Should throw exception when service throws exception');
        } catch (QueryException e) {
            Assert.areEqual('Mock service error', e.getMessage(), 'Should propagate service exception');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Mock service error'), 'Should propagate service exception message');
        }
        Test.stopTest();
    }

    // ==================== getPlayerById Tests ====================

    @IsTest
    static void testGetPlayerById_ValidId() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);
        String playerId = fakePlayerId(1);

        // When
        Test.startTest();
        Player__c result = PlayerRosterController.getPlayerById(playerId);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return player record');
        Assert.areEqual('Mock Player Alpha', result.Name, 'Should return correct player name');
        Assert.areEqual('Forward', result.Position__c, 'Should return correct position');
        Assert.areEqual(10, result.Jersey_Number__c, 'Should return correct jersey number');
        Assert.areEqual('Active', result.Status__c, 'Should return correct status');
    }

    @IsTest
    static void testGetPlayerById_BlankId() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When
        Test.startTest();
        Player__c result = PlayerRosterController.getPlayerById('');
        Test.stopTest();

        // Then
        Assert.isNull(result, 'Should return null for blank ID');
    }

    @IsTest
    static void testGetPlayerById_ServiceException() {
        // Given
        MockPlayerService mockService = new MockPlayerService(true);
        PlayerRosterController.setServiceForTesting(mockService);
        String playerId = fakePlayerId(1);

        // When/Then
        Test.startTest();
        try {
            Player__c result = PlayerRosterController.getPlayerById(playerId);
            Assert.fail('Should throw exception when service throws exception');
        } catch (QueryException e) {
            Assert.areEqual('Mock service error', e.getMessage(), 'Should propagate service exception');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Mock service error'), 'Should propagate service exception message');
        }
        Test.stopTest();
    }

    // ==================== getPlayersByTeam Tests ====================

    @IsTest
    static void testGetPlayersByTeam_ValidTeamId() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);
        String teamId = fakeTeamId(1);

        // When
        Test.startTest();
        List<Player__c> result = PlayerRosterController.getPlayersByTeam(teamId);
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return list of players');
        Assert.areEqual(2, result.size(), 'Should return players for the team');
        Assert.areEqual('Mock Player Alpha', result[0].Name, 'Should return correct player');
    }

    @IsTest
    static void testGetPlayersByTeam_BlankTeamId() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When
        Test.startTest();
        List<Player__c> result = PlayerRosterController.getPlayersByTeam('');
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list for blank team ID');
    }

    @IsTest
    static void testGetPlayersByTeam_ServiceException() {
        // Given
        MockPlayerService mockService = new MockPlayerService(true);
        PlayerRosterController.setServiceForTesting(mockService);
        String teamId = fakeTeamId(1);

        // When
        Test.startTest();
        List<Player__c> result = PlayerRosterController.getPlayersByTeam(teamId);
        Test.stopTest();

        // Then - Should return empty list instead of throwing exception
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list on error');
    }

    // ==================== createPlayer Tests ====================

    @IsTest
    static void testCreatePlayer_Success() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When
        Test.startTest();
        String result = PlayerRosterController.createPlayer(
            'New Player', fakeTeamId(1), 'Midfielder', 7, Date.newInstance(2000, 1, 15), 'Active'
        );
        Test.stopTest();

        // Then
        Assert.isNotNull(result, 'Should return created player ID');
        Assert.areEqual(String.valueOf(fakePlayerId(3)), result, 'Should return mock ID');
        Assert.isNotNull(mockService.lastCreatedPlayer, 'Service should have received player');
        Assert.areEqual('New Player', mockService.lastCreatedPlayer.getName(), 'Should pass correct name');
    }

    @IsTest
    static void testCreatePlayer_BlankName() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            PlayerRosterController.createPlayer('', fakeTeamId(1), 'Midfielder', 7, Date.newInstance(2000, 1, 15), 'Active');
            Assert.fail('Should throw exception for blank name');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Player name and team are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreatePlayer_BlankTeamId() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            PlayerRosterController.createPlayer('New Player', '', 'Midfielder', 7, Date.newInstance(2000, 1, 15), 'Active');
            Assert.fail('Should throw exception for blank team ID');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Player name and team are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testCreatePlayer_ServiceException() {
        // Given
        MockPlayerService mockService = new MockPlayerService(true);
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            PlayerRosterController.createPlayer('New Player', fakeTeamId(1), 'Midfielder', 7, Date.newInstance(2000, 1, 15), 'Active');
            Assert.fail('Should throw exception when service throws exception');
        } catch (QueryException e) {
            Assert.areEqual('Mock service error', e.getMessage(), 'Should propagate service exception');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Mock service error'), 'Should propagate service exception message');
        }
        Test.stopTest();
    }

    // ==================== updatePlayer Tests ====================

    @IsTest
    static void testUpdatePlayer_Success() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When
        Test.startTest();
        PlayerRosterController.updatePlayer(
            fakePlayerId(1), 'Updated Player', fakeTeamId(1), 'Defender', 4, Date.newInstance(1996, 5, 20), 'Active'
        );
        Test.stopTest();

        // Then
        Assert.isNotNull(mockService.lastUpdatedRecord, 'Service should have received update');
        Assert.areEqual('Updated Player', mockService.lastUpdatedRecord.Name, 'Should pass correct name');
        Assert.areEqual('Defender', mockService.lastUpdatedRecord.Position__c, 'Should pass correct position');
        Assert.areEqual(4, mockService.lastUpdatedRecord.Jersey_Number__c, 'Should pass correct jersey number');
    }

    @IsTest
    static void testUpdatePlayer_BlankId() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            PlayerRosterController.updatePlayer('', 'Updated Player', fakeTeamId(1), 'Defender', 4, Date.newInstance(1996, 5, 20), 'Active');
            Assert.fail('Should throw exception for blank ID');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Player ID, name, and team are required'), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpdatePlayer_ServiceException() {
        // Given
        MockPlayerService mockService = new MockPlayerService(true);
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            PlayerRosterController.updatePlayer(fakePlayerId(1), 'Updated Player', fakeTeamId(1), 'Defender', 4, Date.newInstance(1996, 5, 20), 'Active');
            Assert.fail('Should throw exception when service throws exception');
        } catch (QueryException e) {
            Assert.areEqual('Mock service error', e.getMessage(), 'Should propagate service exception');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Mock service error'), 'Should propagate service exception message');
        }
        Test.stopTest();
    }

    // ==================== deletePlayer Tests ====================

    @IsTest
    static void testDeletePlayer_Success() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When
        Test.startTest();
        PlayerRosterController.deletePlayer(fakePlayerId(1));
        Test.stopTest();

        // Then
        Assert.areEqual(String.valueOf(fakePlayerId(1)), String.valueOf(mockService.lastDeletedId), 'Should pass correct ID to service');
    }

    @IsTest
    static void testDeletePlayer_BlankId() {
        // Given
        MockPlayerService mockService = new MockPlayerService();
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            PlayerRosterController.deletePlayer('');
            Assert.fail('Should throw exception for blank ID');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Player ID is required'), 'Should have correct error message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testDeletePlayer_ServiceException() {
        // Given
        MockPlayerService mockService = new MockPlayerService(true);
        PlayerRosterController.setServiceForTesting(mockService);

        // When/Then
        Test.startTest();
        try {
            PlayerRosterController.deletePlayer(fakePlayerId(1));
            Assert.fail('Should throw exception when service throws exception');
        } catch (QueryException e) {
            Assert.areEqual('Mock service error', e.getMessage(), 'Should propagate service exception');
        } catch (Exception e) {
            Assert.isTrue(e.getMessage().contains('Mock service error'), 'Should propagate service exception message');
        }
        Test.stopTest();
    }
}
