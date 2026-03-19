# Sports Management Football Package

## Overview

The Sports Management Football package is the sport-specific extension for the core Sports Management platform. It contains football-specific implementations, custom fields, and specialized components that extend the core objects and services.

## Package Information

- **Package Name:** Sports Management Football
- **Package ID:** 0Hobm0000000TObCAM
- **Package Type:** Unlocked
- **Version:** 1.0.0.NEXT
- **API Version:** 58.0
- **Dependencies:** Sports Management Core (1.0.0.LATEST)

## Current Status

This package is **scaffolded but not yet implemented**. The directory structure is in place with placeholder `.gitkeep` files, ready for football-specific development.

### Directory Structure

```
sportsmgmt-football/
├── package.xml
├── README.md
└── main/default/classes/
    ├── invocable/     Flow-invocable football actions
    ├── lightning/     Football-specific LWC controllers
    ├── service/       Football services and repositories
    ├── tests/         Test classes
    └── util/          Football domain interfaces and wrappers
```

## Integration with Core Package

This package depends on the `sportsmgmt` core package and follows the same layered architecture:

- **Service classes** extend core services with football-specific logic
- **Repository classes** handle football-specific data access
- **Controller classes** expose football features to LWC components
- All classes use `with sharing` and follow the core package's DI patterns

## Development Guidelines

1. Follow the layered architecture established in the core package
2. Extend core interfaces (`IDivision`, `ITeam`, `IPlayer`, etc.) for football-specific behavior
3. Use constructor-based dependency injection for testability
4. Maintain 90%+ test coverage with mock implementations
5. Add football-specific fields to core objects via this package's metadata

## Installation

```bash
# Ensure core package is installed first
sf package install -p [CORE_VERSION_ID] -o [TARGET_ORG]

# Create football package version
sf package version create -p "Sports Management Football" -x --wait 15

# Install football package
sf package install -p [FOOTBALL_VERSION_ID] -o [TARGET_ORG]
```
