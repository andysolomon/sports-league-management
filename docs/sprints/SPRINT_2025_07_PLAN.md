# Sprint 2025.07 — Season and Player Management

## Rationale

The app currently manages Leagues, Divisions, and Teams. The next logical layer is **Seasons** (time context) and **Players** (participants), which are independent of each other and follow the same proven patterns. Game/Match management would follow in a later sprint since it depends on both.

### Data Model Progression

```
Current (Completed)              Next Sprint (New)           Future
─────────────────────           ──────────────────           ──────
League__c                       Season__c (new)              Game__c
├── Division__c                   └── League__c (lookup)       ├── Season__c (lookup)
│     └── Team__c               Player__c (new)                └── Team__c (lookup)
└── Team__c                       └── Team__c (lookup)
```

## Sprint Details

- **Sprint Name:** 2025.07 - Sports League Development Team
- **Team:** Sports League Development Team
- **Start Date:** 2026-03-17
- **End Date:** 2026-03-28
- **Total Story Points:** 29

## Epic

**Season and Player Management** — Extend the core data model with Season and Player objects, following the established layered architecture (Interface → Wrapper → Repository → Service → Controller → LWC).

## Stories

### W-000017: [Season Management] Create Season Object and Service with CRUD Operations (8 pts)

**As a** league administrator,
**I want to** create and manage seasons,
**So that** I can organize league activity by time period.

**Acceptance Criteria:**
- Season__c custom object with fields (see below)
- ISeason interface defined with required properties
- SeasonWrapper bridging ISeason and sObject
- SeasonRepository with data access (CRUD + queries by league)
- SeasonService with business logic and constructor-based DI
- Unit tests with 90%+ coverage
- Error handling with StructuredLogger

**Season__c Fields:**
| Field | Type | Description |
|---|---|---|
| Name | Text | e.g. "2025-2026 Season" |
| Start_Date__c | Date | Season start date |
| End_Date__c | Date | Season end date |
| League__c | Lookup(League__c) | Parent league |
| Status__c | Picklist | Upcoming, Active, Completed |

---

### W-000018: [Player Management] Create Player Object and Service with CRUD Operations (8 pts)

**As a** team manager,
**I want to** create and manage player records,
**So that** I can track the roster for each team.

**Acceptance Criteria:**
- Player__c custom object with fields (see below)
- IPlayer interface defined with required properties
- PlayerWrapper bridging IPlayer and sObject
- PlayerRepository with data access (CRUD + queries by team)
- PlayerService with business logic and constructor-based DI
- Unit tests with 90%+ coverage
- Error handling with StructuredLogger

**Player__c Fields:**
| Field | Type | Description |
|---|---|---|
| Name | Text | Player full name |
| Position__c | Text | Playing position |
| Jersey_Number__c | Number | Jersey number |
| Team__c | Lookup(Team__c) | Parent team |
| Status__c | Picklist | Active, Injured, Inactive |
| Date_of_Birth__c | Date | Player date of birth |

---

### W-000019: [Season Management] Create Season Management LWC Component (5 pts)

**As a** league administrator,
**I want to** view and manage seasons from a Lightning component,
**So that** I can create, edit, and track seasons within the app.

**Acceptance Criteria:**
- SeasonManagementController with @AuraEnabled methods
- seasonManagement LWC with create/edit/list views
- Controller tests with mock DI pattern
- Jest tests for the LWC component
- Component added to Sports League Management app

<details>
<summary>Implementation Plan</summary>

#### Context

W-000017 (Season service layer) and W-000018 (Player service layer) are complete and merged. This story adds the **presentation layer** for seasons: an Apex controller exposing SeasonService to LWC, the `seasonManagement` LWC component with create/edit/list/delete views, controller tests with mock DI, Jest tests, and wiring the component into the Sports League Management app.

The established pattern is clear from `DivisionManagementController` + `divisionManagement` LWC and `TeamDetailsController` + `teamDetails` LWC.

#### Files Created (11 files)

**Apex Controller (2 files)**
- `classes/lightning/SeasonManagementController.cls` — Pattern: `DivisionManagementController.cls`
  - `private static SeasonService seasonService` + `@TestVisible setServiceForTesting()`
  - Read methods (`cacheable=true`): `getAllSeasons()`, `getSeasonById()`, `getSeasonsByLeague()`
  - Write methods: `createSeason(name, leagueId, startDate, endDate, status)`, `updateSeason()`, `deleteSeason()`
  - Private converters: `convertToSeasonRecords()`, `convertToSeasonRecord()` (instanceof SeasonWrapper → original record)
  - Nested `SeasonManagementException`
  - Error pattern: StructuredLogger + re-throw in test mode; reads return null/empty, writes throw AuraHandledException
