# Curitopia — Documentation Index

## Contents

- `AGENTS.md` — repository-level coding-agent instructions.
- `.cursor/rules/curitopia.mdc` — persistent Cursor instructions for the product and architecture.
- `docs/PRODUCT_BRIEF.md` — product purpose, principles, and boundaries.
- `docs/UX_SPEC.md` — user flows, authentication, session lifecycle, hiding, and the exploration library.
- `docs/DESIGN_SYSTEM.md` — visual design principles.
- `docs/MVP_SPEC.md` — historical prototype baseline and acceptance criteria for persistence.
- `docs/ARCHITECTURE.md` — Next.js application, Supabase Auth, hosted PostgreSQL, and the intended Linode deployment.
- `docs/DATA_MODEL.md` — question and exploration model, including `is_hidden`.
- `docs/QUESTION_MAP_SPEC.md` — orbital visualisation, drawn from visible questions.
- `docs/AI_BEHAVIOUR.md` — reflection behaviour for one saved exploration, plus the boundary around later AI.
- `docs/REFLECTION_SPEC.md` — reflection experience. The single-exploration slice is implemented. The wider pattern proposal is not authorisation to build it.
- `docs/EXPERIMENT_SPEC.md` — user-authored Experiment workspace. Phase 1 is in the application. Hosted SQL is not applied. Item editing, thumbnails, and AI are later.
- `docs/TEST_STRATEGY.md` — type checking, production builds, database checks, and what has actually been verified.
- `docs/DECISIONS.md` — architectural decisions, including superseded and proposed entries.

## Current application

- Framework: Next.js App Router, React, and TypeScript. Package manager: pnpm. Source control: GitHub.
- Email and password authentication uses the hosted Supabase project. There is no social login.
- The signed-in home is the previous-explorations library. Each saved exploration opens at `/explorations/[id]`. `/explorations/new` stays empty until the first question is saved.
- Quickfire and Focus, optional Focus perspective origins, the SVG question map, review, and question prioritisation are implemented.
- An exploration stays editable after the user leaves it, including a row whose `status` is `completed`. Navigating away does not complete or lock it.
- Questions can be hidden and restored with `is_hidden`. Hidden questions stay stored and leave the normal map, list, and visible counts. The central question and the last visible question cannot be hidden.
- Saving reports Saving, Saved, or Could not save. A rejected hide puts the question back to the stored visible state.
- Rename and delete are specified and not built.
- AI reflection on one saved exploration is implemented. It does not require completion. It sends visible questions to OpenAI only after confirmation and does not store the result. Cross-session patterns are still proposed. Phases 1 and 2 of the Experiment workspace open one experiment and let the owner add, edit, and delete items. They do not call a model. The hosted experiment SQL has not been applied. Thumbnails, a concept map, and AI suggestions are not built.

The earlier in-memory prototype is history, recorded as D-005. Do not describe the running workspace as memory-only.

## Verification

See `docs/TEST_STRATEGY.md` for the full list. In short:

- TypeScript checking and the production build passed in the hide-and-restore implementation. That does not prove database behaviour.
- Hosted schema metadata checks for hiding were reported as passing. They do not hide a row and do not use two accounts.
- End-to-end hide and restore against the hosted database, and cross-account isolation, have not been confirmed.
- pgTAP files exist and have not been run. Do not describe security as fully verified.
- Linode deployment is the intended production host and is not confirmed complete. An email-confirmation redirect issue on localhost was left for the production domain.

## Database

- The hosted Supabase project is the production database.
- `public.explorations` and `public.questions` were created through the hosted SQL Editor from `supabase/migrations/20261011162400_create_explorations.sql`.
- `is_hidden`, the central-question check, and the last-visible trigger were added from `supabase/migrations/20261013191000_add_question_hidden.sql`. The pasteable copy is `supabase/scripts/add_question_hidden.sql`.
- This repository has not run `supabase db push`. Do not assume the hosted migration-history table matches these files until that is checked.
- Further database changes use a new forward-only migration and a reviewed SQL Editor script. Do not edit applied migrations, and do not recreate existing tables.
- Do not start a local Supabase instance or require Docker unless that is explicitly requested.
- Never expose database passwords, access tokens, or service-role keys.

## Approved architecture

Documented in `docs/DECISIONS.md`, D-007 through D-016. D-019 approves reflection of one saved exploration, and D-020 keeps that exploration editable. D-017 and D-018 still propose the wider reflection behaviour and do not approve cross-session profiling. D-022 agrees the Experiment product direction and does not approve implementation.

- Application: Next.js, React, and TypeScript.
- Intended production host: Linode at `https://curitopia.com`.
- Database and authentication: the existing hosted Supabase project.
- Source control: GitHub.

The production server, DNS, and domain deployment are not confirmed complete. Review the Supabase site URL and redirect allow list before production launch. Do not change them as part of an unrelated task.

## How to continue

Work in small, explicitly scoped tasks. One task does not include the next feature.

Before editing, read `AGENTS.md`, `.cursor/rules/curitopia.mdc`, and the relevant files in `docs/`. Inspect the current code. Do not add dependencies, apply migrations, or modify remote settings during an audit.

Remaining product work, in an order that keeps each step reviewable:

1. Confirm ownership with runtime tests, including hide and restore, before treating security as verified.
2. Rename and confirmed deletion, when that task is requested.
3. Phase 3 of the Experiment workspace: concept thumbnails, after the image limits are measured. Phases 1 and 2 are already in the application. AI suggestions are not part of phase 3.
4. Cross-session curiosity patterns, only after that proposal is approved as its own task.
