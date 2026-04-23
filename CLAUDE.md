# CLAUDE.md

## Pre-Implementation Checklist

- Before starting any implementation, always review the requirement specifications under `/specs/`.
- In particular, check `specs/11-implementation-task-list-ai-chunks.md` to understand task dependencies and ensure implementation proceeds in the correct order.

## Coding Rules

- When writing code, always follow the skill defined in `.claude/skills/coding-rules.md/SKILL.md`.
- When creating UI, always refer to `/design.md`.

## Testing

- When implementing important features (domain logic, API endpoints, state transitions, authentication), always add corresponding tests (unit/integration/e2e as appropriate).

## Commit & Push

- **Commit and push frequently during implementation.** Do not accumulate large uncommitted changes.
- Commit at every meaningful unit of progress (e.g., after completing a function, passing tests, finishing a component).
- Push to the remote branch regularly to avoid losing work.

## Pull Request

- After completing each implementation Step (as defined in `specs/11-implementation-task-list-ai-chunks.md`), **verify that all completion criteria are met before creating a PR**.
- Do not create a PR until the completion conditions are fully satisfied.
- Include the completion criteria checklist in the PR body.

## Branch Strategy

- **Never develop directly on the main branch.**
- Before starting work on a new feature, always execute the `/create-branch` skill to create a new branch from the latest `main` following the defined branch workflow.