- `classes/lightning/SeasonManagementController.cls-meta.xml` — apiVersion 62.0

**Controller Test (2 files)**
- `classes/tests/SeasonManagementControllerTest.cls` — Pattern: `DivisionManagementControllerTest.cls`
  - `@TestSetup`: League__c + 2 Season__c records (Completed + Active)
  - 12 tests: getAllSeasons_Success, getSeasonById_ValidId/BlankId, getSeasonsByLeague_ValidLeagueId/BlankLeagueId, createSeason_ValidData/BlankName/BlankLeague, updateSeason_ValidData/BlankId, deleteSeason_ValidId/BlankId
  - Integration-style tests using real DML (matches DivisionManagementControllerTest pattern)
- `classes/tests/SeasonManagementControllerTest.cls-meta.xml` — apiVersion 62.0

**LWC Component (4 files)**
- `lwc/seasonManagement/seasonManagement.js` — Pattern: `divisionManagement.js`
  - `@wire(getAllSeasons)` → seasons array
  - State: seasons, filteredSeasons, selectedLeagueId, seasonName, startDate, endDate, statusValue, modal flags, editingSeason, deletingSeason
  - Computed: `leagueOptions`, `statusOptions` (Upcoming/Active/Completed), `hasFilteredSeasons`
  - Filter: `filterSeasonsByLeague()` on league combobox change
  - CRUD: `handleSaveCreate`, `handleSaveEdit`, `handleConfirmDelete` with try/catch, toast, refreshApex
- `lwc/seasonManagement/seasonManagement.html` — Season cards with Name, League, Start/End Date, Status badge, Edit/Delete menu; Create/Edit/Delete modals
- `lwc/seasonManagement/seasonManagement.css` — Modal max-width, box hover effect
- `lwc/seasonManagement/seasonManagement.js-meta.xml` — isExposed, targets: AppPage/HomePage/Tab

**Jest Test (1 file)**
- `lwc/seasonManagement/__tests__/seasonManagement.test.js` — 6 tests: renders, wire data, wire errors, empty data, create, delete

**App Integration (3 files)**
- `tabs/Season_Management.tab-meta.xml` — Points to Season_Management_Page flexipage
- `flexipages/Season_Management_Page.flexipage-meta.xml` — Contains seasonManagement LWC
- `applications/Sports_League_Management.app-meta.xml` — Added Season_Management tab

#### Key Design Decisions

