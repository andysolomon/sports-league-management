@isTest
private class TeamServiceTest {
    // Fake implementation of TeamRepository for unit testing (mock object)
    private class MockTeamRepository extends TeamRepository {
        public Id lastCreatedId;
        public override Id create(ITeam team) {
            // Simulate DML by returning a fake Id
            lastCreatedId = Id.valueOf('001000000000001AAA');
            return lastCreatedId;
        }

        public override Team__c retrieve(Id teamId) {
            return new Team__c(Id = teamId, Name = 'Mock Team', League__c = 'a0L000000000001AAA');
        }

        public override void updateTeam(Team__c record) {
            // No-op
        }

        public override void deleteTeam(Id teamId) {
            // No-op
        }

        public override List<Team__c> listByLeague(Id leagueId) {
            return new List<Team__c>{ new Team__c(Id = '001000000000002AAA', Name = 'Mock Team', League__c = leagueId) };
        }
    }

    @isTest
    static void testCrudOperations() {
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService service = new TeamService(mockRepo);

        // Create
        ITeam newTeam = new AbstractTeam(null, 'My Team', UserInfo.getUserId()) {};
        Id createdId = service.createTeam(newTeam);
        System.assertNotEquals(null, createdId, 'Created Id should not be null');
        System.assertEquals(mockRepo.lastCreatedId, createdId, 'Created Id should match mock');

        // Retrieve
        Team__c retrieved = service.getTeam(createdId);
        System.assertEquals('Mock Team', retrieved.Name);

        // Update should not throw
        service.updateTeam(retrieved);

        // List
        List<Team__c> teams = service.listTeamsByLeague(retrieved.League__c);
        System.assertEquals(1, teams.size());

        // Delete should not throw
        service.deleteTeam(createdId);
    }
} 