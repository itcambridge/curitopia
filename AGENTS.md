# Curitopia — Agent Instructions

## Mission
Curitopia helps people explore curiosity by asking more questions, suspending judgement, and making their thinking visible. The product has two modes: Quickfire and Focus.

Email and password authentication is implemented against the hosted Supabase project. The previous-explorations library is the signed-in home. Opening an exploration loads that saved workspace, and the user can leave and return to continue editing it. Questions can be hidden and restored. The central question and the last visible question stay visible. Rename and delete are not built yet.

Database changes, when requested, are new forward-only migrations applied through the hosted Supabase workflow. Do not edit applied migration files, and do not recreate `explorations` or `questions`.

AI-assisted reflection is implemented for one saved exploration. It does not require the exploration to be marked completed. The owner confirms before visible questions are sent to OpenAI, and the result is not stored. If the questions change afterwards, the result is marked as an earlier set. A saved exploration can also have an optional focus image. Generation sends only the prompt the person submits, and an upload is not sent to OpenAI. The hosted SQL for that image has not been applied. Cross-session profiling is specified in `docs/AI_BEHAVIOUR.md` and `docs/REFLECTION_SPEC.md` and is not implemented. A user-authored Experiment workspace is specified in `docs/EXPERIMENT_SPEC.md` and D-022. Phase 1 opens one experiment from a prioritised question. Phase 2 adds, edits, and deletes concepts, notes, hypotheses, tests, observations, and discoveries. Phase 3 adds one optional thumbnail on any experiment item. The SQL that allows it on every item type has not been applied. Item editing does not call a model. Thumbnail generation sends only the prompt the person submits. The hosted experiment SQL and the thumbnail SQL have not been applied. Do not add a concept map, cross-session profiling, or AI experiment suggestions until that work is explicitly requested. Curitopia Stories Phase 1 and Phase 2 are in the application at `/explorations/[id]/story`. Phase 2 creates artwork for one slide at a time after confirmation, using the OpenAI Image API. The draft and the artwork stay in the browser. Download saves one silent MP4 on the device. Do not add PDF, music, narration, or social publishing until that task is requested. D-025.

## First rule: inspect before changing
Before implementing a task, inspect the existing repository, `package.json`, routing structure, installed dependencies, current components, styling system, and existing interactions. Treat the current v0-generated interface as the baseline to preserve. The signed-in home is the library in `app/page.tsx`. The workspace is `components/exploration-screen.tsx`, opened at `/explorations/new` or `/explorations/[id]`. Do not replace working code or redesign the app just because another approach is familiar.

## Product principles
- Encourage quantity of questions, not a score for question quality.
- Quickfire protects uninterrupted flow: no mandatory categorisation, coaching prompts, or AI interventions while the user is entering questions. Background saving must not add a dialog after each question.
- Focus supports deliberate exploration of a central theme. Investigate, Reframe, Connect, and Challenge starters, if present, are optional.
- Neither mode requires the user to categorise every question.
- Reflection is available on a saved exploration. It does not interrupt Quickfire or Focus capture, and it does not require the exploration to be completed. The owner confirms before any question text is sent.
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
- The approved persistence stack is Supabase Auth and managed Supabase PostgreSQL, with the Next.js app intended to be served from Linode at `https://curitopia.com`. Email and password include confirmation and password reset. There is no social login. The local Supabase stack is for migration tests only. The signed-in home lists saved explorations. Hiding a question sets `is_hidden` and keeps the row. Do not add rename, delete, cross-session profiling, a concept map, or AI experiment suggestions until that task is requested. Phases 1 and 2 of the Experiment workspace are in the application, and Phase 3 adds an optional thumbnail on any experiment item. The first thumbnail SQL has been applied. The SQL that allows that thumbnail on every item type has not been applied.
- Future work stays one small, explicitly scoped task at a time. A documentation proposal is not permission to implement the next feature.
- Titles are at most 120 trimmed characters. Question text is at most 2,000 trimmed characters. Deleting an exploration is permanent after explicit confirmation. Hiding a question keeps the row: the central question and the last visible question cannot be hidden. Hidden questions are omitted from the normal map, list, and visible counts unless the user is viewing the hidden list.
- Test row-level security with pgTAP through `supabase test db`. Do not describe that security as fully verified until those tests, or an equivalent two-account check, have actually passed. Do not add a general-purpose frontend test framework unless a later decision approves one.
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