- Controller follows DivisionManagementController pattern exactly: static service + @TestVisible setter, StructuredLogger, test-mode re-throw
- Season-specific fields in create/update: name, leagueId, startDate, endDate, status (5 params vs Division's 2)
- No mock service in controller test: follows DivisionManagementControllerTest real-DML pattern
- Status picklist hardcoded in LWC: Upcoming, Active, Completed
- Season cards show date range and status badge (more info per card than Division)
- `convertToSeasonRecord` uses `SeasonWrapper.getOriginalRecord()` for League__r relationship access

#### Verification

1. `sf project deploy start --source-dir sportsmgmt` — deploys without errors
2. `sf apex test run --tests SeasonManagementControllerTest --wait 10 --code-coverage --result-format human` — all tests pass
3. `npm run test:unit` — Jest tests pass
4. Season Management tab visible in Sports League Management app

</details>

---

### W-000020: [Player Management] Create Player Roster LWC Component (5 pts)

**As a** team manager,
**I want to** view and manage the team roster from a Lightning component,
**So that** I can add, edit, and track players on my team.

**Acceptance Criteria:**
- PlayerRosterController with @AuraEnabled methods
- playerRoster LWC with roster list, add/edit player views
- Controller tests with mock DI pattern
- Jest tests for the LWC component
- Component added to Sports League Management app

<details>
<summary>Implementation Plan</summary>

#### Context

W-000018 (Player service layer) is complete and merged. W-000019 (Season Management LWC) is also done. This story adds the **presentation layer** for players: an Apex controller exposing PlayerService to LWC, the `playerRoster` LWC component with roster list, add/edit/delete views, controller tests with mock DI, Jest tests, and wiring the component into the Sports League Management app.

The AC explicitly calls for **mock DI pattern** in controller tests, following `TeamDetailsControllerTest` (not the real-DML pattern from DivisionManagementControllerTest).

#### Files Created (11 files)

**Apex Controller (2 files)**
- `classes/lightning/PlayerRosterController.cls` — Pattern: `SeasonManagementController.cls` + `DivisionManagementController.cls`
  - `private static PlayerService playerService` + `@TestVisible setServiceForTesting()`
  - Read methods (`cacheable=true`): `getAllPlayers()`, `getPlayerById()`, `getPlayersByTeam()`
  - Write methods: `createPlayer(name, teamId, position, jerseyNumber, dateOfBirth, status)`, `updatePlayer()`, `deletePlayer()`
  - Private converters: `convertToPlayerRecords()`, `convertToPlayerRecord()` (instanceof PlayerWrapper → original record)
  - Nested `PlayerRosterException`
  - Error pattern: StructuredLogger + re-throw in test mode; reads return null/empty, writes throw AuraHandledException
- `classes/lightning/PlayerRosterController.cls-meta.xml` — apiVersion 62.0

**Controller Test — Mock DI Pattern (2 files)**
- `classes/tests/PlayerRosterControllerTest.cls` — Pattern: `TeamDetailsControllerTest.cls`
  - Inner `MockPlayerService extends PlayerService` with `shouldThrowException` flag
  - Mock data: 2 PlayerWrapper instances with full field population
  - Overrides: `getAllPlayersAsInterface()`, `getPlayerByIdAsInterface()`, `getPlayersByTeamAsInterface()`, `createPlayer()`, `updatePlayer()`, `deletePlayer()`
  - Tracks: `lastCreatedPlayer`, `lastUpdatedRecord`, `lastDeletedId`
  - 18 tests covering all CRUD operations, blank input validation, and service exceptions
- `classes/tests/PlayerRosterControllerTest.cls-meta.xml` — apiVersion 62.0

**LWC Component (4 files)**
- `lwc/playerRoster/playerRoster.js` — Pattern: `seasonManagement.js`
  - `@wire(getAllPlayers)` for all players, `@wire(getAllTeams)` from TeamDetailsController for team filter
  - State: players, filteredPlayers, teams, selectedTeamId, form fields, modal flags
  - Computed: `teamOptions`, `teamSelectOptions`, `statusOptions` (Active/Injured/Inactive), `hasFilteredPlayers`
  - Filter: `filterPlayersByTeam()` — client-side filter on Team__c
  - CRUD: `handleSaveCreate`, `handleSaveEdit`, `handleConfirmDelete` with try/catch, toast, refreshApex
- `lwc/playerRoster/playerRoster.html` — Player cards with Name, Team, Position, Jersey #, Status badge, Edit/Delete menu; Create/Edit/Delete modals
- `lwc/playerRoster/playerRoster.css` — Modal max-width 480px, box hover shadow
- `lwc/playerRoster/playerRoster.js-meta.xml` — isExposed, targets: AppPage/HomePage/Tab

**Jest Test (1 file)**
- `lwc/playerRoster/__tests__/playerRoster.test.js` — 6 tests: renders, wire data, wire errors, empty data, create, delete

**App Integration (3 files)**
- `flexipages/Player_Roster_Page.flexipage-meta.xml` — Contains playerRoster LWC
- `tabs/Player_Roster.tab-meta.xml` — Points to Player_Roster_Page flexipage
- `applications/Sports_League_Management.app-meta.xml` — Added Player_Roster tab after Season_Management

#### Key Design Decisions

- **Mock DI for controller tests** (per AC): Inner `MockPlayerService extends PlayerService` — follows `TeamDetailsControllerTest` pattern, not real-DML
- Player has 6 params in create/update: name, teamId, position, jerseyNumber, dateOfBirth, status
- Client-side team filtering: Wire `getAllPlayers` once, filter by Team__c in JS
- Reuse `TeamDetailsController.getAllTeams` for team combobox options
- Status picklist: Active, Injured, Inactive — matches Player__c.Status__c values
- `convertToPlayerRecord` uses `PlayerWrapper.getOriginalRecord()` for Team__r relationship access

#### Verification

1. `sf project deploy start --source-dir sportsmgmt` — deploys without errors
2. `sf apex test run --tests PlayerRosterControllerTest --wait 10 --code-coverage --result-format human` — all 18 tests pass
3. `npx jest --config jest.config.js sportsmgmt/main/default/lwc/playerRoster` — 6 Jest tests pass
4. Player Roster tab visible in Sports League Management app

</details>

---

### W-000021: [Core] Enhance Seed Data for Seasons and Players (3 pts)

**As a** developer,
**I want to** have realistic sample data for seasons and players,
**So that** I can develop and demo effectively.

**Acceptance Criteria:**
- Updated data plan JSON files for seasons and players
- seed-data.js updated to import new objects
- At least 2 sample seasons and 10+ sample players
- Data references existing leagues and teams

<details>
<summary>Implementation Plan</summary>

#### Context

W-000017 (Season object/service) and W-000018 (Player object/service) are complete. The seed data system currently imports only Leagues (2) and Teams (4) via `data/league-team-plan.json` + `scripts/seed-data.js`. This story adds realistic sample data: 3 seasons and 12 players so the app can be demoed with populated LWC components.

#### Files Created (2 files)

**Data Files**
- `data/seasons.json` — 3 Season__c records using `@leagueRef1`/`@leagueRef2` references from `leagues.json`
  - 2025-2026 NFL Season (Active), 2024-2025 NFL Season (Completed), 2025 MLS Season (Upcoming)
- `data/players.json` — 12 Player__c records (3 per team) using `@teamRef1`–`@teamRef4` references from `teams.json`
  - Dallas Cowboys: Dak Prescott (QB #4 Active), CeeDee Lamb (WR #88 Active), Micah Parsons (LB #11 Injured)
  - New England Patriots: Drake Maye (QB #10 Active), Hunter Henry (TE #85 Active), Christian Barmore (DT #90 Inactive)
  - LA Galaxy: Riqui Puig (MF #10 Active), Dejan Joveljic (FW #9 Active), Maya Yoshida (DF #4 Injured)
  - Seattle Sounders: Joao Paulo (MF #6 Active), Jordan Morris (FW #13 Active), Stefan Frei (GK #24 Inactive)

#### Files Modified (2 files)

- `data/league-team-plan.json` — Added Season__c and Player__c entries after Team__c
- `scripts/seed-data.js` — Updated log message from "League & Team" to "League, Team, Season & Player"

#### Key Design Decisions

- Import order matters: Seasons reference Leagues, Players reference Teams — both parents already imported before their children
- All 3 Status values covered for both objects (Season: Active/Completed/Upcoming; Player: Active/Injured/Inactive)
- Positions match sport context: NFL teams use QB/WR/LB/TE/DT; MLS teams use MF/FW/DF/GK
- 3 players per team provides enough data to demo filtering and roster views

#### Verification

1. `node scripts/seed-data.js <alias>` — imports all 4 object types without errors
2. `sf data query --query "SELECT COUNT() FROM Season__c" --target-org <alias>` → 3
3. `sf data query --query "SELECT COUNT() FROM Player__c" --target-org <alias>` → 12
4. Player Roster and Season Management LWC components display the seeded data

</details>

## Architecture Pattern

Each service story follows the established layered pattern:

```
ISeason / IPlayer                    (Interface — contracts)
    │
SeasonWrapper / PlayerWrapper        (Wrapper — sObject bridge)
    │
SeasonRepository / PlayerRepository  (Repository — data access)
    │
SeasonService / PlayerService        (Service — business logic with DI)
    │
Controller                           (Controller — @AuraEnabled for LWC)
    │
LWC Component                       (Presentation — Lightning Web Component)
```

## File Locations

Following the existing subfolder structure:

```
sportsmgmt/main/default/
├── classes/
│   ├── lightning/
│   │   ├── SeasonManagementController.cls
│   │   └── PlayerRosterController.cls
│   ├── service/
│   │   ├── SeasonService.cls
│   │   ├── SeasonRepository.cls
│   │   ├── PlayerService.cls
│   │   └── PlayerRepository.cls
│   ├── util/
│   │   ├── ISeason.cls
│   │   ├── SeasonWrapper.cls
│   │   ├── IPlayer.cls
│   │   ├── PlayerWrapper.cls
│   │   └── AbstractPlayer.cls
│   └── tests/
│       ├── SeasonManagementControllerTest.cls
│       ├── SeasonServiceTest.cls
│       ├── SeasonRepositoryTest.cls
│       ├── PlayerRosterControllerTest.cls
│       ├── PlayerServiceTest.cls
│       └── PlayerRepositoryTest.cls
├── lwc/
│   ├── seasonManagement/
│   └── playerRoster/
└── objects/
    ├── Season__c/
    └── Player__c/
```

## Dependencies

- W-000019 depends on W-000017 (LWC needs the service layer)
- W-000020 depends on W-000018 (LWC needs the service layer)
- W-000021 depends on W-000017 and W-000018 (seed data needs the objects)
- W-000017 and W-000018 are independent and can be worked in parallel

## Definition of Done

- All tests passing (Apex and Jest)
- 90%+ code coverage maintained
- Code deployed to scratch org
- PR merged to main
- Work item status updated to Closed in Agile Accelerator
