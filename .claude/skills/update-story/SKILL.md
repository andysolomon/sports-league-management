---
name: update-story
description: Update Agile Accelerator work item status and add implementation plan. Use when starting, completing, or updating a story.
disable-model-invocation: false
allowed-tools: Bash(sf data:*), Read, Grep
---

# Update Agile Accelerator Story

Updates a work item in Agile Accelerator: changes its status and optionally writes the implementation plan from the sprint plan doc into the story's Details field.

## Arguments

- `$ARGUMENTS` — work item name (e.g. `W-000020`) followed by optional status (e.g. `In Progress`, `Ready for Review`, `Closed`). If no status is given, defaults to `Closed`.

Examples:
- `/update-story W-000020 In Progress` — move W-000020 to In Progress
- `/update-story W-000020 Closed` — close W-000020
- `/update-story W-000020` — close W-000020 (defaults to Closed)

## Constants

- **Org alias:** `sprts-mng`
- **Sprint plan doc:** `docs/SPRINT_2025_07_PLAN.md`

## Steps

1. **Parse arguments**: Extract the work item name (e.g. `W-000020`) and optional status from `$ARGUMENTS`.

2. **Look up the work item** in Agile Accelerator:
   ```
   sf data query --query "SELECT Id, Name, agf__Subject__c, agf__Status__c, agf__Story_Points__c, agf__Details__c FROM agf__ADM_Work__c WHERE Name = '<work-item-name>'" --target-org sprts-mng --json
   ```
   - If not found, report the error and stop.
   - Display the current status and subject.

3. **Update status** (using the provided status, or `Closed` if none given):
   ```
   sf data update record --sobject agf__ADM_Work__c --record-id <record-id> --values "agf__Status__c='<new-status>'" --target-org sprts-mng
   ```
   - Valid statuses: `New`, `In Progress`, `Ready for Review`, `Fixed`, `QA In Progress`, `Closed`, `Deferred`, `Duplicate`
   - Report the status change.

4. **Add implementation plan** (when moving to `In Progress` or `Closed`):
   - Read the sprint plan doc (`docs/SPRINT_2025_07_PLAN.md`)
   - Find the section for the work item (search for the `### W-XXXXXX:` heading)
   - Extract the implementation plan from the `<details>` block if present
   - If an implementation plan exists, update the story's Details field:
     ```
     sf data update record --sobject agf__ADM_Work__c --record-id <record-id> --values "agf__Details__c='<plan-text>'" --target-org sprts-mng
     ```
   - Note: The `agf__Details__c` field has limited CLI support for newlines. Convert the plan to a single-line summary if needed, or use the key points.

5. **Report results**:
   - Show the work item name, subject, old status → new status
   - Confirm if the implementation plan was added
   - If any step failed, report the error
