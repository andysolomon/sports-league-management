#!/usr/bin/env node

/**
 * Sports Management - User Setup Script
 * 
 * This script creates and configures users for scratch org development.
 * It assigns proper permissions and creates test data users.
 * 
 * Usage: node scripts/setup-users.js [scratch-org-alias]
 */

import { execSync } from 'child_process';

// Configuration
const SCRATCH_ORG_ALIAS = process.argv[2] || 'sports-scratch';
const PERMISSION_SET_NAME = 'Sports_League_Management_Access';

// User profiles to configure (using existing users)
const USERS_CONFIG = [
    {
        alias: 'ladmin',
        username: 'league.admin@sportsorg.scratch',
        firstName: 'League',
        lastName: 'Administrator',
        email: 'league.admin@example.com',
        profileName: 'System Administrator',
        permissionSets: [PERMISSION_SET_NAME],
        description: 'Primary league administrator with full access',
        createNew: true
    },
    {
        alias: 'tmgr',
        username: null, // Will be found by name
        firstName: 'Team',
        lastName: 'Manager',
        email: 'team.manager@sportsorg.scratch',
        findByName: 'Integration User',
        permissionSets: [PERMISSION_SET_NAME],
        description: 'Team manager with limited access to team data (updating Integration User)',
        createNew: false
    },
    {
        alias: 'dviewer',
        username: null, // Will be found by name
        firstName: 'Data',
        lastName: 'Viewer',
        email: 'data.viewer@sportsorg.scratch',
        findByName: 'Security User',
        permissionSets: [],
        description: 'Read-only user for testing access controls (updating Security User)',
        createNew: false
    }
];

/**
 * Execute shell command and return output
 */
function executeCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        const result = execSync(command, { 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(`✅ ${description} completed`);
        return result;
    } catch (error) {
        console.error(`❌ ${description} failed:`);
        console.error(error.message);
        if (error.stdout) console.log('STDOUT:', error.stdout);
        if (error.stderr) console.log('STDERR:', error.stderr);
        throw error;
    }
}

/**
 * Check if scratch org exists and is active
 */
function validateScratchOrg() {
    console.log(`\n🔍 Validating scratch org: ${SCRATCH_ORG_ALIAS}`);
    
    try {
        const orgList = executeCommand('sf org list --json', 'Getting org list');
        const orgs = JSON.parse(orgList);
        
        const scratchOrg = orgs.result.scratchOrgs?.find(org => 
            org.alias === SCRATCH_ORG_ALIAS && org.status === 'Active'
        );
        
        if (!scratchOrg) {
            throw new Error(`Scratch org '${SCRATCH_ORG_ALIAS}' not found or not active`);
        }
        
        console.log(`✅ Scratch org validated: ${scratchOrg.username}`);
        return scratchOrg;
    } catch (error) {
        console.error(`❌ Failed to validate scratch org: ${error.message}`);
        throw error;
    }
}

/**
 * Get current user information (simplified)
 */
function getCurrentUser() {
    console.log(`\n👤 Getting current user information...`);
    
    try {
        const userQuery = `sf data query --query "SELECT Id, Username, Email, FirstName, LastName, ProfileId, Profile.Name FROM User WHERE Profile.Name = 'System Administrator' LIMIT 1" --target-org ${SCRATCH_ORG_ALIAS} --json`;
        const result = executeCommand(userQuery, 'Querying system administrator user');
        const queryResult = JSON.parse(result);
        
        if (queryResult.result.records.length > 0) {
            const currentUser = queryResult.result.records[0];
            console.log(`✅ Found admin user: ${currentUser.Username} (${currentUser.FirstName} ${currentUser.LastName})`);
            return currentUser;
        }
        
        console.log(`⚠️  No system administrator found, continuing without current user info`);
        return null;
    } catch (error) {
        console.log(`⚠️  Could not get current user info, continuing: ${error.message}`);
        return null;
    }
}

/**
 * Ensure permission set exists
 */
function ensurePermissionSet() {
    console.log(`\n🔐 Checking permission set: ${PERMISSION_SET_NAME}`);
    
    try {
        const query = `sf data query --query "SELECT Id, Name FROM PermissionSet WHERE Name = '${PERMISSION_SET_NAME}'" --target-org ${SCRATCH_ORG_ALIAS} --json`;
        const result = executeCommand(query, 'Checking permission set');
        const queryResult = JSON.parse(result);
        
        if (queryResult.result.records.length === 0) {
            console.log(`⚠️  Permission set '${PERMISSION_SET_NAME}' not found. Please deploy it first.`);
            console.log(`   Run: sf project deploy start --source-dir sportsmgmt/main/default/permissionsets --target-org ${SCRATCH_ORG_ALIAS}`);
            return null;
        }
        
        const permissionSet = queryResult.result.records[0];
        console.log(`✅ Permission set found: ${permissionSet.Id}`);
        return permissionSet;
    } catch (error) {
        console.error(`❌ Failed to check permission set: ${error.message}`);
        return null;
    }
}

