#!/bin/bash
# Post-deploy hook: automatically updates Agile Accelerator story
# Triggered after deploy-and-test skill completes successfully.
#
# What it does:
#   1. Extracts story number from git branch (feat/W-XXXXXX)
#   2. Moves the story to "Ready for Review"
#   3. Adds the implementation plan from the sprint plan doc

set -euo pipefail

ORG="sprts-mng"
SPRINT_PLAN="docs/SPRINT_2025_07_PLAN.md"

# Read hook input from stdin
INPUT=$(cat)

# Only run for the deploy-and-test skill
SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty' 2>/dev/null)
if [[ "$SKILL_NAME" != "deploy-and-test" ]]; then
  exit 0
fi

# Get project directory
PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
if [[ -z "$PROJECT_DIR" ]]; then
  PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
cd "$PROJECT_DIR"

# Extract story number from git branch name (e.g., feat/W-000020 -> W-000020)
BRANCH=$(git branch --show-current 2>/dev/null || true)
STORY_NAME=$(echo "$BRANCH" | grep -oE 'W-[0-9]+' || true)

if [[ -z "$STORY_NAME" ]]; then
  # Not on a feature branch — nothing to update
  exit 0
fi

# Look up the work item in Agile Accelerator
QUERY_RESULT=$(sf data query \
  --query "SELECT Id, Name, agf__Subject__c, agf__Status__c FROM agf__ADM_Work__c WHERE Name = '${STORY_NAME}'" \
  --target-org "$ORG" \
  --json 2>/dev/null || true)

RECORD_ID=$(echo "$QUERY_RESULT" | jq -r '.result.records[0].Id // empty' 2>/dev/null)
CURRENT_STATUS=$(echo "$QUERY_RESULT" | jq -r '.result.records[0].agf__Status__c // empty' 2>/dev/null)
SUBJECT=$(echo "$QUERY_RESULT" | jq -r '.result.records[0].agf__Subject__c // empty' 2>/dev/null)

if [[ -z "$RECORD_ID" ]]; then
  echo "Hook: Could not find work item ${STORY_NAME} in Agile Accelerator" >&2
  exit 0  # Non-blocking — don't fail the workflow
fi

# Move to "Ready for Review" if currently "In Progress" or "New"
if [[ "$CURRENT_STATUS" == "In Progress" || "$CURRENT_STATUS" == "New" ]]; then
  sf data update record \
    --sobject agf__ADM_Work__c \
    --record-id "$RECORD_ID" \
    --values "agf__Status__c='Ready for Review'" \
    --target-org "$ORG" >/dev/null 2>&1 || true

  NEW_STATUS="Ready for Review"
else
  NEW_STATUS="$CURRENT_STATUS"
fi

# Extract implementation plan from sprint plan doc and add to story Details
if [[ -f "$SPRINT_PLAN" ]]; then
  # Extract the <details> block for this story
  PLAN=$(sed -n "/### ${STORY_NAME}:/,/^---$/p" "$SPRINT_PLAN" \
    | sed -n '/<details>/,/<\/details>/p' \
    | sed '1d;$d' \
    | sed 's/<summary>.*<\/summary>//' \
    | sed '/^$/d' \
    | head -80 \
    | tr "'" '"' \
    | tr '\n' ' ' \
    | sed 's/  */ /g' \
    | sed 's/^ *//;s/ *$//' || true)

  if [[ -n "$PLAN" ]]; then
    sf data update record \
      --sobject agf__ADM_Work__c \
      --record-id "$RECORD_ID" \
      --values "agf__Details__c='${PLAN}'" \
      --target-org "$ORG" >/dev/null 2>&1 || true
  fi
fi

# Output message for Claude's context
cat <<EOF
{
  "continue": true,
  "suppressOutput": false,
  "hookSpecificOutput": {
    "additionalContext": "Agile Accelerator updated: ${STORY_NAME} (${SUBJECT}) moved from ${CURRENT_STATUS} to ${NEW_STATUS}. Implementation plan added to story details."
  }
}
EOF

exit 0
