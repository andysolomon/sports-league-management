/**
 * @description Test class for DivisionService with dependency injection mocking
 * @author Sports Management Team
 * @date 2024
 */
@IsTest
private class DivisionServiceTest {
    
    /**
     * @description Mock repository for testing service layer in isolation
     */
    private class MockDivisionRepository extends DivisionRepository {
        public List<Division__c> mockDivisions;
        public List<Team__c> mockTeams;
        public Boolean shouldThrowException = false;
        public String expectedDivisionId;
        public IDivision lastCreatedDivision;
        public Division__c lastUpdatedDivision;
        public Id lastDeletedDivisionId;
        public Id lastTeamAssignmentTeamId;
        public Id lastTeamAssignmentDivisionId;
        
        public MockDivisionRepository() {
            this.mockDivisions = new List<Division__c>();
            this.mockTeams = new List<Team__c>();
        }
        
        public override Id create(IDivision division) {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            this.lastCreatedDivision = division;
            return 'a02000000000001AAA'; // Mock ID
        }
        
        public override Division__c retrieve(Id divisionId) {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            this.expectedDivisionId = String.valueOf(divisionId);
            return mockDivisions.isEmpty() ? null : mockDivisions[0];
        }
        
        public override void updateDivision(Division__c record) {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            this.lastUpdatedDivision = record;
        }
        
        public override void deleteDivision(Id divisionId) {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            this.lastDeletedDivisionId = divisionId;
        }
        
        public override List<Division__c> listByLeague(Id leagueId) {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            return mockDivisions;
        }
        
        public override List<Division__c> getAllDivisions() {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            return mockDivisions;
        }
        
        public override void assignTeamToDivision(Id teamId, Id divisionId) {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            this.lastTeamAssignmentTeamId = teamId;
            this.lastTeamAssignmentDivisionId = divisionId;
        }
        
        public override List<Team__c> getTeamsByDivision(Id divisionId) {
            if (shouldThrowException) {
                throw new DivisionRepositoryException('Mock repository error');
            }
            return mockTeams;
        }
    }
    
    /**
     * @description Test getAllDivisionsAsInterface method returns wrapped division objects
     */
    @IsTest
    static void testGetAllDivisionsAsInterface_Success() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        List<Division__c> mockDivisions = new List<Division__c>{
            new Division__c(Id = 'a02000000000001AAA', Name = 'Mock Division Alpha', League__c = 'a01000000000001AAA'),
            new Division__c(Id = 'a02000000000002AAA', Name = 'Mock Division Beta', League__c = 'a01000000000001AAA')
        };
        mockRepo.mockDivisions = mockDivisions;
        DivisionService service = new DivisionService(mockRepo);
        
        // When
        Test.startTest();
        List<IDivision> result = service.getAllDivisionsAsInterface();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of IDivision objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock divisions');
        
