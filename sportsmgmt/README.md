# Sports Management Core Package

## Overview

The Sports Management Core package provides the foundational framework for sports league management. This package contains all sport-agnostic functionality and serves as the base dependency for all sport-specific packages.

## Package Information

- **Package Name**: Sports Management Core
- **Package ID**: 0Hobm0000000TMzCAM
- **Package Type**: Unlocked
- **Version**: 1.0.0.NEXT

## Core Components

### Custom Objects

- **`League__c`** — Parent object for leagues with RecordType support
- **`Division__c`** — Divisions within a league
- **`Team__c`** — Teams with lookup to League__c; includes City, Stadium, Founded Year, Location fields
- **`Player__c`** — Player profiles linked to teams
- **`Season__c`** — Season management with date ranges and status

### Apex Classes

**Controllers** (`classes/lightning/`):
- `DivisionManagementController` — LWC controller for division CRUD
- `PlayerRosterController` — LWC controller for player roster management
- `SeasonManagementController` — LWC controller for season operations
- `TeamDetailsController` — LWC controller for team detail views

**Services** (`classes/service/`):
- `DivisionService`, `LeagueService`, `PlayerService`, `SeasonService`, `TeamService` — Business logic layer
- `DivisionRepository`, `LeagueRepository`, `PlayerRepository`, `SeasonRepository`, `TeamRepository` — Data access layer

**REST Resources** (`classes/rest/`):
- `LeagueRestResource` — `/sportsmgmt/v1/leagues`
- `DivisionRestResource` — `/sportsmgmt/v1/divisions`
- `TeamRestResource` — `/sportsmgmt/v1/teams`
- `PlayerRestResource` — `/sportsmgmt/v1/players`
- `SeasonRestResource` — `/sportsmgmt/v1/seasons`
- `RestResponseDto`, `RestUtils` — Shared response envelope and utilities

**Domain** (`classes/util/`):
- `IDivision`, `ITeam` — Domain interfaces
- `AbstractTeam` — Base implementation with common functionality
- `DivisionWrapper`, `TeamWrapper` — Bridge domain interfaces and sObjects
- `StructuredLogger` — JSON-based structured logging utility

### Lightning Web Components

- `divisionManagement` — Division list and CRUD operations
- `playerRoster` — Player roster management within a team
- `seasonManagement` — Season list and management
- `teamDetails` — Team detail view with related data

### Data Model

```
League__c (1) ────> (n) Division__c
League__c (1) ────> (n) Team__c
Team__c   (1) ────> (n) Player__c
League__c (1) ────> (n) Season__c
```

## Design Principles

- **Interface Abstraction** — Business logic works with `IDivision`, `ITeam` rather than sObjects
- **Dependency Injection** — Constructor-based DI for services, `@TestVisible` setters for controllers
- **Repository Pattern** — Clear separation between service logic and data access
- **Wrapper Pattern** — `DivisionWrapper`, `TeamWrapper` bridge domain interfaces and sObjects
- **Security** — All classes use `with sharing`

## Testing

- 94% org-wide coverage with 60+ tests
- Mock implementations for unit testing (e.g., `MockDivisionRepository`)
- `@TestSetup` with JSON deserialization for complex test data
- Bulk testing for governor limit validation

## Dependencies

This is the base package with no external dependencies.

## Installation

```bash
# Create package version
sf package version create -p "Sports Management Core" -x

# Install in target org
sf package install -p [VERSION_ID] -o [TARGET_ORG]
```
