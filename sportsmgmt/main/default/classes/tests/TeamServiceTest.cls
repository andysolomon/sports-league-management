@IsTest
private class TeamServiceTest {

    // Mock repository to isolate service logic
    private class MockTeamRepository extends TeamRepository {
        public Id lastCreatedId;
        public override Id create(ITeam t) {
            lastCreatedId = 'a00000000000001AAA';
            return lastCreatedId;
        }
        public override Team__c retrieve(Id teamId) {
            return new Team__c(Name = 'Mock Team');
        }
        public override void updateTeam(Team__c rec) {}
        public override void deleteTeam(Id teamId) {}
        public override List<Team__c> listByLeague(Id leagueId) {
            return new List<Team__c>{ new Team__c(Name = 'Mock Team') };
        }
    }

    // Simple concrete implementation of AbstractTeam for tests
    private class TestTeam extends AbstractTeam {
        TestTeam(String name, Id leagueId) {
            super(null, name, leagueId);
        }
    }

    @IsTest static void crudFlow() {
        MockTeamRepository mockRepo = new MockTeamRepository();
        TeamService svc = new TeamService(mockRepo);

        // CREATE
        ITeam team = new TestTeam('My Team', UserInfo.getUserId());
        Id createdId = svc.createTeam(team);
        System.assertNotEquals(null, createdId, 'Id should not be null');

        // READ
        Team__c fetched = svc.getTeam(createdId);
        System.assertEquals('Mock Team', fetched.Name);

        // UPDATE (should not throw)
        svc.updateTeam(fetched);

        // LIST
        List<Team__c> teams = svc.listTeamsByLeague(fetched.League__c);
        System.assertEquals(1, teams.size(), 'Should return one team');

        // DELETE (should not throw)
        svc.deleteTeam(createdId);
    }
} 