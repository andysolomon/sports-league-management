# Agile Accelerator CLI Guide

A practical reference for engineers and LLM-based agents to manage Agile Accelerator work items, epics, and sprints using the Salesforce CLI (`sf`). All operations target the org where the Agile Accelerator managed package (`agf__`) is installed.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Object Model](#object-model)
3. [Org Authentication](#org-authentication)
4. [Querying Records](#querying-records)
5. [Creating Records](#creating-records)
6. [Updating Records](#updating-records)
7. [Deleting Records](#deleting-records)
8. [Common Workflows](#common-workflows)
9. [Field Reference](#field-reference)
10. [Conventions for This Project](#conventions-for-this-project)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Salesforce CLI installed (`sf --version`)
- Authenticated to the org with Agile Accelerator installed
- The Agile Accelerator managed package uses the namespace prefix `agf__`

## Object Model

Agile Accelerator uses these core managed objects:

```
agf__ADM_Scrum_Team__c          (Scrum Team)
    │
agf__ADM_Sprint__c              (Sprint — belongs to a Scrum Team)
    │
agf__ADM_Epic__c                (Epic — belongs to a Team)
    │
agf__ADM_Work__c                (Work Item — story/bug/todo, linked to Sprint, Epic, Team)
    │
agf__ADM_Product_Tag__c         (Product Tag — categorizes work items)
```

**Relationships on Work Items (`agf__ADM_Work__c`):**

| Field | Lookup To | Purpose |
|---|---|---|
| `agf__Sprint__c` | `agf__ADM_Sprint__c` | Which sprint the item belongs to |
| `agf__Epic__c` | `agf__ADM_Epic__c` | Which epic the item belongs to |
| `agf__Scrum_Team__c` | `agf__ADM_Scrum_Team__c` | Which team owns the item |
| `agf__Product_Tag__c` | `agf__ADM_Product_Tag__c` | Product area categorization |

## Org Authentication

Check which orgs you are authenticated to:

```bash
sf org list
```

If you need to authenticate to the org with Agile Accelerator:

```bash
sf org login web --alias my-org-alias
```

All commands in this guide use `--target-org <alias>` to specify the org. Replace `<alias>` with your org alias (e.g., `sprts-mng`).

## Querying Records

The `sf data query` command runs SOQL queries against the org. Use `--json` for machine-readable output.

### List All Work Items

```bash
sf data query \
  --query "SELECT Id, Name, agf__Subject__c, agf__Status__c, RecordType.Name, agf__Story_Points__c FROM agf__ADM_Work__c ORDER BY Name ASC" \
  --target-org <alias>
```

### Get a Specific Work Item by Name

```bash
sf data query \
  --query "SELECT Id, Name, agf__Subject__c, agf__Status__c, agf__Type__c, agf__Story_Points__c, agf__Epic__c, agf__Sprint__c, agf__Details__c FROM agf__ADM_Work__c WHERE Name = 'W-000016'" \
  --target-org <alias>
```

### Get Work Items in a Sprint

```bash
sf data query \
  --query "SELECT Id, Name, agf__Subject__c, agf__Status__c, agf__Story_Points__c FROM agf__ADM_Work__c WHERE agf__Sprint__c = '<sprint-id>' ORDER BY Name ASC" \
  --target-org <alias>
```

### Get Work Items by Status

```bash
sf data query \
  --query "SELECT Id, Name, agf__Subject__c, agf__Status__c FROM agf__ADM_Work__c WHERE agf__Status__c = 'In Progress'" \
  --target-org <alias>
```

### List All Epics

```bash
sf data query \
  --query "SELECT Id, Name, agf__Team__c, agf__Description__c FROM agf__ADM_Epic__c ORDER BY Name ASC" \
  --target-org <alias>
```

### List All Sprints

```bash
sf data query \
  --query "SELECT Id, Name, agf__Start_Date__c, agf__End_Date__c, agf__Scrum_Team__c FROM agf__ADM_Sprint__c ORDER BY Name ASC" \
  --target-org <alias>
```

### List Scrum Teams

```bash
sf data query \
  --query "SELECT Id, Name FROM agf__ADM_Scrum_Team__c" \
  --target-org <alias>
```

### List Product Tags

```bash
sf data query \
  --query "SELECT Id, Name FROM agf__ADM_Product_Tag__c" \
  --target-org <alias>
```

### JSON Output for Scripting

Append `--json` to any query for structured output. Useful for LLM agents and scripts:

```bash
sf data query \
  --query "SELECT Id, Name, agf__Subject__c FROM agf__ADM_Work__c WHERE Name = 'W-000016'" \
  --target-org <alias> \
  --json
```

The result is in `result.records[]` with each record containing the queried fields.

## Creating Records

Use `sf data create record` to insert new records. The `--values` flag takes a space-separated list of `Field=Value` pairs.

### Create a Sprint

```bash
sf data create record \
  --sobject agf__ADM_Sprint__c \
  --values "Name='2025.07 - Sports League Development Team' agf__Scrum_Team__c='<team-id>' agf__Start_Date__c='2026-03-17' agf__End_Date__c='2026-03-28'" \
  --target-org <alias>
```

Returns: `Successfully created record: <new-record-id>.`

### Create an Epic

```bash
sf data create record \
  --sobject agf__ADM_Epic__c \
  --values "Name='Season and Player Management' agf__Team__c='<team-id>'" \
  --target-org <alias>
```

### Create a Work Item (User Story)

Work items use **Record Types** to distinguish between stories, bugs, etc. The Record Type ID for "User Story" must be included.

First, find the Record Type ID:

```bash
sf data query \
  --query "SELECT Id, Name FROM RecordType WHERE SobjectType = 'agf__ADM_Work__c' AND Name = 'User Story'" \
  --target-org <alias>
```

Then create the work item:

```bash
sf data create record \
  --sobject agf__ADM_Work__c \
  --values "RecordTypeId='<record-type-id>' agf__Subject__c='[Season Management] Create Season Service' agf__Status__c='New' agf__Story_Points__c=8 agf__Sprint__c='<sprint-id>' agf__Epic__c='<epic-id>' agf__Scrum_Team__c='<team-id>' agf__Product_Tag__c='<tag-id>'" \
  --target-org <alias>
```

### Create a Work Item (Bug)

Same pattern, different Record Type:

```bash
sf data query \
  --query "SELECT Id, Name FROM RecordType WHERE SobjectType = 'agf__ADM_Work__c' AND Name = 'Bug'" \
  --target-org <alias>
```

```bash
sf data create record \
  --sobject agf__ADM_Work__c \
  --values "RecordTypeId='<bug-record-type-id>' agf__Subject__c='Fix login redirect issue' agf__Status__c='New' agf__Scrum_Team__c='<team-id>'" \
  --target-org <alias>
```

### Adding a Description to a Work Item

The `agf__Details__c` field holds the description. For multi-line content, use the Salesforce REST API or update after creation (the CLI `--values` flag does not handle newlines well in all cases):

```bash
sf data update record \
  --sobject agf__ADM_Work__c \
  --record-id <work-item-id> \
  --values "agf__Details__c='As a league administrator...'" \
  --target-org <alias>
```

## Updating Records

Use `sf data update record` with `--record-id` and `--values`.

### Change Work Item Status

```bash
sf data update record \
  --sobject agf__ADM_Work__c \
  --record-id <record-id> \
  --values "agf__Status__c='In Progress'" \
  --target-org <alias>
```

### Update Story Points

```bash
sf data update record \
  --sobject agf__ADM_Work__c \
  --record-id <record-id> \
  --values "agf__Story_Points__c=5" \
  --target-org <alias>
```

### Move a Work Item to a Different Sprint

```bash
sf data update record \
  --sobject agf__ADM_Work__c \
  --record-id <record-id> \
  --values "agf__Sprint__c='<new-sprint-id>'" \
  --target-org <alias>
```

### Assign a Work Item to an Epic

```bash
sf data update record \
  --sobject agf__ADM_Work__c \
  --record-id <record-id> \
  --values "agf__Epic__c='<epic-id>'" \
  --target-org <alias>
```

### Link a Git Branch to a Work Item

```bash
sf data update record \
  --sobject agf__ADM_Work__c \
  --record-id <record-id> \
  --values "agf__Branch__c='feat/W-000017'" \
  --target-org <alias>
```

## Deleting Records

Use `sf data delete record`. Be cautious — this is permanent.

```bash
sf data delete record \
  --sobject agf__ADM_Work__c \
  --record-id <record-id> \
  --target-org <alias>
```

## Common Workflows

### Workflow 1: Create a Full Sprint with Stories

```bash
ORG=sprts-mng
TEAM_ID=a0ubm000000YFhNAAW
TAG_ID=a0fbm000001YItBAAW
RT_STORY=012bm000004E0uHAAS

# 1. Create the sprint
sf data create record --sobject agf__ADM_Sprint__c \
  --values "Name='2025.07 - Sports League Development Team' agf__Scrum_Team__c='$TEAM_ID' agf__Start_Date__c='2026-03-17' agf__End_Date__c='2026-03-28'" \
  --target-org $ORG --json

# Capture the sprint ID from the output, then:
SPRINT_ID=<id-from-output>

# 2. Create the epic
sf data create record --sobject agf__ADM_Epic__c \
  --values "Name='Season and Player Management' agf__Team__c='$TEAM_ID'" \
  --target-org $ORG --json

# Capture the epic ID from the output, then:
EPIC_ID=<id-from-output>

# 3. Create work items
sf data create record --sobject agf__ADM_Work__c \
  --values "RecordTypeId='$RT_STORY' agf__Subject__c='[Season Management] Create Season Object and Service' agf__Status__c='New' agf__Story_Points__c=8 agf__Sprint__c='$SPRINT_ID' agf__Epic__c='$EPIC_ID' agf__Scrum_Team__c='$TEAM_ID' agf__Product_Tag__c='$TAG_ID'" \
  --target-org $ORG
```

### Workflow 2: Move a Story Through Its Lifecycle

```bash
RECORD_ID=a1Mbm000004PzvdEAC
ORG=sprts-mng

# Start working on it
sf data update record --sobject agf__ADM_Work__c \
  --record-id $RECORD_ID \
  --values "agf__Status__c='In Progress'" \
  --target-org $ORG

# Mark as ready for review
sf data update record --sobject agf__ADM_Work__c \
  --record-id $RECORD_ID \
  --values "agf__Status__c='Ready for Review'" \
  --target-org $ORG

# Close it
sf data update record --sobject agf__ADM_Work__c \
  --record-id $RECORD_ID \
  --values "agf__Status__c='Closed'" \
  --target-org $ORG
```

### Workflow 3: Sprint Review — Check Completion

```bash
# Get sprint summary
sf data query \
  --query "SELECT agf__Status__c, COUNT(Id) total FROM agf__ADM_Work__c WHERE agf__Sprint__c = '<sprint-id>' GROUP BY agf__Status__c" \
  --target-org <alias>

# List incomplete items
sf data query \
  --query "SELECT Name, agf__Subject__c, agf__Status__c FROM agf__ADM_Work__c WHERE agf__Sprint__c = '<sprint-id>' AND agf__Status__c != 'Closed' ORDER BY Name" \
  --target-org <alias>
```

### Workflow 4: Discover Schema (for LLM Agents)

When an agent needs to understand available fields or picklist values:

```bash
# Describe the object schema
sf sobject describe --sobject agf__ADM_Work__c --target-org <alias> --json

# Parse with Python to extract createable fields
sf sobject describe --sobject agf__ADM_Work__c --target-org <alias> | python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data['fields']:
    if f.get('createable') and f['name'].startswith('agf__'):
        print(f'{f[\"name\"]:45s} {f[\"label\"]:30s} {f[\"type\"]}')
"

# Extract picklist values for a specific field
sf sobject describe --sobject agf__ADM_Work__c --target-org <alias> | python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data['fields']:
    if f['name'] == 'agf__Status__c':
        for pv in f.get('picklistValues', []):
            if pv.get('active'):
                print(pv['value'])
"
```

## Field Reference

### Work Item (`agf__ADM_Work__c`) — Key Fields

| Field API Name | Label | Type | Notes |
|---|---|---|---|
| `Name` | Work ID | Auto-Number | e.g. W-000016 (read-only) |
| `RecordTypeId` | Record Type | Reference | User Story, Bug, Investigation, ToDo |
| `agf__Subject__c` | Subject | Text | Title of the work item |
| `agf__Status__c` | Status | Picklist | See status values below |
| `agf__Story_Points__c` | Story Points | Number | Estimation |
| `agf__Details__c` | Description | Textarea | Full description / acceptance criteria |
| `agf__Sprint__c` | Sprint | Lookup | Link to Sprint record |
| `agf__Epic__c` | Epic | Lookup | Link to Epic record |
| `agf__Scrum_Team__c` | Team | Lookup | Link to Scrum Team |
| `agf__Product_Tag__c` | Product Tag | Lookup | Product area |
| `agf__Priority__c` | Priority | Picklist | P0-P4 |
| `agf__Branch__c` | Branch | Text | Git branch name |
| `agf__Assignee__c` | Assigned To | Lookup(User) | Developer assigned |
| `agf__Due_Date__c` | Due Date | DateTime | Target completion |

### Work Item Record Types

| Record Type ID | Name | Use For |
|---|---|---|
| `012bm000004E0uHAAS` | User Story | Features, enhancements |
| `012bm000004E0uDAAS` | Bug | Defects |
| `012bm000004E0uEAAS` | Investigation | Research, spikes |
| `012bm000004E0uGAAS` | ToDo | Tasks, chores |

### Work Item Status Values (Common)

| Status | Meaning |
|---|---|
| `New` | Created, not started |
| `In Progress` | Actively being worked on |
| `Ready for Review` | Code complete, awaiting review |
| `Fixed` | Fix applied |
| `QA In Progress` | Being tested |
| `Closed` | Done |
| `Deferred` | Postponed |
| `Duplicate` | Duplicate of another item |

### Sprint (`agf__ADM_Sprint__c`) — Key Fields

| Field API Name | Label | Type |
|---|---|---|
| `Name` | Sprint Name | Text |
| `agf__Scrum_Team__c` | Scrum Team | Lookup |
| `agf__Start_Date__c` | Start Date | Date |
| `agf__End_Date__c` | End Date | Date |
| `agf__Goals__c` | Goals | Textarea |

### Epic (`agf__ADM_Epic__c`) — Key Fields

| Field API Name | Label | Type |
|---|---|---|
| `Name` | Epic Name | Text |
| `agf__Team__c` | Team | Lookup |
| `agf__Description__c` | Description | Textarea |
| `agf__Start_Date__c` | Start Date | Date |
| `agf__End_Date__c` | End Date | Date |

## Conventions for This Project

### Org Alias

The Agile Accelerator org uses the alias `sprts-mng`.

### IDs Reference (Current)

| Object | Name | ID |
|---|---|---|
| Scrum Team | Sports League Development Team | `a0ubm000000YFhNAAW` |
| Product Tag | Core Framework | `a0fbm000001YItBAAW` |
| Product Tag | Infrastructure | `a0fbm0000014rYDAAY` |
| Record Type | User Story | `012bm000004E0uHAAS` |
| Record Type | Bug | `012bm000004E0uDAAS` |

### Naming Conventions

- **Sprints:** `YYYY.MM - Sports League Development Team`
- **Work Items:** Auto-numbered `W-XXXXXX`, subject prefixed with epic area: `[Season Management] ...`
- **Branches:** `feat/W-XXXXXX` matching the work item name
- **Commits:** `feat(W-XXXXXX): description`

### Story Lifecycle Mapping

```
New ──> In Progress ──> Ready for Review ──> Closed
                │                               │
                └── (if blocked) ──> Waiting ───┘
```

Typical development flow for a story:

1. **New** — Story created in backlog
2. **In Progress** — Developer creates branch `feat/W-XXXXXX` and starts coding
3. **Ready for Review** — PR created, code deployed and tested
4. **Closed** — PR merged, work item updated

## Troubleshooting

### "Insufficient access rights on cross-reference id"
The lookup ID you provided doesn't exist or you don't have access. Verify the ID:

```bash
sf data query --query "SELECT Id, Name FROM agf__ADM_Sprint__c WHERE Id = '<id>'" --target-org <alias>
```

### "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST"
The picklist value you used isn't valid. Check allowed values:

```bash
sf sobject describe --sobject agf__ADM_Work__c --target-org <alias> --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data['fields']:
    if f['name'] == 'agf__Status__c':
        for pv in f.get('picklistValues', []):
            if pv.get('active'): print(pv['value'])
"
```

### "REQUIRED_FIELD_MISSING"
A required field was not provided. Describe the object to find required fields:

```bash
sf sobject describe --sobject agf__ADM_Work__c --target-org <alias> --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data['fields']:
    if not f.get('nillable') and f.get('createable') and not f.get('defaultedOnCreate'):
        print(f'{f[\"name\"]:40s} {f[\"label\"]}')
"
```

### Record Type Not Found
Record Type IDs are org-specific. Always query them dynamically rather than hardcoding:

```bash
sf data query \
  --query "SELECT Id, Name FROM RecordType WHERE SobjectType = 'agf__ADM_Work__c' AND IsActive = true" \
  --target-org <alias>
```
