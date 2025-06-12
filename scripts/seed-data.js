/* eslint-env node */
// Script to seed League and Team sample data into the default org (or alias provided)
// Usage: node scripts/seed-data.js [alias]

const { execSync } = require('child_process');
const path = require('path');

const orgAlias = process.argv[2] || 'sports-scratch';
const planPath = path.join(__dirname, '..', 'data', 'league-team-plan.json');

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