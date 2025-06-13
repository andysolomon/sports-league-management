#!/usr/bin/env node

/* eslint-env node */
// Script: create-app.js
// Creates a Lightning app (CustomApplication) in the target org via metadata deployment.
// Usage: node scripts/create-app.js "Sports League Management" [alias]

import fs from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const APP_LABEL = process.argv[2] || 'Sports League Management';
const ORG_ALIAS = process.argv[3] || 'sports-scratch';

const API_NAME = APP_LABEL.replace(/\s+/g, '_'); // simple conversion -> Sports_League_Management
const metaDir = join(__dirname, '..', 'temp-app');
const appDir = join(metaDir, 'applications');
const filePath = join(appDir, `${API_NAME}.app-meta.xml`);

// Ensure dir
fs.mkdirSync(appDir, { recursive: true });

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomApplication xmlns="http://soap.sforce.com/2006/04/metadata">
    <defaultLandingTab>standard-Home</defaultLandingTab>
    <description>${APP_LABEL} workspace.</description>
    <label>${APP_LABEL}</label>
    <navType>Standard</navType>
    <tabs>standard-Home</tabs>
    <tabs>CustomObject:League__c</tabs>
    <tabs>CustomObject:Team__c</tabs>
</CustomApplication>`;

fs.writeFileSync(filePath, xml);

console.log(`\n🛠  Generating app metadata at ${filePath}`);

try {
  execSync(`sf project deploy start --source-dir ${metaDir} --target-org ${ORG_ALIAS} --wait 10`, {
    stdio: 'inherit',
  });
  console.log('\n✅  App deployed! Open App Manager to verify.');
} catch (e) {
  console.error('\n❌  Failed to deploy app metadata');
  process.exit(1);
}

// Cleanup temp directory
fs.rmSync(metaDir, { recursive: true, force: true }); 