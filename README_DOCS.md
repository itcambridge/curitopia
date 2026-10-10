# Curitopia Cursor Documentation Pack

## Contents
- `AGENTS.md` — repository-level coding-agent instructions.
- `.cursor/rules/curitopia.mdc` — always-applied Cursor rule.
- `docs/PRODUCT_BRIEF.md` — product purpose and boundaries.
- `docs/UX_SPEC.md` — user flows and interface behaviour.
- `docs/DESIGN_SYSTEM.md` — visual design principles.
- `docs/MVP_SPEC.md` — scope and acceptance criteria.
- `docs/ARCHITECTURE.md` — technical boundaries and component guidance.
- `docs/DATA_MODEL.md` — suggested in-memory data model.
- `docs/QUESTION_MAP_SPEC.md` — orbital visualisation behaviour.
- `docs/AI_BEHAVIOUR.md` — explicit decision to defer AI.
- `docs/TEST_STRATEGY.md` — verification plan.
- `docs/DECISIONS.md` — agreed decisions.

## Install
Extract the pack into the root of the existing Curitopia repository. Merge the `docs` and `.cursor` folders with existing folders; do not overwrite application source files.

## First prompt to Cursor
Paste this into Cursor Agent:

“Before editing code, inspect the current Curitopia repository and read `AGENTS.md`, `.cursor/rules/curitopia.mdc`, and the relevant documents in `docs/`. Do not implement features yet. Report: (1) the current framework and package manager confirmed from the files, (2) the existing app routes and main components, (3) which MVP requirements are already implemented, partially implemented or missing, (4) any conflicts between the current code and the docs, and (5) the smallest ordered implementation plan. Do not add dependencies or change files during this audit.”

After reviewing the audit, ask Cursor to implement one small task at a time, starting with the highest-priority usability issue.
