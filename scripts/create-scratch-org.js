#!/usr/bin/env node

/**
 * Sports Management - Complete Scratch Org Setup
 * 
 * This script creates a new scratch org and sets up all necessary users and permissions.
 * 
 * Usage: node scripts/create-scratch-org.js [org-alias] [duration-days]
 */

import { execSync } from 'child_process';

// Configuration
const ORG_ALIAS = process.argv[2] || 'sports-scratch';
const DURATION_DAYS = process.argv[3] || '30';
const SCRATCH_DEF_FILE = 'config/sports-scratch-def.json';

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
 * Create scratch org
 */
function createScratchOrg() {
    console.log(`\n🏗️  Creating scratch org: ${ORG_ALIAS}`);
    
    const createCommand = `sf org create scratch --definition-file ${SCRATCH_DEF_FILE} --alias ${ORG_ALIAS} --duration-days ${DURATION_DAYS} --set-default --json`;
    const result = executeCommand(createCommand, `Creating scratch org ${ORG_ALIAS}`);
    
    const createResult = JSON.parse(result);
    console.log(`✅ Scratch org created successfully!`);
    console.log(`   Org ID: ${createResult.result.orgId}`);
    console.log(`   Username: ${createResult.result.username}`);
    console.log(`   Expires: ${DURATION_DAYS} days`);
    
    return createResult.result;
}

/**
 * Deploy core metadata
 */
function deployCoreMetadata() {
    console.log(`\n📦 Deploying core metadata...`);
    
    // Deploy permission sets first
    executeCommand(
        `sf project deploy start --source-dir sportsmgmt/main/default/permissionsets --target-org ${ORG_ALIAS}`,
        'Deploying permission sets'
    );
    
    // Deploy applications
    executeCommand(
        `sf project deploy start --source-dir sportsmgmt/main/default/applications --target-org ${ORG_ALIAS}`,
        'Deploying applications'
    );
    
    console.log(`✅ Core metadata deployed successfully!`);
}

/**
 * Setup users and permissions
 */
function setupUsers() {
    console.log(`\n👥 Setting up users and permissions...`);
    
    executeCommand(
        `node scripts/setup-users.js ${ORG_ALIAS}`,
        'Running user setup script'
    );
    
    console.log(`✅ Users and permissions configured!`);
}

/**
 * Open the org
 */
function openOrg() {
    console.log(`\n🌐 Opening scratch org...`);
    
    executeCommand(
        `sf org open --target-org ${ORG_ALIAS}`,
        'Opening scratch org in browser'
    );
}

/**
 * Generate setup summary
 */
function generateSummary(orgInfo) {
    console.log(`\n📋 SCRATCH ORG SETUP COMPLETE`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Org Alias: ${ORG_ALIAS}`);
    console.log(`Username: ${orgInfo.username}`);
    console.log(`Org ID: ${orgInfo.orgId}`);
    console.log(`Duration: ${DURATION_DAYS} days`);
    console.log(`\n🎯 WHAT'S BEEN CONFIGURED:`);
    console.log(`✅ Scratch org created with Lightning Experience`);
    console.log(`✅ Sports League Management app deployed`);
    console.log(`✅ Permission sets created and assigned`);
    console.log(`✅ Development users created:`);
    console.log(`   • league.admin@sportsorg.scratch (System Admin)`);
    console.log(`   • team.manager@sportsorg.scratch (Standard User)`);
    console.log(`   • data.viewer@sportsorg.scratch (Read-only)`);
    console.log(`\n🚀 NEXT STEPS:`);
    console.log(`1. Deploy custom objects: sf project deploy start --source-dir sportsmgmt/main/default/objects`);
    console.log(`2. Load test data: node scripts/seed-data.js ${ORG_ALIAS}`);
    console.log(`3. Test the app in different user contexts`);
    console.log(`4. Start developing your Lightning Web Components`);
    console.log(`\n📱 USEFUL COMMANDS:`);
    console.log(`• Open org: sf org open --target-org ${ORG_ALIAS}`);
    console.log(`• View users: sf org open --target-org ${ORG_ALIAS} --path /lightning/setup/ManageUsers/home`);
    console.log(`• Delete org: sf org delete scratch --target-org ${ORG_ALIAS} --no-prompt`);
}

/**
 * Main execution function
 */
async function main() {
    console.log(`🚀 SPORTS MANAGEMENT - SCRATCH ORG SETUP`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Creating: ${ORG_ALIAS}`);
    console.log(`Duration: ${DURATION_DAYS} days`);
    
    try {
        // Create scratch org
        const orgInfo = createScratchOrg();
        
        // Deploy core metadata
        deployCoreMetadata();
        
        // Setup users
        setupUsers();
        
        // Generate summary
        generateSummary(orgInfo);
        
        // Open org
        openOrg();
        
        console.log(`\n🎉 Scratch org setup completed successfully!`);
        
    } catch (error) {
        console.error(`\n💥 Setup failed: ${error.message}`);
        console.error(`\n🔧 TROUBLESHOOTING:`);
        console.error(`1. Check if you have a valid Dev Hub configured`);
        console.error(`2. Verify the scratch org definition file exists`);
        console.error(`3. Ensure you have proper Salesforce CLI permissions`);
        console.error(`4. Try: sf auth list to check your connections`);
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 