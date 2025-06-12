#!/usr/bin/env node

/**
 * Sports Management - Data Seeding Script
 * 
 * Script to seed League and Team sample data into the default org (or alias provided)
 * Usage: node scripts/seed-data.js [alias]
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const orgAlias = process.argv[2] || 'sports-scratch';
const planPath = join(__dirname, '..', 'data', 'league-team-plan.json');

try {
  console.log(`\n🏈  Importing League & Team sample data into org: ${orgAlias}\n`);
  execSync(`sf data tree import --plan ${planPath} --target-org ${orgAlias}`, {
    stdio: 'inherit',
  });
  console.log('\n✅  Data import complete!');
} catch (err) {
  console.error('\n❌  Data import failed.');
  process.exit(1);
} 