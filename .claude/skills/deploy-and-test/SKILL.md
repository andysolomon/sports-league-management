---
name: deploy-and-test
description: Deploy to scratch org and run Apex tests. Run this after completing a story implementation.
disable-model-invocation: false
allowed-tools: Bash(sf *), Bash(npm run *)
---

# Deploy and Run Apex Tests

Deploy the project to the scratch org and run Apex tests to verify the implementation.

## Arguments

- `$ARGUMENTS` — optional: specific test class names (comma-separated). If not provided, runs all tests.

## Steps

1. **Deploy** the project to the scratch org:
   ```
   sf project deploy start --source-dir sportsmgmt
   ```
   - If deployment fails, report the errors and stop.

2. **Run Apex tests**:
   - If test class names were provided via `$ARGUMENTS`, run only those:
     ```
     sf apex test run --tests $ARGUMENTS --wait 10 --code-coverage --result-format human
     ```
   - Otherwise, run all tests:
     ```
     sf apex test run --wait 10 --code-coverage --result-format human
     ```

3. **Run LWC Jest tests**:
   ```
   npm run test:unit
   ```
   - If `npm run test:unit` fails due to environment issues, fall back to running jest directly:
     ```
     npx jest --config jest.config.js
     ```

4. **Report results**:
   - Summarize deployment status (success/failure)
   - Summarize Apex test results (pass/fail count, coverage %)
   - Summarize Jest test results (pass/fail count)
   - Flag if org-wide coverage drops below 90%
   - If anything failed, list the specific failures and suggest next steps
