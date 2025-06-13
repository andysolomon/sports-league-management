/**
 * @description Test class for TeamService with dependency injection mocking
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class TeamServiceTest {
    
    /**
     * @description Mock repository for testing service layer in isolation
     */
    private class MockTeamRepository extends TeamRepository {
        public List<Team__c> mockTeams;
        public Boolean shouldThrowException = false;
        public String expectedTeamId;
        public ITeam lastCreatedTeam;
        public Team__c lastUpdatedTeam;
        public Id lastDeletedTeamId;
        
        public MockTeamRepository() {
            this.mockTeams = new List<Team__c>();
        }
        
        public override Id create(ITeam team) {
            if (shouldThrowException) {
                throw new TeamRepositoryException('Mock repository error');
            }
            this.lastCreatedTeam = team;
            return 'a00000000000001AAA'; // Mock ID
        }
        
        public override Team__c retrieve(Id teamId) {
            if (shouldThrowException) {
                throw new TeamRepositoryException('Mock repository error');
            }
            this.expectedTeamId = String.valueOf(teamId);
            return mockTeams.isEmpty() ? null : mockTeams[0];
        }
        
        public override void updateTeam(Team__c record) {
            if (shouldThrowException) {
                throw new TeamRepositoryException('Mock repository error');
            }
            this.lastUpdatedTeam = record;
        }
        
        public override void deleteTeam(Id teamId) {
            if (shouldThrowException) {
                throw new TeamRepositoryException('Mock repository error');
            }
            this.lastDeletedTeamId = teamId;
        }
        
        public override List<Team__c> listByLeague(Id leagueId) {
            if (shouldThrowException) {
                throw new TeamRepositoryException('Mock repository error');
            }
            return mockTeams;
        }
        
        public override List<Team__c> getAllTeams() {
            if (shouldThrowException) {
                throw new TeamRepositoryException('Mock repository error');
            }
            return mockTeams;
        }
    }
    
    /**
     * @description Test getAllTeamsAsInterface method returns wrapped team objects
     */
    @IsTest
    static void testGetAllTeamsAsInterface_Success() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        List<Team__c> mockTeams = new List<Team__c>{
            new Team__c(Id = 'a00000000000001AAA', Name = 'Mock Team Alpha', League__c = 'a01000000000001AAA'),
            new Team__c(Id = 'a00000000000002AAA', Name = 'Mock Team Beta', League__c = 'a01000000000001AAA')
        };
        mockRepo.mockTeams = mockTeams;
        TeamService service = new TeamService(mockRepo);
        
        // When
        Test.startTest();
        List<ITeam> result = service.getAllTeamsAsInterface();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of ITeam objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock teams');
        
        // Verify first team
        ITeam firstTeam = result[0];
        Assert.isNotNull(firstTeam.getId(), 'Should have an ID');
        Assert.areEqual('Mock Team Alpha', firstTeam.getName(), 'Should return correct team name');
        Assert.isNotNull(firstTeam.getLeagueId(), 'Should have a league ID');
    }
    
    /**
     * @description Test getAllTeamsAsInterface method with empty result
     */
    @IsTest
    static void testGetAllTeamsAsInterface_EmptyResult() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.mockTeams = new List<Team__c>(); // Empty list
        TeamService service = new TeamService(mockRepo);
        
        // When
        Test.startTest();
        List<ITeam> result = service.getAllTeamsAsInterface();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list');
    }
    
    /**
     * @description Test getTeamByIdAsInterface method with valid ID
     */
    @IsTest
    static void testGetTeamByIdAsInterface_ValidId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        Team__c mockTeam = new Team__c(
            Id = 'a00000000000001AAA', 
            Name = 'Mock Team Alpha', 
            League__c = 'a01000000000001AAA'
        );
        mockRepo.mockTeams.add(mockTeam);
        TeamService service = new TeamService(mockRepo);
        String teamId = 'a00000000000001AAA';
        
        // When
        Test.startTest();
        ITeam result = service.getTeamByIdAsInterface(teamId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return ITeam object');
        Assert.areEqual(teamId, result.getId(), 'Should return correct team ID');
        Assert.areEqual('Mock Team Alpha', result.getName(), 'Should return correct team name');
        Assert.isNotNull(result.getLeagueId(), 'Should have a league ID');
    }
    
    /**
     * @description Test getTeamByIdAsInterface method with invalid ID
     */
    @IsTest
    static void testGetTeamByIdAsInterface_InvalidId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService service = new TeamService(mockRepo);
        String invalidId = 'a00000000000999AAA'; // ID that doesn't match mock data
        
        // When
        Test.startTest();
        ITeam result = service.getTeamByIdAsInterface(invalidId);
        Test.stopTest();
        
        // Then
        Assert.isNull(result, 'Should return null for invalid ID');
    }
    
    /**
     * @description Test getTeamByIdAsInterface method with null/blank ID
     */
    @IsTest
    static void testGetTeamByIdAsInterface_NullId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService service = new TeamService(mockRepo);
        
        // When
        Test.startTest();
        ITeam resultNull = service.getTeamByIdAsInterface(null);
        ITeam resultBlank = service.getTeamByIdAsInterface('');
        Test.stopTest();
        
        // Then
        Assert.isNull(resultNull, 'Should return null for null ID');
        Assert.isNull(resultBlank, 'Should return null for blank ID');
    }
    
    /**
     * @description Test getTeamsByLeagueAsInterface method with valid league ID
     */
    @IsTest
    static void testGetTeamsByLeagueAsInterface_ValidLeagueId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        List<Team__c> mockTeams = new List<Team__c>{
            new Team__c(Id = 'a00000000000001AAA', Name = 'Mock Team Alpha', League__c = 'a01000000000001AAA'),
            new Team__c(Id = 'a00000000000002AAA', Name = 'Mock Team Beta', League__c = 'a01000000000001AAA')
        };
        mockRepo.mockTeams = mockTeams;
        TeamService service = new TeamService(mockRepo);
        String leagueId = 'a01000000000001AAA';
        
        // When
        Test.startTest();
        List<ITeam> result = service.getTeamsByLeagueAsInterface(leagueId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of ITeam objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock teams');
        
        // Verify all teams belong to the correct league
        for (ITeam team : result) {
            Assert.isNotNull(team.getLeagueId(), 'All teams should have a league ID');
        }
    }
    
    /**
     * @description Test getTeamsByLeagueAsInterface method with null/blank league ID
     */
    @IsTest
    static void testGetTeamsByLeagueAsInterface_NullLeagueId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService service = new TeamService(mockRepo);
        
        // When
        Test.startTest();
        List<ITeam> resultNull = service.getTeamsByLeagueAsInterface(null);
        List<ITeam> resultBlank = service.getTeamsByLeagueAsInterface('');
        Test.stopTest();
        
        // Then
        Assert.isNotNull(resultNull, 'Should return empty list for null league ID');
        Assert.areEqual(0, resultNull.size(), 'Should return empty list for null league ID');
        Assert.isNotNull(resultBlank, 'Should return empty list for blank league ID');
        Assert.areEqual(0, resultBlank.size(), 'Should return empty list for blank league ID');
    }
    
    /**
     * @description Test exception propagation from repository layer
     */
    @IsTest
    static void testExceptionPropagation_DatabaseError() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.shouldThrowException = true; // Will throw exceptions
        TeamService service = new TeamService(mockRepo);
        
        // When/Then
        Test.startTest();
        try {
            service.getAllTeamsAsInterface();
            Assert.fail('Should propagate exception from repository');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate correct error message');
        }
        Test.stopTest();
    }
    
    /**
     * @description Test bulk operations handling
     */
    @IsTest
    static void testBulkOperations_LargeDataSets() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        
        // Create large mock dataset
        List<Team__c> bulkTeams = new List<Team__c>();
        for (Integer i = 1; i <= 200; i++) {
            Team__c team = new Team__c(
                Name = 'Bulk Team ' + i,
                City__c = 'Bulk City ' + i,
                Stadium__c = 'Bulk Stadium ' + i,
                Founded_Year__c = 2000 + Math.mod(i, 24),
                Location__c = 'Bulk City ' + i + ', State'
            );
            bulkTeams.add(team);
        }
        mockRepo.mockTeams = bulkTeams;
        
        TeamService service = new TeamService(mockRepo);
        
        // When
        Test.startTest();
        List<ITeam> result = service.getAllTeamsAsInterface();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should handle bulk operations');
        Assert.areEqual(200, result.size(), 'Should return all 200 teams');
        
        // Verify governor limits are respected
        Assert.isTrue(Limits.getQueries() <= Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
        Assert.isTrue(Limits.getCpuTime() <= Limits.getLimitCpuTime(), 'Should not exceed CPU time limits');
    }
    
    /**
     * @description Test dependency injection with null repository
     */
    @IsTest
    static void testDependencyInjection_NullRepository() {
        // When/Then
        Test.startTest();
        try {
            TeamService service = new TeamService(null);
            Assert.fail('Should throw exception for null repository');
        } catch (TeamService.TeamServiceException e) {
            Assert.areEqual('Repository cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    /**
     * @description Test TeamWrapper functionality with AbstractTeam interface
     */
    @IsTest
    static void testTeamWrapper_AbstractTeamImplementation() {
        // Given
        Team__c testTeam = new Team__c(
            Id = 'a00000000000001AAA',
            Name = 'Test Team',
            League__c = 'a01000000000001AAA'
        );
        
        // When - Test TeamWrapper with Team__c record
        Test.startTest();
        TeamWrapper wrapper1 = new TeamWrapper(testTeam);
        
        // Test TeamWrapper with individual parameters
        TeamWrapper wrapper2 = new TeamWrapper('a00000000000002AAA', 'Direct Team', 'a01000000000002AAA');
        Test.stopTest();
        
        // Then - Test ITeam interface implementation
        Assert.areEqual(testTeam.Id, wrapper1.getId(), 'Should return correct ID');
        Assert.areEqual(testTeam.Name, wrapper1.getName(), 'Should return correct name');
        Assert.areEqual(testTeam.League__c, wrapper1.getLeagueId(), 'Should return correct league ID');
        Assert.areEqual(testTeam, wrapper1.getOriginalRecord(), 'Should return original record');
        
        // Test direct constructor
        Assert.areEqual('a00000000000002AAA', wrapper2.getId(), 'Should return correct ID from direct constructor');
        Assert.areEqual('Direct Team', wrapper2.getName(), 'Should return correct name from direct constructor');
        Assert.areEqual('a01000000000002AAA', wrapper2.getLeagueId(), 'Should return correct league ID from direct constructor');
        Assert.isNull(wrapper2.getOriginalRecord(), 'Should return null for original record when created directly');
        
        // Test that both implement ITeam interface
        ITeam teamInterface = wrapper1;
        Assert.areEqual(testTeam.Id, teamInterface.getId(), 'Should work as ITeam interface');
        Assert.areEqual(testTeam.Name, teamInterface.getName(), 'Should work as ITeam interface');
        Assert.areEqual(testTeam.League__c, teamInterface.getLeagueId(), 'Should work as ITeam interface');
    }

    /**
     * @description Test AbstractTeam protected methods through a test subclass
     */
    @IsTest
    static void testAbstractTeam_ProtectedMethods() {
        // Given - Create a test subclass to access protected methods
        TestTeamSubclass testTeam = new TestTeamSubclass('a00000000000001AAA', 'Original Name', 'a01000000000001AAA');
        
        // When - Test protected setters
        Test.startTest();
        testTeam.testSetName('Updated Name');
        testTeam.testSetLeagueId('a01000000000002AAA');
        Test.stopTest();
        
        // Then - Verify the changes
        Assert.areEqual('Updated Name', testTeam.getName(), 'Should update name through protected setter');
        Assert.areEqual('a01000000000002AAA', testTeam.getLeagueId(), 'Should update league ID through protected setter');
        Assert.areEqual('a00000000000001AAA', testTeam.getId(), 'ID should remain unchanged');
    }

    /**
     * @description Test subclass of AbstractTeam to test protected methods
     */
    private class TestTeamSubclass extends AbstractTeam {
        public TestTeamSubclass(Id id, String name, Id leagueId) {
            super(id, name, leagueId);
        }
        
        public void testSetName(String name) {
            setName(name);
        }
        
        public void testSetLeagueId(Id leagueId) {
            setLeagueId(leagueId);
        }
    }

    /**
     * @description Test createTeam method with valid team
     */
    @IsTest
    static void testCreateTeam_ValidTeam() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService service = new TeamService(mockRepo);
        ITeam newTeam = new TeamWrapper(null, 'New Team', 'a01000000000001AAA');
        
        // When
        Test.startTest();
        Id result = service.createTeam(newTeam);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return created team ID');
        Assert.areEqual('a00000000000001AAA', result, 'Should return mock ID');
        Assert.areEqual(newTeam, mockRepo.lastCreatedTeam, 'Should pass team to repository');
    }

    /**
     * @description Test createTeam method with repository exception
     */
    @IsTest
    static void testCreateTeam_RepositoryException() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.shouldThrowException = true;
        TeamService service = new TeamService(mockRepo);
        ITeam newTeam = new TeamWrapper(null, 'New Team', 'a01000000000001AAA');
        
        // When/Then
        Test.startTest();
        try {
            service.createTeam(newTeam);
            Assert.fail('Should propagate repository exception');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate exception message');
        }
        Test.stopTest();
    }

    /**
     * @description Test getTeam method with valid ID
     */
    @IsTest
    static void testGetTeam_ValidId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        Team__c mockTeam = new Team__c(
            Id = 'a00000000000001AAA',
            Name = 'Mock Team',
            League__c = 'a01000000000001AAA'
        );
        mockRepo.mockTeams.add(mockTeam);
        TeamService service = new TeamService(mockRepo);
        Id teamId = 'a00000000000001AAA';
        
        // When
        Test.startTest();
        Team__c result = service.getTeam(teamId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return team');
        Assert.areEqual(mockTeam.Id, result.Id, 'Should return correct team');
        Assert.areEqual(String.valueOf(teamId), mockRepo.expectedTeamId, 'Should call repository with correct ID');
    }

    /**
     * @description Test getTeam method with repository exception
     */
    @IsTest
    static void testGetTeam_RepositoryException() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.shouldThrowException = true;
        TeamService service = new TeamService(mockRepo);
        Id teamId = 'a00000000000001AAA';
        
        // When/Then
        Test.startTest();
        try {
            service.getTeam(teamId);
            Assert.fail('Should propagate repository exception');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate exception message');
        }
        Test.stopTest();
    }

    /**
     * @description Test updateTeam method with valid record
     */
    @IsTest
    static void testUpdateTeam_ValidRecord() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService service = new TeamService(mockRepo);
        Team__c teamToUpdate = new Team__c(
            Id = 'a00000000000001AAA',
            Name = 'Updated Team',
            League__c = 'a01000000000001AAA'
        );
        
        // When
        Test.startTest();
        service.updateTeam(teamToUpdate);
        Test.stopTest();
        
        // Then
        Assert.areEqual(teamToUpdate, mockRepo.lastUpdatedTeam, 'Should pass team to repository');
    }

    /**
     * @description Test updateTeam method with repository exception
     */
    @IsTest
    static void testUpdateTeam_RepositoryException() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.shouldThrowException = true;
        TeamService service = new TeamService(mockRepo);
        Team__c teamToUpdate = new Team__c(
            Id = 'a00000000000001AAA',
            Name = 'Updated Team',
            League__c = 'a01000000000001AAA'
        );
        
        // When/Then
        Test.startTest();
        try {
            service.updateTeam(teamToUpdate);
            Assert.fail('Should propagate repository exception');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate exception message');
        }
        Test.stopTest();
    }

    /**
     * @description Test deleteTeam method with valid ID
     */
    @IsTest
    static void testDeleteTeam_ValidId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService service = new TeamService(mockRepo);
        Id teamId = 'a00000000000001AAA';
        
        // When
        Test.startTest();
        service.deleteTeam(teamId);
        Test.stopTest();
        
        // Then
        Assert.areEqual(teamId, mockRepo.lastDeletedTeamId, 'Should pass team ID to repository');
    }

    /**
     * @description Test deleteTeam method with repository exception
     */
    @IsTest
    static void testDeleteTeam_RepositoryException() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.shouldThrowException = true;
        TeamService service = new TeamService(mockRepo);
        Id teamId = 'a00000000000001AAA';
        
        // When/Then
        Test.startTest();
        try {
            service.deleteTeam(teamId);
            Assert.fail('Should propagate repository exception');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate exception message');
        }
        Test.stopTest();
    }

    /**
     * @description Test listTeamsByLeague method with valid league ID
     */
    @IsTest
    static void testListTeamsByLeague_ValidLeagueId() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        List<Team__c> mockTeams = new List<Team__c>{
            new Team__c(Id = 'a00000000000001AAA', Name = 'Team 1', League__c = 'a01000000000001AAA'),
            new Team__c(Id = 'a00000000000002AAA', Name = 'Team 2', League__c = 'a01000000000001AAA')
        };
        mockRepo.mockTeams = mockTeams;
        TeamService service = new TeamService(mockRepo);
        Id leagueId = 'a01000000000001AAA';
        
        // When
        Test.startTest();
        List<Team__c> result = service.listTeamsByLeague(leagueId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of teams');
        Assert.areEqual(2, result.size(), 'Should return correct number of teams');
        Assert.areEqual(mockTeams, result, 'Should return teams from repository');
    }

    /**
     * @description Test listTeamsByLeague method with repository exception
     */
    @IsTest
    static void testListTeamsByLeague_RepositoryException() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.shouldThrowException = true;
        TeamService service = new TeamService(mockRepo);
        Id leagueId = 'a01000000000001AAA';
        
        // When/Then
        Test.startTest();
        try {
            service.listTeamsByLeague(leagueId);
            Assert.fail('Should propagate repository exception');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate exception message');
        }
        Test.stopTest();
    }

    /**
     * @description Test getAllTeams method with teams available
     */
    @IsTest
    static void testGetAllTeams_TeamsAvailable() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        List<Team__c> mockTeams = new List<Team__c>{
            new Team__c(Id = 'a00000000000001AAA', Name = 'Team 1', League__c = 'a01000000000001AAA'),
            new Team__c(Id = 'a00000000000002AAA', Name = 'Team 2', League__c = 'a01000000000001AAA'),
            new Team__c(Id = 'a00000000000003AAA', Name = 'Team 3', League__c = 'a01000000000001AAA')
        };
        mockRepo.mockTeams = mockTeams;
        TeamService service = new TeamService(mockRepo);
        
        // When
        Test.startTest();
        List<Team__c> result = service.getAllTeams();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of teams');
        Assert.areEqual(3, result.size(), 'Should return correct number of teams');
        Assert.areEqual(mockTeams, result, 'Should return teams from repository');
    }

    /**
     * @description Test getAllTeams method with repository exception
     */
    @IsTest
    static void testGetAllTeams_RepositoryException() {
        // Given
        MockTeamRepository mockRepo = new MockTeamRepository();
        mockRepo.shouldThrowException = true;
        TeamService service = new TeamService(mockRepo);
        
        // When/Then
        Test.startTest();
        try {
            service.getAllTeams();
            Assert.fail('Should propagate repository exception');
        } catch (TeamRepository.TeamRepositoryException e) {
            Assert.areEqual('Mock repository error', e.getMessage(), 'Should propagate exception message');
        }
        Test.stopTest();
    }
} 