# Sports Management Football Package

## Overview

The Sports Management Football package is the sport-specific extension point for the core Sports Management platform. It will contain football-specific implementations, custom fields, and specialized components that extend the core objects and services.

## Package Information

- **Package Name**: Sports Management Football
- **Package ID**: 0Hobm0000000TObCAM
- **Package Type**: Unlocked
- **Version**: 1.0.0.NEXT
- **Dependencies**: Sports Management Core (1.0.0.LATEST)

## Current Status

This package is **scaffolded but not yet implemented**. The directory structure is in place with placeholder `.gitkeep` files, ready for football-specific development.

### Directory Structure

```
sportsmgmt-football/
├── package.xml
├── README.md
└── main/default/classes/
    ├── invocable/
    ├── lightning/
    ├── service/
    ├── tests/
    └── util/
```

## Integration with Core Package

This package depends on the `sportsmgmt` core package and follows the same layered architecture:

- **Service classes** extend core services with football-specific logic
- **Repository classes** handle football-specific data access
- **Controller classes** expose football features to LWC components
- All classes should use `with sharing` and follow the core package's DI patterns

## Development Guidelines

1. Follow the layered architecture established in the core package
2. Extend core interfaces (`IDivision`, `ITeam`, etc.) for football-specific behavior
3. Use constructor-based dependency injection for testability
4. Maintain 90%+ test coverage with mock implementations
5. Add football-specific fields to core objects via this package's metadata

## Installation

```bash
# Ensure core package is installed first
sf package install -p [CORE_VERSION_ID] -o [TARGET_ORG]

# Create football package version
sf package version create -p "Sports Management Football" -x

# Install football package
sf package install -p [FOOTBALL_VERSION_ID] -o [TARGET_ORG]
```
