---
name: plan-story
description: Query an Agile Accelerator work item, read the story details, and generate an implementation plan. Use when starting work on a new story.
disable-model-invocation: false
allowed-tools: Bash(sf data:*), Read, Grep, Glob, Agent, EnterPlanMode, ExitPlanMode
---

# Plan Story from Agile Accelerator

Queries a work item from Agile Accelerator, reads the story details, explores the codebase for context, and generates an implementation plan.

## Arguments

- `$ARGUMENTS` — work item name (e.g. `W-000025`). Optionally followed by a sprint plan doc path.

Examples:
- `/plan-story W-000025` — plan W-000025, auto-detect sprint plan doc
- `/plan-story W-000025 docs/sprints/SPRINT_2025_08_PLAN.md` — plan W-000025, write to specific doc

## Constants

- **Org alias:** `sprts-mng`

## Steps

1. **Parse arguments**: Extract the work item name (e.g. `W-000025`) and optional sprint plan doc path from `$ARGUMENTS`.

2. **Query the work item** from Agile Accelerator:
   ```
   sf data query --query "SELECT Id, Name, agf__Subject__c, agf__Status__c, agf__Story_Points__c, agf__Details__c, agf__Type__c, agf__Priority__c, agf__Epic__c, agf__Epic__r.Name, agf__Sprint__c, agf__Sprint__r.Name FROM agf__ADM_Work__c WHERE Name = '<work-item-name>'" --target-org sprts-mng --json
   ```
   - If not found, report the error and stop.
   - Display: Name, Subject, Status, Story Points, Sprint, Epic, and any existing Details.

3. **Identify the sprint plan doc**:
   - If a path was provided in arguments, use that.
   - Otherwise, find the latest sprint plan doc:
     ```
     ls docs/SPRINT_*_PLAN.md
     ```
   - If no sprint plan doc exists, note that one will need to be created.

4. **Read the sprint plan doc** (if it exists):
   - Look for the story's section (`### W-XXXXXX:` heading).
   - Extract any acceptance criteria, technical details, or implementation notes already written.
   - This provides additional context beyond what's in the Agile Accelerator Details field.

5. **Explore the codebase** for context:
   - Use the Agent tool with `subagent_type: Explore` to understand the current state of files and patterns relevant to the story.
   - Focus on:
     - Existing code that the story will modify or extend
     - Architecture patterns to follow (layered architecture, DI, interfaces)
     - Test patterns to replicate
     - Related components and their structure

6. **Enter plan mode** and generate the implementation plan:
   - Use `EnterPlanMode` to switch to planning mode.
   - The plan should include:
     - **Summary**: One-line description of what the story delivers
     - **Files to Create**: New files with purpose and key contents
     - **Files to Modify**: Existing files with specific changes
     - **Architecture Decisions**: Key patterns, interfaces, or design choices
     - **Testing Strategy**: What tests to write, mocking approach, coverage targets
     - **Verification Steps**: How to verify the implementation works
     - **Dependencies**: Other stories or components this depends on
     - **Risks/Considerations**: Anything to watch out for
   - Present the plan to the user for review and approval.

7. **Update the story status** to `In Progress`:
   ```
   sf data update record --sobject agf__ADM_Work__c --record-id <record-id> --values "agf__Status__c='In Progress'" --target-org sprts-mng
   ```

8. **Report results**:
   - Show the work item name, subject, and new status
   - Present the implementation plan
   - Ask the user if they want to proceed with implementation or adjust the plan
