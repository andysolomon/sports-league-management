# Sports Management Core Package

## Overview

The Sports Management Core package provides the foundational framework for sports league management. This package contains all sport-agnostic functionality and serves as the base dependency for all sport-specific packages.

## Package Information

- **Package Name**: Sports Management Core
- **Package ID**: 0Hobm0000000TMzCAM
- **Package Type**: Unlocked
- **Version**: 1.0.0.NEXT

## Core Components

### Objects
- `Team__c` - Core team information
- `Player__c` - Player profiles and basic information
- `League__c` - League configuration and settings
- `Game__c` - Game tracking and results
- `Season__c` - Season management

### Classes
- `TeamService` - Team management business logic
- `PlayerService` - Player management operations
- `GameService` - Game tracking and scoring
- `LeagueUtility` - League configuration utilities
- `SportsConstants` - Shared constants and enums

### Lightning Web Components
- `teamList` - Display teams in a league
- `playerProfile` - Player information display
- `gameSchedule` - Game scheduling interface
- `leagueStandings` - League standings display

### Flows
- `Team_Registration` - New team registration process
- `Player_Assignment` - Assign players to teams
- `Game_Scheduling` - Schedule league games

## Design Principles

### Sport-Agnostic Design
- All components should work regardless of sport type
- Use polymorphism for sport-specific behavior
- Avoid hardcoded sport-specific rules or calculations

### Extensibility
- Use interfaces and abstract classes where appropriate
- Provide extension points for sport-specific implementations
- Design for dependency injection

### Data Model
```
League__c (1) -----> (n) Team__c
Team__c (1) -----> (n) Player__c
League__c (1) -----> (n) Game__c
Game__c (n) -----> (2) Team__c (Home/Away)
```

## Usage Guidelines

### For Core Package Development
1. Keep all logic sport-agnostic
2. Use configuration objects for customizable behavior
3. Provide clear extension points for sport packages
4. Document all public APIs

### For Sport Package Integration
1. Extend, don't override core functionality
2. Use core services and utilities
3. Add sport-specific fields to core objects
4. Implement sport-specific interfaces

## Testing Strategy

- Unit tests for all service classes
- LWC tests for all components
- Integration tests for flow processes
- Minimum 90% code coverage required

## Dependencies

This is the base package with no external dependencies.

## Installation

```bash
# Create package version
sf package version create -p "Sports Management Core" -x

# Install in target org
sf package install -p [VERSION_ID] -o [TARGET_ORG]
```
