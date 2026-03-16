# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Workflow
```bash
# Create scratch org with full setup
node scripts/create-scratch-org.js [org-alias] [duration-days]

# Deploy project to scratch org
sf project deploy start

# Deploy specific components
sf project deploy start --source-dir sportsmgmt/main/default/classes
sf project deploy start --source-dir sportsmgmt/main/default/lwc
sf project deploy start --source-dir sportsmgmt/main/default/objects

# Run Apex tests
sf apex test run --wait 10 --code-coverage --result-format human

# Run specific test classes
sf apex test run --tests DivisionManagementControllerTest,DivisionRepositoryTest,DivisionServiceTest --wait 10

# Run LWC tests
npm run test:unit
npm run test:unit:watch
npm run test:unit:debug
```

### E2E Testing (Playwright)
```bash
# Run E2E tests against scratch org (headless)
npm run test:e2e

# Run E2E tests with visible browser
npm run test:e2e:headed

# Run E2E tests with HTML report
npm run test:e2e:report

# Convenience script (checks org, loads seed data, runs tests)
./scripts/run-e2e-tests.sh [org-alias] [--headed] [--report]

# Install Playwright browsers (first time only)
npx playwright install chromium
```

### Code Quality and Linting
```bash
# Run linter
npm run lint

# Run Prettier formatting
npm run prettier
npm run prettier:verify

# Run all LWC tests with coverage
sf force lightning lwc test run
```

### Data Management
```bash
# Load test data
sf data import tree --plan data/league-team-plan.json

# Create sample data using automated script
node scripts/seed-data.js
```

### Package Management
```bash
# Create package versions
./scripts/package-management.sh create-versions --wait 15

# Validate deployment
sf project deploy validate --source-dir sportsmgmt
```

## Architecture

### Project Structure
This is a multi-package Salesforce DX project with modular architecture:

- **`sportsmgmt/`** - Core package with base functionality
- **`sportsmgmt-football/`** - Sport-specific implementation (football)
- **`config/`** - Scratch org definitions
- **`scripts/`** - Automation scripts for setup and data management
- **`data/`** - Test data and import plans

### Package Dependencies
- `sportsmgmt-football` depends on `sportsmgmt` (core package)
- Both packages use API version 58.0
- Packages are managed via sfdx-project.json

### Code Architecture Patterns

**Layered Architecture:**
- **Presentation:** Lightning Web Components in `/lwc/`
- **Controller:** Apex classes in `/lightning/` (e.g., `DivisionManagementController`)
- **Service:** Business logic in `/service/` (e.g., `DivisionService`, `TeamService`)
- **Repository:** Data access in `/service/` (e.g., `DivisionRepository`, `TeamRepository`)
- **Domain:** Interfaces and abstractions in `/util/`

**Key Design Patterns:**
- **Interface Abstraction:** Business logic works with interfaces (`IDivision`, `ITeam`) rather than sObjects
- **Dependency Injection:** Constructor-based DI for services, test-visible setters for controllers
- **Repository Pattern:** Clear separation between service logic and data access
- **Wrapper Pattern:** `DivisionWrapper`, `TeamWrapper` bridge domain interfaces and sObjects

**Testing Strategy:**
- **Mock Implementations:** Full mock classes extending real repositories
- **Test Data:** `@TestSetup` with JSON deserialization for complex data
- **Bulk Testing:** Tests include governor limit validation
- **94% org-wide test coverage** with 60+ tests

### Naming Conventions
- **Classes:** PascalCase with descriptive suffixes (`DivisionService`, `TeamRepository`)
- **Methods:** camelCase with verb-noun patterns (`createDivision`, `getAllDivisionsAsInterface`)
- **Variables:** camelCase with descriptive names
- **Sharing:** All classes use `with sharing` for security

### Key Interfaces
- **`IDivision`** - Contract for division objects with `getId()`, `getName()`, `getLeagueId()`
- **`ITeam`** - Contract for team objects with similar structure
- **`AbstractTeam`** - Base implementation with common functionality
- **Wrapper Classes** - Convert between domain interfaces and sObjects

### Error Handling
- **Custom Exceptions:** Each class defines nested exception classes
- **Structured Logging:** `StructuredLogger` utility with JSON serialization
- **Graceful Degradation:** Controllers return null/empty lists instead of exceptions
- **Test-aware Exception Handling:** Different behavior in test vs. production

### Lightning Web Components
- **TypeScript-enabled** LWC components with proper Jest testing
- **Component structure:** `/lwc/divisionManagement/`, `/lwc/teamDetails/`
- **Jest configuration** with 75% coverage threshold
- **Test mocks** for Salesforce platform services

## Development Guidelines

### Before Making Changes
1. **Always run tests first:** `sf apex test run --wait 10` and `npm run test:unit`
2. **Check current coverage:** Ensure org-wide coverage stays above 90%
3. **Use dependency injection:** Follow established DI patterns for testability

### Code Quality Requirements
- **All new Apex methods must be virtual** for testability
- **All service classes must support constructor-based DI**
- **All controllers must use `@TestVisible` static setters for testing**
- **Follow existing naming conventions and architecture patterns**

### Testing Requirements
- **Write comprehensive tests** for all new functionality
- **Include bulk testing** for governor limit compliance
- **Use mock implementations** for unit testing
- **Test both positive and negative scenarios**
- **Maintain or improve test coverage percentage**

### Data Model
**Core Objects:**
- **`League__c`** - Parent object for leagues with RecordType support
- **`Team__c`** - Child object with lookup to League__c
- **Key Fields:** `City__c`, `Stadium__c`, `Founded_Year__c`, `Location__c`

### Lightning Experience Integration
- **Apps:** Sports League Management app with proper permission sets
- **Permission Sets:**
  - `Sports_League_Management_Access` — App visibility only
  - `League_Administrator` — Full CRUD on all 5 objects
  - `Team_Manager` — CRUD on Team/Player, Read on League/Division/Season
  - `Data_Viewer` — Read-only on all 5 objects
- **Navigation:** Custom tabs and flexipages configured

### Automation Scripts
- **`create-scratch-org.js`** - Complete scratch org setup with users and permissions
- **`setup-users.js`** - User and permission configuration (assigns role-based permission sets)
- **`seed-data.js`** - Test data creation
- **`package-management.sh`** - Package version management
- **`run-e2e-tests.sh`** - Run Playwright E2E tests against a scratch org

## Common Tasks

### Adding New Features
1. Follow the established layered architecture
2. Create interface first, then implementation
3. Add repository for data access
4. Add service for business logic
5. Add controller for LWC integration
6. Create comprehensive tests with mocks
7. Update test data if needed

### Debugging Test Failures
1. Check if related to dependency injection setup
2. Verify mock implementations are complete
3. Ensure test data is properly configured
4. Check governor limits in bulk operations
5. Validate exception handling in negative scenarios

### Working with Custom Objects
- All business logic should work with wrapper classes (`DivisionWrapper`, `TeamWrapper`)
- Repository classes handle sObject manipulation and SOQL
- Use interfaces for loose coupling between layers
- Follow established patterns for field access and validation