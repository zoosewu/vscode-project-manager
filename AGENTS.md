# Project Manager Agents Instructions

Agents working in this repository should read the main instructions first: [Copilot Instructions](.github/copilot-instructions.md).

## Use this file for

- Finding the authoritative workflow for edits and validation.
- Keeping command, configuration, and localization changes consistent.
- Applying minimal, safe changes aligned with repository conventions.

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.

Format: `type(scope): description`

Allowed types:

- `feat` — new feature or capability
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `test` — adding or updating tests
- `build` — build system, packaging, or dependency changes
- `ci` — CI/CD workflow changes
- `docs` — documentation only
- `chore` — maintenance tasks that don't fit other types

Scope is optional. Use it when the change targets a specific area (e.g. `feat(sidebar)`, `fix(test)`).

## Typical agent tasks

- Update extension manifest contributions and related localization keys.
- Adjust source/configuration files and run repository validation commands.
- Verify build, lint, and Extension Development Host checks before finishing.
