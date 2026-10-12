# \# Curitopia — Cursor Documentation Index

# 

# \## Contents

# 

# \- `AGENTS.md` — repository-level coding-agent instructions.

# \- `.cursor/rules/curitopia.mdc` — persistent Cursor instructions for the product and architecture.

# \- `docs/PRODUCT\\\_BRIEF.md` — product purpose, principles and boundaries.

# \- `docs/UX\\\_SPEC.md` — user flows, authentication, session lifecycle and exploration library requirements.

# \- `docs/DESIGN\\\_SYSTEM.md` — visual design principles.

# \- `docs/MVP\\\_SPEC.md` — current baseline and acceptance criteria for persistence.

# \- `docs/ARCHITECTURE.md` — Next.js application, Supabase Auth, hosted PostgreSQL and intended Linode deployment.

# \- `docs/DATA\\\_MODEL.md` — question/session data model and approved relational schema.

# \- `docs/QUESTION\\\_MAP\\\_SPEC.md` — orbital visualisation behaviour.

# \- `docs/AI\\\_BEHAVIOUR.md` — AI remains deferred until persistence and session reflection are established.

# \- `docs/TEST\\\_STRATEGY.md` — type checking, production builds, database security and manual verification.

# \- `docs/DECISIONS.md` — architectural decisions, including superseded decisions.

# 

# \## Current project status

# 

# \### Application

# 

# \- Framework: Next.js App Router, React and TypeScript.

# \- Package manager: pnpm.

# \- Source control: GitHub.

# \- Existing functionality includes Quickfire, Focus, perspective prompts, question mapping, session review and question prioritisation.

# \- Email/password authentication has been implemented using Supabase Auth.

# \- Local sign-in has succeeded after configuring the local environment.

# \- An email-confirmation redirect issue occurred during localhost testing. Further diagnosis is intentionally deferred until the application is deployed to its production domain.

# \- Explorations and questions are still held in application memory. They are not yet saved to the database.

# 

# \### Database

# 

# \- The hosted Supabase project is the intended production database.

# \- The `explorations` and `questions` tables have been created through the hosted Supabase SQL Editor.

# \- Row Level Security policies and relevant constraints and triggers have been created.

# \- The function `public.create\\\_exploration\\\_with\\\_first\\\_question` has been created and its existence and execution permissions have been checked.

# \- Runtime tests proving isolation between different authenticated users have not yet been completed.

# \- The application has not yet been connected to persistent exploration storage.

# 

# \*\*Important:\*\* Parts of the database schema were created manually through the hosted Supabase SQL Editor. Before making further schema changes, inspect the live schema and the tracked migration files to avoid recreating existing objects or creating migration-history inconsistencies.

# 

# \## Approved architecture and deployment

# 

# The approved architecture is documented in `docs/DECISIONS.md`, including D-007 and the subsequent decisions through D-015.

# 

# \- Application: Next.js, React and TypeScript.

# \- Production host: Linode.

# \- Intended production domain: `https://curitopia.com`.

# \- Database and authentication: the existing hosted Supabase project.

# \- Source control: GitHub.

# \- AI analysis and experimentation: later development phases.

# 

# The production server, DNS and domain deployment are not yet confirmed as complete.

# 

# The current Supabase URL configuration and email-confirmation redirects should be reviewed before production launch. Do not change them as part of unrelated implementation tasks.

# 

# \## Database workflow

# 

# Use the hosted Supabase Dashboard and SQL Editor for database changes.

# 

# \- Do not start a local Supabase instance or require Docker for the database workflow unless explicitly requested.

# \- Do not run `supabase db reset`, `supabase db push` or other commands that apply schema changes without explicit approval.

# \- Have Cursor generate and explain SQL scripts before any manual execution.

# \- Review scripts before running them against the hosted database.

# \- Never expose database passwords, access tokens or service-role keys in prompts, source control or client-side code.

# \- Preserve Row Level Security and verify database ownership rules.

# 

# \## Next implementation milestone

# 

# The next major task is persistent exploration storage.

# 

# The intended sequence is:

# 

# 1\. Verify database ownership and security using appropriate tests.

# 2\. Connect the existing authenticated application to Supabase.

# 3\. Save and restore explorations, questions, ordering, central-question roles, priorities and Focus perspective origins.

# 4\. Persist session completion and support reopening completed sessions.

# 5\. Build the previous-explorations library.

# 6\. Add rename and confirmed deletion.

# 7\. Introduce AI-assisted reflection only after persistence is reliable.

# 

# Do not implement all phases in one task. Work in small increments, preserve the accepted UI, and test each increment.

# 

# \## First prompt for a new Cursor audit

# 

# Before editing code, inspect the current repository and read `AGENTS.md`, `.cursor/rules/curitopia.mdc`, and the relevant documents in `docs/`.

# 

# Report:

# 

# 1\. The actual framework, package manager and application routes.

# 2\. The existing authentication implementation and configuration requirements.

# 3\. The relationship between the hosted Supabase schema and the locally tracked migration files.

# 4\. Which persistence requirements are implemented, partially implemented or missing.

# 5\. Any contradictions between the code, the documentation and the known hosted database state.

# 6\. The smallest ordered implementation plan.

# 

# Do not change files, add dependencies, apply migrations or modify remote settings during this audit.

# 

# After reviewing the audit, implement one small, explicitly approved task at a time.

