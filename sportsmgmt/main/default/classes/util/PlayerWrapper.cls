public class PlayerWrapper extends AbstractPlayer {
    private Player__c originalRecord;
    private String position;
    private Decimal jerseyNumber;
    private Date dateOfBirth;
    private String status;

    /**
     * Constructor that takes a Player__c record and wraps it
     */
    public PlayerWrapper(Player__c player) {
        super(player.Id, player.Name, player.Team__c);
        this.originalRecord = player;
        this.position = player.Position__c;
        this.jerseyNumber = player.Jersey_Number__c;
        this.dateOfBirth = player.Date_of_Birth__c;
        this.status = player.Status__c;
    }

    /**
     * Constructor for creating new player instances from primitives
     */
    public PlayerWrapper(Id id, String name, Id teamId, String position, Decimal jerseyNumber, Date dateOfBirth, String status) {
        super(id, name, teamId);
        this.originalRecord = null;
        this.position = position;
        this.jerseyNumber = jerseyNumber;
        this.dateOfBirth = dateOfBirth;
        this.status = status;
    }

    // IPlayer implementation for domain-specific methods
    public String getPosition() {
        return this.position;
    }

    public Decimal getJerseyNumber() {
        return this.jerseyNumber;
    }

    public Date getDateOfBirth() {
        return this.dateOfBirth;
    }

    public String getStatus() {
        return this.status;
    }

    /**
     * Gets the original Player__c record if available
     */
    public Player__c getOriginalRecord() {
        return this.originalRecord;
    }
}
