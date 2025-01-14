
# Sports League Management System

A modular, extensible Salesforce solution for sports league management built with TypeScript-enabled LWC components.

## Dev Hub Setup

1. Enable Dev Hub in your org:
   ```bash
   sf org open --target-org your-dev-hub
   ```
   Then navigate to Setup → Development → Dev Hub and enable "Dev Hub" and "Unlocked Packages and Second-Generation Managed Packages"

2. Authenticate CLI:
   ```bash
   sf org login web --set-default-dev-hub
   ```

## Scratch Org Creation

1. Create scratch org:
   ```bash
   sf org create scratch --definition-file config/project-scratch-def.json --alias sports-dev --duration-days 1
   ```

2. Set as default:
   ```bash
   sf config set target-org=sports-dev
   ```

3. Deploy project:
   ```bash
   sf project deploy start
   ```

## Project Structure

```
sportsmgmt/                     # Core package
├── main/default/
│   ├── applications/          # App configurations
│   ├── classes/              
│   │   ├── interfaces/        # Core interfaces
│   │   ├── abstracts/         # Abstract base classes
│   │   ├── di/               # Dependency injection
│   │   ├── services/         # Service layer
│   │   ├── repositories/     # Data access
│   │   └── factories/        # Object factories
│   ├── lwc/                  # Lightning Web Components
│   ├── objects/              # Custom objects
│   └── permissionsets/       # Permission sets
│
sportsmgmt-football/           # Football-specific implementation
└── main/default/             # Sport-specific components
```

## Development Workflow

1. Create feature branch:
   ```bash
   git checkout -b feat/W-XXXXX-description
   ```

2. Deploy changes:
   ```bash
   sf project deploy start
   ```

3. Run tests:
   ```bash
   sf apex test run --wait 10
   ```

## Features

- Multi-sport support through modular architecture
- TypeScript-enabled LWC components
- SOLID principles implementation
- Comprehensive testing framework

## Package Dependencies

The solution consists of two packages:
- `sportsmgmt` - Core framework
- `sportsmgmt-football` - Football-specific implementation