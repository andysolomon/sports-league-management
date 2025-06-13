public abstract class AbstractTeam implements ITeam {
    @TestVisible private Id recordId;
    @TestVisible private String teamName;
    @TestVisible private Id leagueId;

    protected AbstractTeam(Id id, String name, Id leagueId) {
        this.recordId = id;
        this.teamName = name;
        this.leagueId = leagueId;
    }

    // ITeam implementation
    public Id getId() {
        return recordId;
    }

    public String getName() {
        return teamName;
    }

    public Id getLeagueId() {
        return leagueId;
    }

    // Helper methods for subclasses
    protected void setName(String name) {
        this.teamName = name;
    }

    protected void setLeagueId(Id leagueId) {
        this.leagueId = leagueId;
    }
} 