/**
 * Create or find a user
 */
function createUser(userConfig) {
    if (userConfig.createNew) {
        console.log(`\n👥 Creating user: ${userConfig.username}`);
        
        try {
            // Check if user already exists
            const existingUserQuery = `sf data query --query "SELECT Id, Username FROM User WHERE Username = '${userConfig.username}'" --target-org ${SCRATCH_ORG_ALIAS} --json`;
            const existingResult = executeCommand(existingUserQuery, `Checking if user ${userConfig.username} exists`);
            const existingQueryResult = JSON.parse(existingResult);
            
            if (existingQueryResult.result.records.length > 0) {
                console.log(`⚠️  User ${userConfig.username} already exists, skipping creation`);
                return existingQueryResult.result.records[0];
            }
            
            // Get profile ID
            const profileQuery = `sf data query --query "SELECT Id FROM Profile WHERE Name = '${userConfig.profileName}'" --target-org ${SCRATCH_ORG_ALIAS} --json`;
            const profileResult = executeCommand(profileQuery, `Getting ${userConfig.profileName} profile`);
            const profileQueryResult = JSON.parse(profileResult);
            
            if (profileQueryResult.result.records.length === 0) {
                throw new Error(`Profile '${userConfig.profileName}' not found`);
            }
            
            const profileId = profileQueryResult.result.records[0].Id;
            
            // Create user
            const userValues = [
                `Username=${userConfig.username}`,
                `FirstName=${userConfig.firstName}`,
                `LastName=${userConfig.lastName}`,
                `Email=${userConfig.email}`,
                `ProfileId=${profileId}`,
                `Alias=${userConfig.alias}`,
                `TimeZoneSidKey=America/New_York`,
                `LocaleSidKey=en_US`,
                `EmailEncodingKey=UTF-8`,
                `LanguageLocaleKey=en_US`
            ].join(' ');
            
            const createCommand = `sf data create record --sobject User --values "${userValues}" --target-org ${SCRATCH_ORG_ALIAS} --json`;
            const createResult = executeCommand(createCommand, `Creating user ${userConfig.username}`);
            const createQueryResult = JSON.parse(createResult);
            
            console.log(`✅ User created: ${userConfig.username} (ID: ${createQueryResult.result.id})`);
            
            return {
                Id: createQueryResult.result.id,
                Username: userConfig.username,
                ...userConfig
            };
            
        } catch (error) {
            console.error(`❌ Failed to create user ${userConfig.username}: ${error.message}`);
            throw error;
        }
    } else {
        console.log(`\n🔍 Finding existing user: ${userConfig.findByName}`);
        
        try {
            // Find user by name (FirstName + LastName)
            const nameParts = userConfig.findByName.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            
            const userQuery = `sf data query --query "SELECT Id, Username, Email, FirstName, LastName, Profile.Name FROM User WHERE FirstName = '${firstName}' AND LastName = '${lastName}' AND IsActive = true LIMIT 1" --target-org ${SCRATCH_ORG_ALIAS} --json`;
            const result = executeCommand(userQuery, `Finding user named ${userConfig.findByName}`);
            const queryResult = JSON.parse(result);
            
            if (queryResult.result.records.length === 0) {
                throw new Error(`No active user found with name '${userConfig.findByName}'`);
            }
            
            const existingUser = queryResult.result.records[0];
            console.log(`✅ Found existing user: ${existingUser.Username} (${existingUser.FirstName} ${existingUser.LastName}) - Profile: ${existingUser.Profile.Name}`);
            
            // Update user with new information
            console.log(`🔄 Updating user information...`);
            const updateValues = [
                `FirstName=${userConfig.firstName}`,
                `LastName=${userConfig.lastName}`,
                `Email=${userConfig.email}`
            ].join(' ');
            
            const updateCommand = `sf data update record --sobject User --record-id ${existingUser.Id} --values "${updateValues}" --target-org ${SCRATCH_ORG_ALIAS} --json`;
            executeCommand(updateCommand, `Updating user ${existingUser.Username} information`);
            
            console.log(`✅ User updated: ${existingUser.Username} → ${userConfig.firstName} ${userConfig.lastName}`);
            
            return {
                Id: existingUser.Id,
                Username: existingUser.Username,
                profileName: existingUser.Profile.Name,
                ...userConfig,
                actualFirstName: userConfig.firstName,
                actualLastName: userConfig.lastName,
                actualEmail: userConfig.email
            };
            
        } catch (error) {
            console.error(`❌ Failed to find/update user named ${userConfig.findByName}: ${error.message}`);
            throw error;
        }
    }
}

