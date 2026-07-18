public abstract class AbstractPlayer implements IPlayer {
    @TestVisible private Id recordId;
    @TestVisible private String playerName;
    @TestVisible private Id teamId;

    protected AbstractPlayer(Id id, String name, Id teamId) {
        this.recordId = id;
        this.playerName = name;
        this.teamId = teamId;
    }

    // IPlayer implementation
    public Id getId() {
        return recordId;
    }

    public String getName() {
        return playerName;
    }

    public Id getTeamId() {
        return teamId;
    }

    // Helper methods for subclasses
    protected void setName(String name) {
        this.playerName = name;
    }

    protected void setTeamId(Id teamId) {
        this.teamId = teamId;
    }
}