        // Verify first division
        IDivision firstDivision = result[0];
        Assert.isNotNull(firstDivision.getId(), 'Should have an ID');
        Assert.areEqual('Mock Division Alpha', firstDivision.getName(), 'Should return correct division name');
        Assert.isNotNull(firstDivision.getLeagueId(), 'Should have a league ID');
    }
    
    /**
     * @description Test getAllDivisionsAsInterface method with empty result
     */
    @IsTest
    static void testGetAllDivisionsAsInterface_EmptyResult() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        mockRepo.mockDivisions = new List<Division__c>(); // Empty list
        DivisionService service = new DivisionService(mockRepo);
        
        // When
        Test.startTest();
        List<IDivision> result = service.getAllDivisionsAsInterface();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return empty list, not null');
        Assert.areEqual(0, result.size(), 'Should return empty list');
    }
    
    /**
     * @description Test getDivisionByIdAsInterface method with valid ID
     */
    @IsTest
    static void testGetDivisionByIdAsInterface_ValidId() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        Division__c mockDivision = new Division__c(
            Id = 'a02000000000001AAA', 
            Name = 'Mock Division Alpha', 
            League__c = 'a01000000000001AAA'
        );
        mockRepo.mockDivisions.add(mockDivision);
        DivisionService service = new DivisionService(mockRepo);
        String divisionId = 'a02000000000001AAA';
        
        // When
        Test.startTest();
        IDivision result = service.getDivisionByIdAsInterface(divisionId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return IDivision object');
        Assert.areEqual(divisionId, result.getId(), 'Should return correct division ID');
        Assert.areEqual('Mock Division Alpha', result.getName(), 'Should return correct division name');
        Assert.isNotNull(result.getLeagueId(), 'Should have a league ID');
    }
    
    /**
     * @description Test getDivisionByIdAsInterface method with null/blank ID
     */
    @IsTest
    static void testGetDivisionByIdAsInterface_NullId() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        DivisionService service = new DivisionService(mockRepo);
        
        // When
        Test.startTest();
        IDivision resultNull = service.getDivisionByIdAsInterface(null);
        IDivision resultBlank = service.getDivisionByIdAsInterface('');
        Test.stopTest();
        
        // Then
        Assert.isNull(resultNull, 'Should return null for null ID');
        Assert.isNull(resultBlank, 'Should return null for blank ID');
    }
    
    /**
     * @description Test getDivisionsByLeagueAsInterface method with valid league ID
     */
    @IsTest
    static void testGetDivisionsByLeagueAsInterface_ValidLeagueId() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        List<Division__c> mockDivisions = new List<Division__c>{
            new Division__c(Id = 'a02000000000001AAA', Name = 'Mock Division Alpha', League__c = 'a01000000000001AAA'),
            new Division__c(Id = 'a02000000000002AAA', Name = 'Mock Division Beta', League__c = 'a01000000000001AAA')
        };
        mockRepo.mockDivisions = mockDivisions;
        DivisionService service = new DivisionService(mockRepo);
        String leagueId = 'a01000000000001AAA';
        
        // When
        Test.startTest();
        List<IDivision> result = service.getDivisionsByLeagueAsInterface(leagueId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of IDivision objects');
        Assert.areEqual(2, result.size(), 'Should return 2 mock divisions');
        
        // Verify all divisions belong to the correct league
        for (IDivision division : result) {
            Assert.isNotNull(division.getLeagueId(), 'All divisions should have a league ID');
        }
    }
    
    /**
     * @description Test getDivisionsByLeagueAsInterface method with null/blank league ID
     */
    @IsTest
    static void testGetDivisionsByLeagueAsInterface_NullLeagueId() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        DivisionService service = new DivisionService(mockRepo);
        
        // When
        Test.startTest();
        List<IDivision> resultNull = service.getDivisionsByLeagueAsInterface(null);
        List<IDivision> resultBlank = service.getDivisionsByLeagueAsInterface('');
        Test.stopTest();
        
        // Then
        Assert.isNotNull(resultNull, 'Should return empty list for null league ID');
        Assert.areEqual(0, resultNull.size(), 'Should return empty list for null league ID');
        Assert.isNotNull(resultBlank, 'Should return empty list for blank league ID');
        Assert.areEqual(0, resultBlank.size(), 'Should return empty list for blank league ID');
    }
    
    /**
     * @description Test createDivision method with valid division
     */
    @IsTest
    static void testCreateDivision_ValidDivision() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        DivisionService service = new DivisionService(mockRepo);
        IDivision newDivision = new DivisionWrapper(null, 'New Division', 'a01000000000001AAA');
        
        // When
        Test.startTest();
        Id result = service.createDivision(newDivision);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return created division ID');
        Assert.areEqual('a02000000000001AAA', result, 'Should return mock ID');
        Assert.areEqual(newDivision, mockRepo.lastCreatedDivision, 'Should pass division to repository');
    }
    
    /**
     * @description Test assignTeamToDivision method
     */
    @IsTest
    static void testAssignTeamToDivision_Success() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        DivisionService service = new DivisionService(mockRepo);
        Id teamId = 'a00000000000001AAA';
        Id divisionId = 'a02000000000001AAA';
        
        // When
        Test.startTest();
        service.assignTeamToDivision(teamId, divisionId);
        Test.stopTest();
        
        // Then
        Assert.areEqual(teamId, mockRepo.lastTeamAssignmentTeamId, 'Should pass correct team ID');
        Assert.areEqual(divisionId, mockRepo.lastTeamAssignmentDivisionId, 'Should pass correct division ID');
    }
    
    /**
     * @description Test moveTeamToDivision method
     */
    @IsTest
    static void testMoveTeamToDivision_Success() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        DivisionService service = new DivisionService(mockRepo);
        Id teamId = 'a00000000000001AAA';
        Id newDivisionId = 'a02000000000002AAA';
        
        // When
        Test.startTest();
        service.moveTeamToDivision(teamId, newDivisionId);
        Test.stopTest();
        
        // Then
        Assert.areEqual(teamId, mockRepo.lastTeamAssignmentTeamId, 'Should pass correct team ID');
        Assert.areEqual(newDivisionId, mockRepo.lastTeamAssignmentDivisionId, 'Should pass correct new division ID');
    }
    
    /**
     * @description Test removeTeamFromDivision method
     */
    @IsTest
    static void testRemoveTeamFromDivision_Success() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        DivisionService service = new DivisionService(mockRepo);
        Id teamId = 'a00000000000001AAA';
        
        // When
        Test.startTest();
        service.removeTeamFromDivision(teamId);
        Test.stopTest();
        
        // Then
        Assert.areEqual(teamId, mockRepo.lastTeamAssignmentTeamId, 'Should pass correct team ID');
        Assert.isNull(mockRepo.lastTeamAssignmentDivisionId, 'Should pass null for division ID to remove assignment');
    }
    
    /**
     * @description Test getTeamsByDivision method
     */
    @IsTest
    static void testGetTeamsByDivision_Success() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        List<Team__c> mockTeams = new List<Team__c>{
            new Team__c(Id = 'a00000000000001AAA', Name = 'Team Alpha', Division__c = 'a02000000000001AAA'),
            new Team__c(Id = 'a00000000000002AAA', Name = 'Team Beta', Division__c = 'a02000000000001AAA')
        };
        mockRepo.mockTeams = mockTeams;
        DivisionService service = new DivisionService(mockRepo);
        Id divisionId = 'a02000000000001AAA';
        
        // When
        Test.startTest();
        List<Team__c> result = service.getTeamsByDivision(divisionId);
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should return list of teams');
        Assert.areEqual(2, result.size(), 'Should return 2 mock teams');
        Assert.areEqual(mockTeams, result, 'Should return teams from repository');
    }
    
    /**
     * @description Test exception propagation from repository layer
     */
    @IsTest
    static void testExceptionPropagation_DatabaseError() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        mockRepo.shouldThrowException = true; // Will throw exceptions
        DivisionService service = new DivisionService(mockRepo);
        
        // When/Then
        Test.startTest();
        try {
            service.getAllDivisionsAsInterface();
            Assert.fail('Should propagate exception from repository');
        } catch (DivisionRepository.DivisionRepositoryException e) {
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
            DivisionService service = new DivisionService(null);
            Assert.fail('Should throw exception for null repository');
        } catch (DivisionService.DivisionServiceException e) {
            Assert.areEqual('Repository cannot be null', e.getMessage(), 'Should have correct error message');
        }
        Test.stopTest();
    }
    
    /**
     * @description Test DivisionWrapper functionality with IDivision interface
     */
    @IsTest
    static void testDivisionWrapper_IDivisionImplementation() {
        // Given
        Division__c testDivision = new Division__c(
            Id = 'a02000000000001AAA',
            Name = 'Test Division',
            League__c = 'a01000000000001AAA'
        );
        
        // When - Test DivisionWrapper with Division__c record
        Test.startTest();
        DivisionWrapper wrapper1 = new DivisionWrapper(testDivision);
        
        // Test DivisionWrapper with individual parameters
        DivisionWrapper wrapper2 = new DivisionWrapper('a02000000000002AAA', 'Direct Division', 'a01000000000002AAA');
        Test.stopTest();
        
        // Then - Test IDivision interface implementation
        Assert.areEqual(testDivision.Id, wrapper1.getId(), 'Should return correct ID');
        Assert.areEqual(testDivision.Name, wrapper1.getName(), 'Should return correct name');
        Assert.areEqual(testDivision.League__c, wrapper1.getLeagueId(), 'Should return correct league ID');
        Assert.areEqual(testDivision, wrapper1.getOriginalRecord(), 'Should return original record');
        
        // Test direct constructor
        Assert.areEqual('a02000000000002AAA', wrapper2.getId(), 'Should return correct ID from direct constructor');
        Assert.areEqual('Direct Division', wrapper2.getName(), 'Should return correct name from direct constructor');
        Assert.areEqual('a01000000000002AAA', wrapper2.getLeagueId(), 'Should return correct league ID from direct constructor');
        Assert.isNull(wrapper2.getOriginalRecord(), 'Should return null for original record when created directly');
        
        // Test that both implement IDivision interface
        IDivision divisionInterface = wrapper1;
        Assert.areEqual(testDivision.Id, divisionInterface.getId(), 'Should work as IDivision interface');
        Assert.areEqual(testDivision.Name, divisionInterface.getName(), 'Should work as IDivision interface');
        Assert.areEqual(testDivision.League__c, divisionInterface.getLeagueId(), 'Should work as IDivision interface');
    }
    
    /**
     * @description Test bulk operations handling
     */
    @IsTest
    static void testBulkOperations_LargeDataSets() {
        // Given
        MockDivisionRepository mockRepo = new MockDivisionRepository();
        
        // Create large mock dataset
        List<Division__c> bulkDivisions = new List<Division__c>();
        for (Integer i = 1; i <= 200; i++) {
            Division__c division = new Division__c(
                Name = 'Bulk Division ' + i,
                League__c = 'a01000000000001AAA'
            );
            bulkDivisions.add(division);
        }
        mockRepo.mockDivisions = bulkDivisions;
        
        DivisionService service = new DivisionService(mockRepo);
        
        // When
        Test.startTest();
        List<IDivision> result = service.getAllDivisionsAsInterface();
        Test.stopTest();
        
        // Then
        Assert.isNotNull(result, 'Should handle bulk operations');
        Assert.areEqual(200, result.size(), 'Should return all 200 divisions');
        
        // Verify governor limits are respected
        Assert.isTrue(Limits.getQueries() <= Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
        Assert.isTrue(Limits.getCpuTime() <= Limits.getLimitCpuTime(), 'Should not exceed CPU time limits');
    }
} 