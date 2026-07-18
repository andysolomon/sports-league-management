# SF CLI and Salesforce Object Reference Guide

## Sports League Management System

This guide provides comprehensive information on using the Salesforce CLI (SF CLI) and Salesforce Object Reference effectively within the Sports League Management project.

## Table of Contents

1. [Project Overview](#project-overview)
2. [SF CLI Commands for Your Project](#sf-cli-commands-for-your-project)
3. [Custom Objects Structure](#custom-objects-structure)
4. [Salesforce Object Reference Integration](#salesforce-object-reference-integration)
5. [Practical SF CLI Workflows](#practical-sf-cli-workflows)
6. [Advanced SF CLI Usage](#advanced-sf-cli-usage)
7. [Best Practices](#best-practices)

## Project Overview

Your Sports League Management project is well-configured with:
- **Package Structure**: Core package (`sportsmgmt`) + Sport-specific packages (`sportsmgmt-football`)
- **API Version**: 58.0
- **Architecture**: SOLID principles with dependency injection
- **Testing**: Comprehensive Jest (LWC) and Apex test coverage (94% org-wide coverage)
- **Development Tools**: ESLint, Prettier, automated scripts

### Project Configuration Files
- `sfdx-project.json` - Package configuration
- `config/project-scratch-def.json` - Scratch org definition
- `package.json` - Node.js dependencies and scripts
- `.forceignore` - Files to exclude from deployments

### Project Architecture Overview

```mermaid
graph TB
    subgraph "Lightning Web Components"
        LWC1["Team Management<br/>Components"]
        LWC2["League Management<br/>Components"]
    end
    
    subgraph "Apex Controllers"
        CTRL["TeamDetailsController<br/>@AuraEnabled methods"]
    end
    
    subgraph "Service Layer"
        SVC["TeamService<br/>Business Logic"]
    end
    
    subgraph "Repository Layer"
        REPO["TeamRepository<br/>Data Access"]
        IREPO["ITeamRepository<br/>Interface"]
    end
    
    subgraph "Data Models"
        WRAPPER["TeamWrapper<br/>Data Transfer Object"]
        ABSTRACT["AbstractTeam<br/>Base Class"]
    end
    
    subgraph "Salesforce Objects"
        TEAM["Team__c<br/>Custom Object"]
        LEAGUE["League__c<br/>Custom Object"]
    end
    
    LWC1 --> CTRL
    LWC2 --> CTRL
    CTRL --> SVC
    SVC --> IREPO
    IREPO --> REPO
    REPO --> TEAM
    REPO --> LEAGUE
    SVC --> WRAPPER
    WRAPPER --> ABSTRACT
    TEAM --> LEAGUE
```

## SF CLI Commands for Your Project

### Project Management

```bash
# Deploy your entire project
sf project deploy start

# Deploy specific components
sf project deploy start --source-dir sportsmgmt/main/default/lwc
sf project deploy start --source-dir sportsmgmt/main/default/classes
sf project deploy start --source-dir sportsmgmt/main/default/objects

# Retrieve metadata from org
sf project retrieve start --source-dir sportsmgmt/main/default
sf project retrieve start --metadata CustomObject:Team__c,CustomObject:League__c
```

### Scratch Org Management

```bash
# Create scratch org (automated via your scripts)
sf org create scratch --definition-file config/project-scratch-def.json --alias sports-dev --duration-days 30

# Use your automated script (recommended)
node scripts/create-scratch-org.js sports-dev 30

# Open your scratch org
sf org open --target-org sports-dev

# List all orgs
sf org list

# Delete scratch org when done
sf org delete scratch --target-org sports-dev --no-prompt
```

### Testing and Quality

```bash
# Run Apex tests
sf apex test run --wait 10 --code-coverage --result-format human

# Run specific test classes
sf apex test run --tests TeamRepositoryTest,TeamServiceTest,TeamDetailsControllerTest --wait 10

# Run LWC tests (Jest)
sf force lightning lwc test run

# Run LWC tests in watch mode
sf force lightning lwc test run --watch

# Run with coverage
npm run test:unit
```

### Data Management

```bash
# Query your custom objects
sf data query --query "SELECT Id, Name FROM Team__c LIMIT 10"
sf data query --query "SELECT Id, Name, RecordType.Name FROM League__c"

# Query with relationships
sf data query --query "SELECT Id, Name, City__c, Stadium__c, League__r.Name FROM Team__c"

# Import/export data
sf data export tree --query "SELECT Id, Name FROM Team__c" --output-dir data/export
sf data import tree --plan data/league-team-plan.json

# Create records
sf data create record --sobject Team__c --values "Name='Test Team' City__c='Test City'"
```

## Custom Objects Structure

### Data Model Overview

```mermaid
erDiagram
    League__c {
        Id Id PK
        Name Name
        RecordTypeId RecordTypeId
        CreatedDate CreatedDate
        LastModifiedDate LastModifiedDate
    }
    
    Team__c {
        Id Id PK
        Name Name
        City__c City
        Stadium__c Stadium
        Founded_Year__c Founded_Year
        League__c League_Id FK
        Location__c Location
        CreatedDate CreatedDate
        LastModifiedDate LastModifiedDate
    }
    
    RecordType {
        Id Id PK
        DeveloperName DeveloperName
        Name Name
        SobjectType SobjectType
    }
    
    League__c ||--o{ Team__c : "has many"
    RecordType ||--o{ League__c : "classifies"
```

### 1. League__c (Parent Object)

**Purpose**: Represents sports leagues (NFL, MLS, etc.)

**Key Fields**:
- `Name` - League name (e.g., "National Football League")
- `RecordType` - Professional or Amateur league classification

**Relationships**:
- One-to-Many with `Team__c`

**Record Types**:
- `Professional` - Professional sports leagues
- `Amateur` - Amateur and recreational leagues

**Object Features**:
- History tracking enabled
- Reports and dashboards enabled
- Search enabled
- Bulk API enabled

### 2. Team__c (Child Object)

**Purpose**: Represents teams within leagues

**Key Fields**:
- `Name` - Team name (e.g., "Dallas Cowboys")
- `City__c` - Team's home city (Text, 100 chars)
- `Stadium__c` - Home stadium name (Text, 100 chars)
- `Founded_Year__c` - Year team was founded (Number, 4 digits)
- `League__c` - Lookup to League__c (required)
- `Location__c` - Geographic location information

**Relationships**:
- Many-to-One with `League__c` (Lookup relationship)
- Delete constraint: Restrict (prevents league deletion if teams exist)

**Object Features**:
- History tracking enabled
- Reports and dashboards enabled
- Search enabled
- Bulk API and Streaming API enabled

### Class Architecture Diagram

```mermaid
classDiagram
    class ITeamRepository {
        <<interface>>
        +retrieve(Id teamId) TeamWrapper
        +listByLeague(Id leagueId) List~TeamWrapper~
        +getAllTeams() List~TeamWrapper~
        +create(TeamWrapper team) TeamWrapper
        +updateTeam(TeamWrapper team) TeamWrapper
        +deleteTeam(Id teamId) void
    }
    
    class TeamRepository {
        +retrieve(Id teamId) TeamWrapper
        +listByLeague(Id leagueId) List~TeamWrapper~
        +getAllTeams() List~TeamWrapper~
        +create(TeamWrapper team) TeamWrapper
        +updateTeam(TeamWrapper team) TeamWrapper
        +deleteTeam(Id teamId) void
        -buildTeamWrapper(Team__c team) TeamWrapper
    }
    
    class TeamService {
        -ITeamRepository repository
        +TeamService(ITeamRepository repo)
        +getTeam(Id teamId) TeamWrapper
        +getAllTeams() List~TeamWrapper~
        +listTeamsByLeague(Id leagueId) List~TeamWrapper~
        +createTeam(TeamWrapper team) TeamWrapper
        +updateTeam(TeamWrapper team) TeamWrapper
        +deleteTeam(Id teamId) void
    }
    
    class TeamDetailsController {
        +getTeamById(Id teamId) TeamWrapper
        +getAllTeams() List~TeamWrapper~
        +getTeamsByLeague(Id leagueId) List~TeamWrapper~
        -convertToTeamRecord(TeamWrapper wrapper) Team__c
    }
    
    class AbstractTeam {
        #String name
        #String city
        #String stadium
        #Integer foundedYear
        #Id leagueId
        #String location
        +AbstractTeam()
        +AbstractTeam(String name, String city, String stadium, Integer year, Id league, String location)
        +getName() String
        +getCity() String
        +getStadium() String
        +getFoundedYear() Integer
        +getLeagueId() Id
        +getLocation() String
    }
    
    class TeamWrapper {
        -Team__c originalRecord
        +TeamWrapper(Team__c record)
        +TeamWrapper(String name, String city, String stadium, Integer year, Id league, String location)
        +getOriginalRecord() Team__c
        +clone() TeamWrapper
    }
    
    ITeamRepository <|.. TeamRepository : implements
    TeamService --> ITeamRepository : uses
    TeamDetailsController --> TeamService : uses
    AbstractTeam <|-- TeamWrapper : extends
    TeamWrapper --> Team__c : wraps
```

## Salesforce Object Reference Integration

### Understanding Standard vs Custom Objects

Your project uses custom objects but should integrate with standard Salesforce objects:

| Standard Object | Usage in Sports Management | Integration Points |
|----------------|---------------------------|-------------------|
| **User** | Team managers, league administrators | Owner fields, assignment rules |
| **Account** | Team organizations, sponsors | Business relationships |
| **Contact** | Players, coaches, officials | Person records |
| **Event** | Games, practices, meetings | Calendar integration |
| **Task** | Team management activities | Workflow automation |

### Field Types and Best Practices

Your objects use these field types effectively:

| Field Type | Usage | Example | Best Practice |
|------------|-------|---------|---------------|
| **Text** | Names, descriptions | `City__c`, `Stadium__c` | Set appropriate length limits |
| **Number** | Years, scores, counts | `Founded_Year__c` | Use precision/scale correctly |
| **Lookup** | Relationships | `League__c` | Consider cascade behavior |
| **Picklist** | Controlled values | RecordType | Use for standardization |

### Relationship Design Best Practices

Your data model follows Salesforce best practices:

✅ **Good Practices in Your Model**:
- Lookup relationship allows flexibility
- Proper delete constraint (Restrict)
- Meaningful relationship names
- Required fields appropriately marked

✅ **Considerations for Extension**:
- Player__c → Team__c (Many-to-One)
- Game__c → Team__c (Many-to-Many via junction)
- Season__c → League__c (Many-to-One)

### Future Data Model Extensions

```mermaid
erDiagram
    League__c {
        Id Id PK
        Name Name
        RecordTypeId RecordTypeId
    }
    
    Team__c {
        Id Id PK
        Name Name
        City__c City
        Stadium__c Stadium
        League__c League_Id FK
    }
    
    Player__c {
        Id Id PK
        Name Name
        Position__c Position
        Jersey_Number__c Jersey_Number
        Team__c Team_Id FK
    }
    
    Season__c {
        Id Id PK
        Name Name
        Start_Date__c Start_Date
        End_Date__c End_Date
        League__c League_Id FK
    }
    
    Game__c {
        Id Id PK
        Name Name
        Game_Date__c Game_Date
        Home_Team__c Home_Team_Id FK
        Away_Team__c Away_Team_Id FK
        Season__c Season_Id FK
    }
    
    League__c ||--o{ Team__c : "has many"
    Team__c ||--o{ Player__c : "has many"
    League__c ||--o{ Season__c : "has many"
    Season__c ||--o{ Game__c : "has many"
    Team__c ||--o{ Game__c : "home team"
    Team__c ||--o{ Game__c : "away team"
```

## Practical SF CLI Workflows

### 1. Development Workflow

```mermaid
flowchart TD
    A["Start Development"] --> B["Create Scratch Org<br/>node scripts/create-scratch-org.js"]
    B --> C["Deploy Objects<br/>sf project deploy start --source-dir objects"]
    C --> D["Deploy Classes<br/>sf project deploy start --source-dir classes"]
    D --> E["Deploy LWC<br/>sf project deploy start --source-dir lwc"]
    E --> F["Load Test Data<br/>sf data import tree --plan data/plan.json"]
    F --> G["Run Apex Tests<br/>sf apex test run --wait 10"]
    G --> H["Run LWC Tests<br/>sf force lightning lwc test run"]
    H --> I{"Tests Pass?"}
    I -->|Yes| J["Open Org<br/>sf org open"]
    I -->|No| K["Fix Issues"]
    K --> G
    J --> L["Manual Testing"]
    L --> M["Ready for Production"]
```

```bash
# 1. Create and setup scratch org
node scripts/create-scratch-org.js sports-dev 30

# 2. Deploy your changes incrementally
sf project deploy start --source-dir sportsmgmt/main/default/objects
sf project deploy start --source-dir sportsmgmt/main/default/classes
sf project deploy start --source-dir sportsmgmt/main/default/lwc

# 3. Load test data
sf data import tree --plan data/league-team-plan.json

# 4. Run tests
sf apex test run --tests TeamRepositoryTest,TeamServiceTest,TeamDetailsControllerTest --wait 10

# 5. Test LWC components
sf force lightning lwc test run

# 6. Open org to verify
sf org open --target-org sports-dev
```

### 2. Data Management Workflow

```mermaid
flowchart LR
    A["Create Leagues"] --> B["Create Teams"]
    B --> C["Validate Relationships"]
    C --> D["Export for Backup"]
    D --> E["Query Performance Check"]
    
    subgraph "Data Creation"
        A1["Professional Leagues<br/>NFL, MLS, NBA"]
        A2["Amateur Leagues<br/>Local, College"]
    end
    
    subgraph "Team Creation"
        B1["NFL Teams<br/>Cowboys, Patriots"]
        B2["MLS Teams<br/>FC Dallas, Revolution"]
    end
    
    A --> A1
    A --> A2
    B --> B1
    B --> B2
```

```bash
# Create sample leagues
sf data create record --sobject League__c --values "Name='NFL' RecordTypeId=[Professional_RT_ID]"
sf data create record --sobject League__c --values "Name='MLS' RecordTypeId=[Professional_RT_ID]"

# Create sample teams
sf data create record --sobject Team__c --values "Name='Dallas Cowboys' City__c='Dallas' Stadium__c='AT&T Stadium' Founded_Year__c=1960 League__c=[NFL_ID]"
sf data create record --sobject Team__c --values "Name='New England Patriots' City__c='Foxborough' Stadium__c='Gillette Stadium' Founded_Year__c=1960 League__c=[NFL_ID]"

# Query with relationships
sf data query --query "SELECT Id, Name, City__c, Stadium__c, League__r.Name FROM Team__c WHERE League__r.Name = 'NFL'"

# Export data for backup
sf data export tree --query "SELECT Id, Name, City__c, Stadium__c, Founded_Year__c, League__c FROM Team__c" --output-dir data/backup
```

### 3. Testing and Validation Workflow

```mermaid
flowchart TD
    A["Start Testing"] --> B["Run Unit Tests<br/>sf apex test run"]
    B --> C{"Coverage > 90%?"}
    C -->|No| D["Add More Tests"]
    D --> B
    C -->|Yes| E["Run Integration Tests"]
    E --> F["Run LWC Tests<br/>sf force lightning lwc test run"]
    F --> G["Validate Deployment<br/>sf project deploy validate"]
    G --> H{"Validation Pass?"}
    H -->|No| I["Fix Issues"]
    I --> B
    H -->|Yes| J["Ready for Deployment"]
    
    subgraph "Test Coverage Achieved"
        K["94% Org-Wide Coverage<br/>60 Total Tests<br/>100% Pass Rate"]
    end
    
    J --> K
```

```bash
# Run all tests with coverage
sf apex test run --wait 10 --code-coverage --result-format human

# Run specific test suites
sf apex test run --tests TeamRepositoryTest --wait 10 --code-coverage
sf apex test run --tests TeamServiceTest --wait 10 --code-coverage
sf apex test run --tests TeamDetailsControllerTest --wait 10 --code-coverage

# Run LWC tests
sf force lightning lwc test run --watch

# Validate deployment without deploying
sf project deploy validate --source-dir sportsmgmt

# Check code coverage
sf apex get test --test-run-id [TEST_RUN_ID] --code-coverage
```

### 4. Package Management Workflow

```mermaid
flowchart LR
    A["Create Package Version"] --> B["Test in Scratch Org"]
    B --> C["Install in UAT"]
    C --> D["User Acceptance Testing"]
    D --> E{"UAT Pass?"}
    E -->|No| F["Fix Issues"]
    F --> A
    E -->|Yes| G["Promote Version"]
    G --> H["Install in Production"]
    
    subgraph "Package Structure"
        I["sportsmgmt<br/>Core Package"]
        J["sportsmgmt-football<br/>Sport-Specific"]
    end
    
    A --> I
    A --> J
```

```bash
# Create package versions (using your automation)
./scripts/package-management.sh create-versions --wait 15

# List package versions
sf package version list --package "Sports Management Core"

# Install packages in target org
sf package install --package [PACKAGE_VERSION_ID] --target-org production --wait 10

# Promote package version
sf package version promote --package [PACKAGE_VERSION_ID]
```

## Advanced SF CLI Usage

### Schema Validation and Analysis

```bash
# Describe your objects
sf sobject describe --sobject League__c
sf sobject describe --sobject Team__c

# List all custom objects
sf sobject list --sobject-type custom

# Get detailed field information
sf sobject describe --sobject Team__c --json | jq '.fields[] | {name: .name, type: .type, label: .label}'

# Validate your object relationships
sf data query --query "SELECT COUNT() FROM Team__c WHERE League__c = null"

# Check for orphaned records
sf data query --query "SELECT Id, Name FROM Team__c WHERE League__c NOT IN (SELECT Id FROM League__c)"

# Validate field usage
sf data query --query "SELECT COUNT() FROM Team__c WHERE City__c != null"
sf data query --query "SELECT COUNT() FROM Team__c WHERE Stadium__c != null"
```

### Performance Monitoring

```mermaid
graph TB
    A["Performance Monitoring"] --> B["SOQL Query Analysis"]
    A --> C["API Usage Monitoring"]
    A --> D["Governor Limits Check"]
    
    B --> B1["Query Execution Time"]
    B --> B2["Record Count Analysis"]
    B --> B3["Index Usage Validation"]
    
    C --> C1["Daily API Calls"]
    C --> C2["Bulk API Usage"]
    C --> C3["Streaming API Limits"]
    
    D --> D1["SOQL Queries (100/200)"]
    D --> D2["DML Statements (150)"]
    D --> D3["Heap Size (6MB/12MB)"]
    D --> D4["CPU Time (10s/60s)"]
```

```bash
# Check SOQL query performance
sf data query --query "SELECT Id, Name, (SELECT Id, Name FROM Teams__r) FROM League__c" --perflog

# Monitor API usage
sf org display --target-org sports-dev --json | jq '.result.limits'

# Check governor limits
sf apex run --file scripts/check-limits.apex
```

### Metadata Comparison and Synchronization

```bash
# Compare local vs org metadata
sf project retrieve start --metadata CustomObject:Team__c --target-org sports-dev
sf project deploy validate --source-dir sportsmgmt --target-org sports-dev

# Generate metadata report
sf project deploy report --job-id [DEPLOY_ID]

# Retrieve specific metadata types
sf project retrieve start --metadata CustomObject,CustomField,LightningComponentBundle
```

### Data Quality and Maintenance

```bash
# Find duplicate teams
sf data query --query "SELECT Name, COUNT(Id) FROM Team__c GROUP BY Name HAVING COUNT(Id) > 1"

# Validate data integrity
sf data query --query "SELECT Id, Name FROM Team__c WHERE League__r.Id = null"

# Clean up test data
sf data delete bulk --sobject Team__c --file data/test-teams-to-delete.csv
```

## Best Practices

### 1. Object Design Best Practices

```mermaid
mindmap
  root((Object Design<br/>Best Practices))
    Field Naming
      Descriptive Names
      Consistent Conventions
      Appropriate Types
    Relationships
      Proper Constraints
      Meaningful Names
      Flexible Design
    Object Features
      History Tracking
      Reports Enabled
      Search Enabled
      Bulk API Support
    Security
      Field-Level Security
      Object Permissions
      Sharing Rules
      Validation Rules
```

✅ **Field Naming**:
- Use descriptive names: `Founded_Year__c` not `Year__c`
- Follow naming conventions: `City__c`, `Stadium__c`
- Use appropriate field types and lengths

✅ **Relationship Design**:
- Use Lookup for flexible relationships
- Set appropriate delete constraints
- Name relationships meaningfully: `Teams__r`

✅ **Object Features**:
- Enable history tracking for audit trails
- Enable reports for analytics
- Enable search for findability
- Consider bulk API for data loading

### 2. SF CLI Best Practices

✅ **Development Workflow**:
- Use scratch orgs for development
- Deploy incrementally during development
- Run tests frequently
- Use your automated scripts

✅ **Data Management**:
- Use data plans for complex imports
- Export data before major changes
- Validate data integrity regularly
- Use bulk operations for large datasets

✅ **Testing Strategy**:
- Run tests before deployment
- Maintain high code coverage (>90%)
- Test both positive and negative scenarios
- Use dependency injection for mocking

### 3. Performance Optimization

```mermaid
graph LR
    A["Performance Optimization"] --> B["SOQL Best Practices"]
    A --> C["Bulk Operations"]
    A --> D["Governor Limits"]
    
    B --> B1["Selective WHERE Clauses"]
    B --> B2["Indexed Fields"]
    B --> B3["Avoid Queries in Loops"]
    B --> B4["Limit Result Sets"]
    
    C --> C1["Design for Bulk"]
    C --> C2["Test with 200+ Records"]
    C --> C3["Batch Processing"]
    C --> C4["Monitor Limits"]
    
    D --> D1["SOQL Queries: 100/200"]
    D --> D2["DML Statements: 150"]
    D --> D3["Heap Size: 6MB/12MB"]
    D --> D4["CPU Time: 10s/60s"]
```

✅ **SOQL Queries**:
- Use selective WHERE clauses
- Avoid queries in loops
- Use indexed fields when possible
- Limit result sets appropriately

✅ **Bulk Operations**:
- Design for bulk processing
- Test with 200+ records
- Use batch processing for large datasets
- Monitor governor limits

### 4. Security and Access Control

✅ **Field-Level Security**:
- Implement proper FLS checks
- Use `with sharing` in Apex classes
- Validate user permissions
- Test with different user profiles

✅ **Data Access**:
- Use appropriate sharing models
- Implement proper access controls
- Validate CRUD permissions
- Test security scenarios

### 5. Test Coverage Achievement

```mermaid
pie title Test Coverage by Class
    "AbstractTeam" : 100
    "TeamService" : 100
    "TeamWrapper" : 100
    "TeamDetailsController" : 96
    "TeamRepository" : 81
```

**Current Achievement**: 94% org-wide coverage with 60 total tests

## Useful Commands Reference

### Quick Commands

```bash
# Open current default org
sf org open

# Check current configuration
sf config list

# View org limits
sf org display --json | jq '.result.limits'

# Run quick test
sf apex run --file scripts/quick-test.apex

# Deploy and test in one command
sf project deploy start && sf apex test run --wait 5
```

### Troubleshooting Commands

```bash
# Check deployment status
sf project deploy report --job-id [DEPLOY_ID]

# View recent deployments
sf project deploy report --use-most-recent

# Check test results
sf apex get test --test-run-id [TEST_RUN_ID]

# Validate without deploying
sf project deploy validate --source-dir sportsmgmt
```

### Data Export/Import Templates

```bash
# Export leagues
sf data export tree --query "SELECT Id, Name, RecordType.DeveloperName FROM League__c" --output-dir data/export

# Export teams with relationships
sf data export tree --query "SELECT Id, Name, City__c, Stadium__c, Founded_Year__c, League__c FROM Team__c" --output-dir data/export

# Import with plan
sf data import tree --plan data/league-team-plan.json
```

## Conclusion

This guide provides a comprehensive foundation for working with SF CLI and Salesforce Object Reference in your Sports Management project. Your current architecture follows Salesforce best practices and provides a solid foundation for extension.

### Current Project Status

```mermaid
graph LR
    A["Project Status"] --> B["✅ 94% Test Coverage"]
    A --> C["✅ 60 Total Tests"]
    A --> D["✅ 100% Pass Rate"]
    A --> E["✅ SOLID Architecture"]
    A --> F["✅ Dependency Injection"]
    A --> G["✅ Comprehensive Documentation"]
```

### Next Steps

1. **Extend the Data Model**: Add Player__c, Game__c, Season__c objects
2. **Implement Advanced Features**: Triggers, flows, custom settings
3. **Add Sport-Specific Packages**: Extend the football package
4. **Implement Analytics**: Reports, dashboards, Einstein Analytics
5. **Add Integration**: External APIs, third-party systems

### Resources

- [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/)
- [Salesforce Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/)
- [Lightning Web Components Developer Guide](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- [Mermaid Documentation](https://mermaid.js.org/) 