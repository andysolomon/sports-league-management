#!/usr/bin/env bash
#
# Run E2E Tests Against a Scratch Org
#
# Usage: ./scripts/run-e2e-tests.sh [org-alias] [--headed] [--report]
#
# Prerequisites:
#   - Active scratch org with deployed metadata
#   - Seed data loaded (node scripts/seed-data.js)
#   - npm dependencies installed (npm install)
#   - Playwright browsers installed (npx playwright install chromium)

set -euo pipefail

ORG_ALIAS="${1:-sports-scratch}"
HEADED=""
REPORT=""

# Parse optional flags
for arg in "$@"; do
  case "$arg" in
    --headed) HEADED="--headed" ;;
    --report) REPORT="--reporter=html" ;;
  esac
done

echo "🔍 Checking scratch org: ${ORG_ALIAS}..."

# Verify org exists
if ! sf org display --target-org "${ORG_ALIAS}" --json > /dev/null 2>&1; then
  echo "❌ Scratch org '${ORG_ALIAS}' not found or not authenticated."
  echo "   Create one with: node scripts/create-scratch-org.js ${ORG_ALIAS}"
  exit 1
fi

echo "✅ Scratch org found"

# Check if seed data exists
LEAGUE_COUNT=$(sf data query \
  --query "SELECT COUNT() FROM League__c" \
  --target-org "${ORG_ALIAS}" \
  --json 2>/dev/null | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log(data.result.totalSize || 0);
  " 2>/dev/null || echo "0")

if [ "${LEAGUE_COUNT}" = "0" ]; then
  echo "⚠️  No seed data found. Loading seed data..."
  node scripts/seed-data.js "${ORG_ALIAS}"
  echo "✅ Seed data loaded"
else
  echo "✅ Seed data present (${LEAGUE_COUNT} leagues)"
fi

# Ensure Playwright browsers are installed
if ! npx playwright install --dry-run chromium > /dev/null 2>&1; then
  echo "📦 Installing Playwright browsers..."
  npx playwright install chromium
fi

# Get org info for environment variables
ORG_INFO=$(sf org display --target-org "${ORG_ALIAS}" --json)
INSTANCE_URL=$(echo "${ORG_INFO}" | node -e "
  const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(data.result.instanceUrl);
")

echo ""
echo "🚀 Running E2E tests..."
echo "   Org: ${ORG_ALIAS}"
echo "   URL: ${INSTANCE_URL}"
echo ""

# Run tests
SF_ORG_ALIAS="${ORG_ALIAS}" SF_INSTANCE_URL="${INSTANCE_URL}" \
  npx playwright test ${HEADED} ${REPORT}

EXIT_CODE=$?

if [ ${EXIT_CODE} -eq 0 ]; then
  echo ""
  echo "✅ All E2E tests passed!"
else
  echo ""
  echo "❌ Some E2E tests failed. Check the report above for details."
  echo "   For an HTML report, run: npm run test:e2e:report"
fi

# Open report if requested
if [ -n "${REPORT}" ] && [ ${EXIT_CODE} -eq 0 ]; then
  echo "📊 Opening HTML report..."
  npx playwright show-report
fi

exit ${EXIT_CODE}
