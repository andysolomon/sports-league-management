#!/bin/bash

# Sports Management Package Management Script
# Automates common package development tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Package information
CORE_PACKAGE="Sports Management Core"
FOOTBALL_PACKAGE="Sports Management Football"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    echo "Sports Management Package Management"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  create-versions       Create new package versions for all packages"
    echo "  create-core-version   Create new version for core package only"
    echo "  create-football-version Create new version for football package only"
    echo "  install-packages      Install latest package versions to target org"
    echo "  list-packages         List all packages and versions"
    echo "  promote-versions      Promote package versions to released"
    echo "  validate-dependencies Validate package dependencies"
    echo "  help                  Show this help message"
    echo ""
    echo "Options:"
    echo "  --target-org ORG     Target org alias (default: uses current default)"
    echo "  --wait MINUTES       Wait time for package version creation (default: 10)"
    echo "  --skip-validation    Skip validation during package version creation"
    echo ""
    echo "Examples:"
    echo "  $0 create-versions --wait 15"
    echo "  $0 install-packages --target-org myOrg"
    echo "  $0 promote-versions"
}

# Function to create package version
create_package_version() {
    local package_name="$1"
    local wait_time="${2:-10}"
    local skip_validation="${3:-false}"
    
    print_status "Creating package version for: $package_name"
    
    local cmd="sf package version create --package \"$package_name\" --installation-key-bypass --wait $wait_time"
    
    if [[ "$skip_validation" == "true" ]]; then
        cmd="$cmd --skip-validation"
    fi
    
    if eval "$cmd"; then
        print_success "Package version created for: $package_name"
        
        # Get the latest version ID
        local version_id=$(sf package version list --package "$package_name" --released --json | jq -r '.result[0].SubscriberPackageVersionId // empty')
        if [[ -n "$version_id" ]]; then
            print_status "Latest version ID: $version_id"
        fi
    else
        print_error "Failed to create package version for: $package_name"
        return 1
    fi
}

# Function to install packages in order
install_packages() {
    local target_org="$1"
    local org_flag=""
    
    if [[ -n "$target_org" ]]; then
        org_flag="--target-org $target_org"
    fi
    
    print_status "Installing packages to org: ${target_org:-default}"
    
    # Install core package first
    print_status "Installing core package..."
    local core_version=$(sf package version list --package "$CORE_PACKAGE" --released --json | jq -r '.result[0].SubscriberPackageVersionId // empty')
    
    if [[ -n "$core_version" ]]; then
        if eval "sf package install --package $core_version $org_flag --wait 10 --publish-wait 10"; then
            print_success "Core package installed successfully"
        else
            print_error "Failed to install core package"
            return 1
        fi
    else
        print_warning "No released version found for core package"
    fi
    
    # Install football package
    print_status "Installing football package..."
    local football_version=$(sf package version list --package "$FOOTBALL_PACKAGE" --released --json | jq -r '.result[0].SubscriberPackageVersionId // empty')
    
    if [[ -n "$football_version" ]]; then
        if eval "sf package install --package $football_version $org_flag --wait 10 --publish-wait 10"; then
            print_success "Football package installed successfully"
        else
            print_error "Failed to install football package"
            return 1
        fi
    else
        print_warning "No released version found for football package"
    fi
    
    print_success "All packages installed successfully!"
}

# Function to list packages and versions
list_packages() {
    print_status "Listing all packages and versions..."
    
    echo ""
    echo "=== Package Information ==="
    sf package list
    
    echo ""
    echo "=== Core Package Versions ==="
    sf package version list --package "$CORE_PACKAGE"
    
    echo ""
    echo "=== Football Package Versions ==="
    sf package version list --package "$FOOTBALL_PACKAGE"
}

# Function to promote package versions
promote_versions() {
    print_status "Promoting latest package versions to released..."
    
    # Promote core package
    local core_version=$(sf package version list --package "$CORE_PACKAGE" --json | jq -r '.result[0].SubscriberPackageVersionId // empty')
    if [[ -n "$core_version" ]]; then
        print_status "Promoting core package version: $core_version"
        if sf package version promote --package "$core_version" --no-prompt; then
            print_success "Core package version promoted"
        else
            print_error "Failed to promote core package version"
        fi
    fi
    
    # Promote football package
    local football_version=$(sf package version list --package "$FOOTBALL_PACKAGE" --json | jq -r '.result[0].SubscriberPackageVersionId // empty')
    if [[ -n "$football_version" ]]; then
        print_status "Promoting football package version: $football_version"
        if sf package version promote --package "$football_version" --no-prompt; then
            print_success "Football package version promoted"
        else
            print_error "Failed to promote football package version"
        fi
    fi
}

# Function to validate dependencies
validate_dependencies() {
    print_status "Validating package dependencies..."
    
    # Check if sfdx-project.json is valid
    if ! jq empty sfdx-project.json 2>/dev/null; then
        print_error "Invalid sfdx-project.json file"
        return 1
    fi
    
    # Check package directory structure
    if [[ ! -d "sportsmgmt" ]]; then
        print_error "Core package directory 'sportsmgmt' not found"
        return 1
    fi
    
    if [[ ! -d "sportsmgmt-football" ]]; then
        print_error "Football package directory 'sportsmgmt-football' not found"
        return 1
    fi
    
    print_success "Package structure validation passed"
    
    # Validate dependency configuration
    local football_deps=$(jq -r '.packageDirectories[] | select(.path=="sportsmgmt-football") | .dependencies[]?.package' sfdx-project.json)
    
    if [[ "$football_deps" == "$CORE_PACKAGE" ]]; then
        print_success "Football package dependency configuration is correct"
    else
        print_error "Football package dependency configuration is incorrect"
        return 1
    fi
}

# Parse command line arguments
COMMAND="$1"
shift

TARGET_ORG=""
WAIT_TIME="10"
SKIP_VALIDATION="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --target-org)
            TARGET_ORG="$2"
            shift 2
            ;;
        --wait)
            WAIT_TIME="$2"
            shift 2
            ;;
        --skip-validation)
            SKIP_VALIDATION="true"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Execute command
case $COMMAND in
    create-versions)
        print_status "Creating versions for all packages..."
        create_package_version "$CORE_PACKAGE" "$WAIT_TIME" "$SKIP_VALIDATION"
        create_package_version "$FOOTBALL_PACKAGE" "$WAIT_TIME" "$SKIP_VALIDATION"
        ;;
    create-core-version)
        create_package_version "$CORE_PACKAGE" "$WAIT_TIME" "$SKIP_VALIDATION"
        ;;
    create-football-version)
        create_package_version "$FOOTBALL_PACKAGE" "$WAIT_TIME" "$SKIP_VALIDATION"
        ;;
    install-packages)
        install_packages "$TARGET_ORG"
        ;;
    list-packages)
        list_packages
        ;;
    promote-versions)
        promote_versions
        ;;
    validate-dependencies)
        validate_dependencies
        ;;
    help|--help|-h)
        usage
        ;;
    "")
        print_error "No command specified"
        usage
        exit 1
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac 