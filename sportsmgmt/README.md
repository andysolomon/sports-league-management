# Sports Management Core Package

## Overview

The Sports Management Core package provides the foundational framework for sports league management on the Salesforce platform. It contains all sport-agnostic functionality — custom objects, Apex services, REST API endpoints, and Lightning Web Components — and serves as the base dependency for sport-specific extension packages.

## Package Information

- **Package Name:** Sports Management Core
- **Package ID:** 0Hobm0000000TMzCAM
- **Package Type:** Unlocked
- **Version:** 1.0.0.NEXT
- **API Version:** 58.0

## Data Model

```
League__c (1) ──── (n) Division__c
League__c (1) ──── (n) Team__c
League__c (1) ──── (n) Season__c
Division__c (1) ── (n) Team__c (via lookup)
Team__c   (1) ──── (n) Player__c
```

### Custom Objects

| Object | Key Fields | Description |
|---|---|---|
| `League__c` | Name, RecordType | Parent object with Professional/Amateur record types |
| `Division__c` | Name, League (lookup) | Divisions within a league |
| `Team__c` | Name, City, Stadium, Founded_Year, Location, League (lookup), Division (lookup) | Teams with full detail fields |
| `Player__c` | Name, Position, Jersey Number, Status, Date of Birth, Team (lookup) | Player profiles linked to teams |
| `Season__c` | Name, Start Date, End Date, Status, League (lookup) | Season management with date ranges |

## Apex Architecture

Organized into a layered architecture following SOLID principles:

```
classes/
├── lightning/     Controllers (LWC ↔ Apex bridge)
├── service/       Services + Repositories (business logic + data access)
├── rest/          REST API endpoints (/sportsmgmt/v1/*)
├── util/          Interfaces, abstract classes, wrappers, logging
├── invocable/     Flow-invocable actions
└── tests/         All test classes
```

### Controllers (`classes/lightning/`)

| Class | Purpose |
|---|---|
| `DivisionManagementController` | Division CRUD, team assignment |
| `PlayerRosterController` | Player CRUD within a team |
| `SeasonManagementController` | Season CRUD |
| `TeamDetailsController` | Team detail views, league filtering |

### Services and Repositories (`classes/service/`)

| Service | Repository | Domain |
|---|---|---|
| `DivisionService` | `DivisionRepository` | Division CRUD, team assignment/removal |
| `LeagueService` | `LeagueRepository` | League retrieval |
| `PlayerService` | `PlayerRepository` | Player CRUD, team roster queries |
| `SeasonService` | `SeasonRepository` | Season CRUD, league filtering |
| `TeamService` | `TeamRepository` | Team CRUD, league filtering |

### REST API (`classes/rest/`)

All endpoints are under `/services/apexrest/sportsmgmt/v1/`:

| Resource | Endpoint | Methods |
|---|---|---|
| `LeagueRestResource` | `/leagues` | GET (all, by ID) |
| `DivisionRestResource` | `/divisions` | GET (all, by ID, by league) |
| `TeamRestResource` | `/teams` | GET (all, by ID, by league), PUT |
| `PlayerRestResource` | `/players` | GET (all, by ID, by team), POST, PUT, DELETE |
| `SeasonRestResource` | `/seasons` | GET (all, by ID, by league) |

Response envelope: `RestResponseDto` with `success`, `data`, and `error` fields. Utilities in `RestUtils`.

### Domain Layer (`classes/util/`)

| Type | Classes | Purpose |
|---|---|---|
| Interfaces | `IDivision`, `ITeam`, `IPlayer`, `ISeason`, `ILeague` | Domain contracts for loose coupling |
| Abstracts | `AbstractTeam`, `AbstractPlayer` | Base implementations with common logic |
| Wrappers | `DivisionWrapper`, `TeamWrapper`, `PlayerWrapper`, `SeasonWrapper`, `LeagueWrapper` | Bridge domain interfaces and sObjects |
| Utilities | `StructuredLogger` | JSON-based structured logging |

### Lightning Web Components

| Component | Description |
|---|---|
| `divisionManagement` | Division list with CRUD operations |
| `playerRoster` | Player roster management within a team |
| `seasonManagement` | Season list and management |
| `teamDetails` | Team detail view with related data |

## Design Principles

- **Interface Abstraction** — Business logic works with `IDivision`, `ITeam`, etc. rather than sObjects directly
- **Dependency Injection** — Constructor-based DI for services; `@TestVisible` static setters for controllers
- **Repository Pattern** — Clear separation between service logic and SOQL/DML
- **Wrapper Pattern** — `DivisionWrapper`, `TeamWrapper`, etc. bridge domain interfaces and sObjects
- **Security** — All classes use `with sharing`

## Testing

- **233 Apex tests** with 82% org-wide coverage
- **37 LWC Jest tests** across 5 component suites (75% coverage threshold)
- Mock implementations for unit testing (e.g., `MockDivisionRepository`)
- `@TestSetup` with JSON deserialization for complex test data
- Bulk testing for governor limit validation

### Test Classes

| Test Class | Tests | Layer |
|---|---|---|
| `DivisionManagementControllerTest` | 16 | Controller |
| `PlayerRosterControllerTest` | 18 | Controller |
| `SeasonManagementControllerTest` | 12 | Controller |
| `TeamDetailsControllerTest` | 16 | Controller |
| `DivisionServiceTest` | 13 | Service |
| `LeagueServiceTest` | 8 | Service |
| `PlayerServiceTest` | 11 | Service |
| `SeasonServiceTest` | 10 | Service |
| `TeamServiceTest` | 1 | Service |
| `DivisionRepositoryTest` | 14 | Repository |
| `LeagueRepositoryTest` | 4 | Repository |
| `PlayerRepositoryTest` | 12 | Repository |
| `SeasonRepositoryTest` | 14 | Repository |
| `TeamRepositoryTest` | 15 | Repository |
| `DivisionRestResourceTest` | 4 | REST API |
| `LeagueRestResourceTest` | 3 | REST API |
| `PlayerRestResourceTest` | 10 | REST API |
| `SeasonRestResourceTest` | 4 | REST API |
| `TeamRestResourceTest` | 5 | REST API |
| `RestResponseDtoTest` | 13 | Utilities |

```bash
# Run all tests
sf apex test run --wait 10 --code-coverage --result-format human

# Run specific test classes
sf apex test run --tests DivisionServiceTest,TeamRepositoryTest --wait 10
```

## Permission Sets

| Permission Set | Access Level |
|---|---|
| `Sports_League_Management_Access` | App visibility only |
| `League_Administrator` | Full CRUD on all 5 objects |
| `Team_Manager` | CRUD on Team/Player, Read on League/Division/Season |
| `Data_Viewer` | Read-only on all 5 objects |
| `External_App_Integration` | API access for external applications |

## Dependencies

This is the base package with no external dependencies.

## Installation

```bash
# Create package version
sf package version create -p "Sports Management Core" -x --wait 15

# Install in target org
sf package install -p [VERSION_ID] -o [TARGET_ORG]
```