/**
 * Assign permission set to user
 */
function assignPermissionSet(userId, permissionSetId, username) {
    console.log(`\n🔐 Assigning permission set to ${username}...`);
    
    try {
        // Check if assignment already exists
        const existingQuery = `sf data query --query "SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSetId = '${permissionSetId}'" --target-org ${SCRATCH_ORG_ALIAS} --json`;
        const existingResult = executeCommand(existingQuery, 'Checking existing permission set assignment');
        const existingQueryResult = JSON.parse(existingResult);
        
        if (existingQueryResult.result.records.length > 0) {
            console.log(`⚠️  Permission set already assigned to ${username}`);
            return;
        }
        
        // Create assignment
        const assignCommand = `sf data create record --sobject PermissionSetAssignment --values "AssigneeId=${userId} PermissionSetId=${permissionSetId}" --target-org ${SCRATCH_ORG_ALIAS} --json`;
        executeCommand(assignCommand, `Assigning permission set to ${username}`);
        
        console.log(`✅ Permission set assigned to ${username}`);
        
    } catch (error) {
        console.error(`❌ Failed to assign permission set to ${username}: ${error.message}`);
        // Don't throw - continue with other users
    }
}

/**
 * Generate user summary report
 */
function generateUserReport(users, currentUser) {
    console.log(`\n📊 USER SETUP SUMMARY`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Scratch Org: ${SCRATCH_ORG_ALIAS}`);
    if (currentUser) {
        console.log(`Current User: ${currentUser.Username} (${currentUser.Profile?.Name || 'Unknown Profile'})`);
    } else {
        console.log(`Current User: Not identified`);
    }
    console.log(`\nCreated/Configured Users:`);
    
    users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.Username}`);
        console.log(`   Name: ${user.actualFirstName || user.firstName} ${user.actualLastName || user.lastName}`);
        console.log(`   Email: ${user.actualEmail || user.email || 'N/A'}`);
        console.log(`   Profile: ${user.profileName}`);
        console.log(`   Permission Sets: ${user.permissionSets.length > 0 ? user.permissionSets.join(', ') : 'None'}`);
        console.log(`   Description: ${user.description}`);
        console.log('');
    });
    
    console.log(`\n🎯 NEXT STEPS:`);
    console.log(`1. Test login with created users`);
    console.log(`2. Verify app access in each user context`);
    console.log(`3. Deploy custom objects and test data`);
    console.log(`4. Run: sf org open --target-org ${SCRATCH_ORG_ALIAS} --path /lightning/setup/ManageUsers/home`);
}

/**
 * Main execution function
 */
async function main() {
    console.log(`🚀 SPORTS MANAGEMENT - USER SETUP`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Target Org: ${SCRATCH_ORG_ALIAS}`);
    
    try {
        // Validate scratch org
        validateScratchOrg();
        
        // Get current user (optional)
        const currentUser = getCurrentUser();
        
        // Ensure permission set exists
        const permissionSet = ensurePermissionSet();
        
        // Create users
        const createdUsers = [];
        for (const userConfig of USERS_CONFIG) {
            try {
                const user = createUser(userConfig);
                createdUsers.push({ ...user, ...userConfig });
                
                // Assign permission sets if available
                if (permissionSet && userConfig.permissionSets.includes(PERMISSION_SET_NAME)) {
                    assignPermissionSet(user.Id, permissionSet.Id, user.Username);
                }
                
            } catch (error) {
                console.error(`⚠️  Skipping user ${userConfig.username} due to error`);
            }
        }
        
        // Assign permission set to current user if available
        if (permissionSet && currentUser) {
            assignPermissionSet(currentUser.Id, permissionSet.Id, currentUser.Username);
        }
        
        // Generate report
        generateUserReport(createdUsers, currentUser);
        
        console.log(`\n✅ User setup completed successfully!`);
        
    } catch (error) {
        console.error(`\n❌ User setup failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 