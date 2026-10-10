# Curitopia — Agent Instructions

## Mission
Curitopia helps people explore curiosity by asking more questions, suspending judgement, and making their thinking visible. The initial product has two modes: Quickfire and Focus.

## First rule: inspect before changing
Before implementing a task, inspect the existing repository, `package.json`, routing structure, installed dependencies, current components, styling system, and existing interactions. Treat the current v0-generated interface as the baseline to preserve. Do not replace working code or redesign the app just because another approach is familiar.

## Product principles
- Encourage quantity of questions, not a score for question quality.
- Quickfire protects uninterrupted flow: no mandatory categorisation, coaching prompts, or AI interventions while the user is entering questions.
- Focus supports deliberate exploration of a central theme; prompts, if present, are optional.
- Reflection happens after a Quickfire session, not in the middle of the stream.
- The question map is a live visualisation of data, not a static image.
- Do not claim the app diagnoses, treats, or reliably relieves stress or mental-health conditions.
- Keep the initial release small. Do not add features unless the user explicitly requests them.

## Working process
1. Read the relevant files in `docs/` and the applicable `.cursor/rules/` rules before coding.
2. For each task, summarise the intended change and identify affected components.
3. Implement one small, coherent increment.
4. Run available lint, type-check, tests, and build commands. If a command is unavailable, say so; do not claim it passed.
5. Report files changed, checks run and results, and any known limitations.
6. Update docs when an approved product or technical decision changes.

## Technical guardrails
- Preserve the current framework, package manager, UI library and conventions unless a change is explicitly approved.
- Do not migrate frameworks or replace dependencies as part of a feature task.
- Use the existing package manager and lockfile. The repository currently appears to use pnpm; verify this in `package.json` and lockfiles.
- Prefer small, typed React components and clear separation between UI, state and layout calculations.
- The orbital map must be rendered from question data (e.g. SVG), not generated as a bitmap.
- Keep layout calculations deterministic for existing questions so the map does not jump unpredictably on every render.
- Handle long text, small screens, large question counts, empty states and reduced-motion preferences.
- Do not introduce a backend, database, authentication, analytics, or AI API in the initial prototype without explicit approval.
- Never commit secrets, API keys, personal data or `.env` files.

## Definition of done
A change is complete only when:
- It meets the relevant acceptance criteria.
- Existing behaviour is preserved unless a change was requested.
- The UI is usable at desktop and mobile widths.
- Inputs and visible controls work.
- Relevant automated checks have been run and their actual results reported.
