# Sports Management Football Package

## Overview

The Sports Management Football package provides football-specific implementations and features that extend the core Sports Management platform. This package contains all football-specific business logic, custom fields, and specialized components.

## Package Information

- **Package Name**: Sports Management Football
- **Package ID**: 0Hobm0000000TObCAM
- **Package Type**: Unlocked
- **Version**: 1.0.0.NEXT
- **Dependencies**: Sports Management Core (1.0.0.LATEST)

## Football-Specific Features

### Extended Objects
Extensions to core objects with football-specific fields:

#### Team__c Extensions
- `Formation_Primary__c` - Primary formation (e.g., 4-4-2, 3-5-2)
- `Formation_Secondary__c` - Alternative formation
- `Offensive_Style__c` - Offensive play style
- `Defensive_Style__c` - Defensive strategy

#### Player__c Extensions
- `Position_Primary__c` - Primary position (QB, RB, WR, etc.)
- `Position_Secondary__c` - Secondary position
- `Jersey_Number__c` - Player jersey number
- `Height__c` - Player height
- `Weight__c` - Player weight
- `Years_Experience__c` - Professional experience

#### Game__c Extensions
- `Quarter_1_Home_Score__c` - Q1 home team score
- `Quarter_1_Away_Score__c` - Q1 away team score
- `Quarter_2_Home_Score__c` - Q2 home team score
- `Quarter_2_Away_Score__c` - Q2 away team score
- `Quarter_3_Home_Score__c` - Q3 home team score
- `Quarter_3_Away_Score__c` - Q3 away team score
- `Quarter_4_Home_Score__c` - Q4 home team score
- `Quarter_4_Away_Score__c` - Q4 away team score
- `Overtime_Home_Score__c` - Overtime home score
- `Overtime_Away_Score__c` - Overtime away score

### Custom Objects
Football-specific objects:

#### Football_Play__c
- `Game__c` - Related game (lookup)
- `Quarter__c` - Quarter number (1-4, OT)
- `Time_Remaining__c` - Time on clock
- `Down__c` - Down number (1-4)
- `Distance__c` - Yards to go
- `Yard_Line__c` - Field position
- `Play_Type__c` - Run, Pass, Kick, etc.
- `Result__c` - Yards gained/lost
- `Scoring_Play__c` - Checkbox for scoring plays

#### Football_Penalty__c
- `Game__c` - Related game
- `Team__c` - Penalized team
- `Penalty_Type__c` - Type of penalty
- `Yards__c` - Penalty yards
- `Quarter__c` - When penalty occurred
- `Accepted__c` - Whether penalty was accepted

### Classes
Football-specific business logic:

#### FootballGameService
- `calculateQuarterScore()` - Calculate quarter-by-quarter scoring
- `updateGameStatistics()` - Update game stats from plays
- `validateFootballRules()` - Enforce football-specific rules

#### FootballRuleEngine
- `validateFormation()` - Validate team formations
- `calculatePlayerRatings()` - Position-based player ratings
- `enforceScoringRules()` - Football scoring validation

#### FootballStatsCalculator
- `calculateTeamStats()` - Team performance metrics
- `calculatePlayerStats()` - Individual player statistics
- `calculateSeasonStats()` - Season-long statistics

### Lightning Web Components

#### footballGameTracker
- Real-time game tracking with football-specific features
- Quarter-by-quarter score entry
- Play-by-play tracking
- Penalty management

#### footballPlayerCard
- Football player profile display
- Position information
- Physical stats display
- Performance metrics

#### footballTeamFormation
- Visual formation display
- Formation editor
- Player position assignment

### Flows
Football-specific automation:

#### Football_Game_Setup
- Configure game with football-specific settings
- Set initial formations
- Assign officials

#### Football_Play_Tracking
- Record individual plays
- Update game statistics
- Handle scoring plays

## Football Rules Implementation

### Scoring System
- Touchdown: 6 points
- Extra Point: 1 point
- Two-Point Conversion: 2 points
- Field Goal: 3 points
- Safety: 2 points

### Game Structure
- 4 quarters of regulation play
- Overtime rules implementation
- Clock management
- Down and distance tracking

## Integration with Core Package

### Service Extension Pattern
Football services extend core services:

```apex
public with sharing class FootballGameService extends GameService {
    // Football-specific game logic
    public override void updateGameScore(Id gameId, Integer homeScore, Integer awayScore) {
        // Call parent method
        super.updateGameScore(gameId, homeScore, awayScore);
        
        // Add football-specific logic
        updateQuarterScores(gameId);
        calculateFootballStats(gameId);
    }
}
```

### Component Composition
Football components use core components as building blocks:

```javascript
// footballGameTracker.js
import { LightningElement } from 'lwc';
import gameSchedule from 'c/gameSchedule';

export default class FootballGameTracker extends LightningElement {
    // Extends core game tracking with football features
}
```

## Testing Strategy

### Unit Tests
- Football rules engine tests
- Statistics calculation tests
- Service class tests

### Integration Tests
- Game flow with football rules
- Cross-package functionality
- Data consistency tests

### Football-Specific Scenarios
- Overtime game handling
- Penalty enforcement
- Formation validation

## Installation

```bash
# Ensure core package is installed first
sf package install -p [CORE_VERSION_ID] -o [TARGET_ORG]

# Create football package version
sf package version create -p "Sports Management Football" -x

# Install football package
sf package install -p [FOOTBALL_VERSION_ID] -o [TARGET_ORG]
```

## Development Guidelines

1. **Always extend, never override** core functionality
2. **Use football-specific field naming** (prefix with `Football_`)
3. **Implement football interfaces** defined in core package
4. **Test compatibility** with core package updates
5. **Document football rules** implemented in code
