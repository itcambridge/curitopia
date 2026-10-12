# Curitopia — Agent Instructions

## Mission
Curitopia helps people explore curiosity by asking more questions, suspending judgement, and making their thinking visible. The product has two modes: Quickfire and Focus.

The running exploration is still an in-memory prototype. Email and password authentication is implemented against the hosted Supabase project. The approved database schema and row-level security migration are in `supabase/migrations`. Do not connect explorations or questions to that database, and do not apply a further migration to a remote project, until the user asks for that work.

AI-assisted reflection stays a later phase after persistence. See `docs/AI_BEHAVIOUR.md`.

## First rule: inspect before changing
Before implementing a task, inspect the existing repository, `package.json`, routing structure, installed dependencies, current components, styling system, and existing interactions. Treat the current v0-generated interface as the baseline to preserve. The live screen is `app/page.tsx`. Do not replace working code or redesign the app just because another approach is familiar.

## Product principles
- Encourage quantity of questions, not a score for question quality.
- Quickfire protects uninterrupted flow: no mandatory categorisation, coaching prompts, or AI interventions while the user is entering questions. Background saving must not add a dialog after each question.
- Focus supports deliberate exploration of a central theme. Investigate, Reframe, Connect, and Challenge starters, if present, are optional.
- Neither mode requires the user to categorise every question.
- Reflection happens after a Quickfire session, not in the middle of the stream.
- The question map is a live visualisation of data, not a static image. Derive node colour from the stable question id. Do not store colour.
- Persistent explorations require a signed-in user with a confirmed email. Create the database row when the first question is saved. Leave empty explorations out of the library.
- Ownership is enforced with row-level security, not only in the interface.
- Do not claim the app diagnoses, treats, or reliably relieves stress or mental-health conditions.
- Keep the current phase small. Do not add features unless the user explicitly requests them.

## Working process
1. Read the relevant files in `docs/` and `.cursor/rules/curitopia.mdc` before coding.
2. For each task, summarise the intended change and identify affected components.
3. Implement one small, coherent increment.
4. Run available lint, type-check, tests, and build commands. If a command is unavailable, say so; do not claim it passed. `pnpm build` validates types and `pnpm typecheck` stays available. Do not set `typescript.ignoreBuildErrors`.
5. Report files changed, checks run and results, and any known limitations.
6. Update docs when an approved product or technical decision changes. Leave superseded decision entries in `docs/DECISIONS.md`.

## Technical guardrails
- Preserve the current framework, package manager, UI library, and conventions unless a change is explicitly approved.
- Do not migrate frameworks or replace dependencies as part of a feature task.
- Use pnpm and the existing lockfile. `package.json` sets `packageManager` to pnpm 12.3.4.
- Prefer small, typed React components and clear separation between UI, state, and layout calculations.
- The orbital map must be rendered from question data (SVG), not generated as a bitmap.
- Keep layout calculations deterministic for existing questions so the map does not jump unpredictably on every render.
- Handle long text, small screens, large question counts, empty states, and reduced-motion preferences.
- The approved persistence stack is Supabase Auth and managed Supabase PostgreSQL, with the Next.js app served from Linode at `https://curitopia.com`. Email and password include confirmation and password reset. There is no social login. The local Supabase stack is for migration tests only. Authentication screens are in place. Do not add database-backed explorations until that task is requested. Do not add an AI API.
- Titles are at most 120 trimmed characters. Question text is at most 2,000 trimmed characters. Deletion is permanent after explicit confirmation.
- Test row-level security with pgTAP through `supabase test db`. Do not add a general-purpose frontend test framework unless a later decision approves one.
- Never send question text, titles, emails, or other exploration content to analytics. The prototype still mounts Vercel Analytics. Do not remove or replace it until open item 8 under D-015 is decided.
- Keep the `typecheck` script. Do not set `typescript.ignoreBuildErrors`.
- Never commit secrets, API keys, personal data, or filled `.env` files.

## Definition of done
A change is complete only when:
- It meets the relevant acceptance criteria.
- Existing behaviour is preserved unless a change was requested.
- The UI is usable at desktop and mobile widths.
- Inputs and visible controls work.
- Relevant automated checks have been run and their actual results reported.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
