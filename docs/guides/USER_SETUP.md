# User Setup for Sports Management Development

This document explains how to set up users and permissions when creating scratch orgs for the Sports Management application.

## Quick Start

### Option 1: Complete Setup (Recommended)
Create a new scratch org with all users and permissions configured automatically:

```bash
node scripts/create-scratch-org.js [org-alias] [duration-days]
```

**Examples:**
```bash
# Create default scratch org (sports-scratch, 30 days)
node scripts/create-scratch-org.js

# Create custom scratch org
node scripts/create-scratch-org.js my-sports-org 7

# Create long-term development org
node scripts/create-scratch-org.js sports-dev 30
```

### Option 2: Manual User Setup
If you already have a scratch org and just need to set up users:

```bash
node scripts/setup-users.js [org-alias]
```

## What Gets Created

### Scratch Org Configuration
- **Lightning Experience** enabled
- **Enhanced security settings** for development
- **Admin login as any user** enabled
- **Extended session timeout** (8 hours)
- **Service Cloud** and **Communities** features

### Users Created

| Username | Role | Profile | Permissions | Purpose |
|----------|------|---------|-------------|---------|
| `league.admin@sportsorg.scratch` | League Administrator | System Administrator | Full access + Sports app | Primary admin user |
| `team.manager@sportsorg.scratch` | Team Manager | Standard User | Sports app access | Limited team management |
| `data.viewer@sportsorg.scratch` | Data Viewer | Standard User | Read-only | Testing access controls |

### Permission Sets
- **Sports_League_Management_Access**: Grants access to the Sports League Management app

## Manual Setup Steps

If you prefer to set up users manually:

### 1. Create Scratch Org
```bash
sf org create scratch --definition-file config/sports-scratch-def.json --alias sports-scratch --duration-days 30 --set-default
```

### 2. Deploy Core Metadata
```bash
# Deploy permission sets
sf project deploy start --source-dir sportsmgmt/main/default/permissionsets --target-org sports-scratch

# Deploy applications
sf project deploy start --source-dir sportsmgmt/main/default/applications --target-org sports-scratch
```

### 3. Create Users
```bash
# Create League Administrator
sf data create record --sobject User --values "Username=league.admin@sportsorg.scratch FirstName=League LastName=Administrator Email=league.admin@example.com ProfileId=[SYSTEM_ADMIN_PROFILE_ID] Alias=league-admin TimeZoneSidKey=America/New_York LocaleSidKey=en_US EmailEncodingKey=UTF-8 LanguageLocaleKey=en_US" --target-org sports-scratch

# Create Team Manager
sf data create record --sobject User --values "Username=team.manager@sportsorg.scratch FirstName=Team LastName=Manager Email=team.manager@example.com ProfileId=[STANDARD_USER_PROFILE_ID] Alias=team-mgr TimeZoneSidKey=America/New_York LocaleSidKey=en_US EmailEncodingKey=UTF-8 LanguageLocaleKey=en_US" --target-org sports-scratch
```

### 4. Assign Permission Sets
```bash
# Get permission set ID
sf data query --query "SELECT Id FROM PermissionSet WHERE Name = 'Sports_League_Management_Access'" --target-org sports-scratch

# Assign to users
sf data create record --sobject PermissionSetAssignment --values "AssigneeId=[USER_ID] PermissionSetId=[PERMISSION_SET_ID]" --target-org sports-scratch
```

## Testing User Access

### 1. Login as Different Users
```bash
# Open org as default user
sf org open --target-org sports-scratch

# Login as specific user (requires user setup)
sf org open --target-org sports-scratch --path /secur/login_portal.jsp?un=league.admin@sportsorg.scratch
```

### 2. Verify App Access
1. Click the **App Launcher** (9-dot waffle menu)
2. Search for "Sports League Management"
3. Verify the app appears for users with permission sets
4. Verify the app does NOT appear for users without permission sets

### 3. Test User Permissions
- **League Administrator**: Should have full access to all features
- **Team Manager**: Should have limited access based on profile
- **Data Viewer**: Should have read-only access

## Troubleshooting

### App Not Visible in App Launcher
1. Check permission set assignment:
   ```bash
   sf data query --query "SELECT AssigneeId, PermissionSet.Name FROM PermissionSetAssignment WHERE PermissionSet.Name = 'Sports_League_Management_Access'" --target-org sports-scratch
   ```

2. Manually assign permission set:
   ```bash
   node scripts/setup-users.js sports-scratch
   ```

### User Creation Fails
1. Check if profiles exist:
   ```bash
   sf data query --query "SELECT Id, Name FROM Profile WHERE Name IN ('System Administrator', 'Standard User')" --target-org sports-scratch
   ```

2. Verify scratch org is active:
   ```bash
   sf org list
   ```

### Permission Issues
1. Check user profile assignments
2. Verify permission set deployments
3. Ensure Lightning Experience is enabled

## Best Practices

### Development Workflow
1. **Always use the automated scripts** for consistency
2. **Test with multiple user contexts** during development
3. **Document any custom permission requirements**
4. **Use descriptive org aliases** for different purposes

### Security Considerations
- **Never use production usernames** in scratch orgs
- **Use example.com email domains** for test users
- **Enable admin login as any user** for development convenience
- **Set appropriate session timeouts** for development work

### Maintenance
- **Recreate scratch orgs regularly** (weekly/bi-weekly)
- **Update user scripts** when adding new features
- **Test permission changes** with all user types
- **Document any manual setup steps** for team members

## Advanced Configuration

### Custom User Types
To add new user types, modify `scripts/setup-users.js`:

```javascript
const USERS_CONFIG = [
    // ... existing users ...
    {
        alias: 'custom-role',
        username: 'custom.role@sportsorg.scratch',
        firstName: 'Custom',
        lastName: 'Role',
        email: 'custom.role@example.com',
        profileName: 'Standard User',
        permissionSets: ['Sports_League_Management_Access'],
        description: 'Custom role for specific testing'
    }
];
```

### Additional Permission Sets
Create new permission sets in `sportsmgmt/main/default/permissionsets/` and reference them in the user configuration.

### Org-Specific Settings
Modify `config/sports-scratch-def.json` to adjust:
- Features enabled
- Security settings
- User management preferences
- Session configurations

## Related Documentation
- [Scratch Org Setup](SCRATCH_ORG_SETUP.md)
- [Development Workflow](DEVELOPMENT_WORKFLOW.md)
- [Testing Guide](TESTING_GUIDE.md) 