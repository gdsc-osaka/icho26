---
name: create-branch
description: Create a new Git branch for this project safely. Use when starting a new feature/fix/task so work never proceeds on main and branch flow matches specs.
user-invocable: true
allowed-tools: Bash
---

# Create Branch

Manages branch creation for new feature development. This project must keep `main` deployable and avoid direct development on `main`.

## Instructions

When starting new feature development or any new unit of work:

1. **Check current branch**: Verify which branch you are currently on.
   ```bash
   git branch --show-current
   ```

2. **CRITICAL — Never develop on main**: If the current branch is `main`, you **must** create a new branch before writing any code.

3. **Check working tree state**: If there are local changes, decide one of the following before branching:
   - Continue this exact task on current feature branch (do not branch again), or
   - Commit the in-scope changes, then branch for a new task.

   Validate state:
   ```bash
   git status
   ```

4. **Sync `main` and create branch**: Create and switch to a new branch from latest remote `main`.
   ```bash
   git switch main
   git pull --ff-only origin main
   git switch -c <prefix>/<branch-name>
   ```

5. **Branch naming convention**: Use the following prefixes followed by a short, descriptive kebab-case name:

   | Prefix   | Usage                                |
   |----------|--------------------------------------|
   | `feat/`  | New feature                          |
   | `fix/`   | Bug fix                              |
   | `debug/` | Debugging or investigation           |
   | `chore/` | Maintenance, config, or dependencies |

   **Examples**:
   - `feat/implement-authentication-logic`
   - `fix/resolve-login-redirect-error`
   - `debug/investigate-api-timeout`
   - `chore/update-eslint-config`

6. **Rules**:
   - Branch names must be lowercase and use hyphens as separators
   - Branch names should clearly describe the scope of work
   - One branch per feature or task — do not mix unrelated changes
   - Always branch off from the latest `main`
   - Prefer PR + squash merge into `main`
   - Do not run infrastructure `apply` automatically from branch CI

7. **When NOT to create a new branch**:
   - When continuing work on an existing feature branch
   - When making a quick amendment to the current branch's work