# Decision Log

Record decisions here. Add new entries with date, decision, rationale, and consequences. Superseded entries stay in the log.

Approved entries are the design default. They do not, by themselves, change the application. Creating migrations and implementing authentication still wait for a request to start that work.

## D-001 — Two modes
**Decision:** Curitopia has Quickfire and Focus modes.
**Rationale:** Quickfire supports unrestricted question capture. Focus supports deliberate exploration of a central theme.
**Status:** In force.

## D-002 — Protect Quickfire flow
**Decision:** No mandatory categorisation or prompts during Quickfire capture.
**Rationale:** The user wants stream-of-consciousness question generation without disrupting flow.
**Status:** In force. Background saving must not add a dialog after each question. A question over the length limit is refused with a quiet inline state.

## D-003 — Map is data-driven
**Decision:** Render the orbital visualisation from question data, using SVG.
**Rationale:** The map must respond to newly entered questions and cannot be a static image.
**Status:** In force. The live map is SVG driven by the question list. Node colour is derived from the stable question id and is not stored. See D-012.

## D-004 — No AI in the prototype or the persistence phase
**Decision:** AI summaries and semantic connections are deferred.
**Rationale:** First validate the interface and core interactions, then persist explorations, before adding model-generated interpretation.
**Status:** In force. Extended by D-008.

## D-005 — No backend in the initial prototype
**Status:** Superseded as product direction on 2026-10-11 by D-007. Retained as history.
**Decision:** Use local React state for the first prototype. No database, authentication, or cloud persistence.
**Rationale:** Avoid infrastructure before the core interaction has been validated.
**Consequences:** Superseded for the running application by D-007. The current exploration is stored in the hosted database. This entry remains the history of the prototype.

## D-006 — Preserve the accepted v0 design
**Decision:** Keep the current v0-generated UI as the baseline and make targeted refinements only.
**Rationale:** The accepted design should guide the implementation rather than be replaced.
**Status:** In force. Account screens and the library use the same visual language. The workspace shell stays in place.

## D-007 — Private persistent explorations
**Status:** Approved on 2026-10-11.
**Decision:** Curitopia persists private explorations with Supabase Auth and PostgreSQL. Server-side sessions, versioned SQL migrations, and row-level security enforce that a user can read and write only their own explorations and questions.
**Rationale:** Returning to explorations needs an account and a database. The repository had no competing provider. D-005 remains the history of the prototype.
**Consequences:** The specs in `docs/` match this decision. Authentication, the current exploration, and the previous-explorations library are implemented against the hosted project. Rename and delete are not built. Related defaults are D-010 through D-015. The original hosting sentence named Vercel. That hosting choice is superseded by D-015. Schema, row-level security, and Supabase Auth are unchanged.

## D-008 — AI remains after persistence
**Status:** Accepted as direction on 2026-10-11. Implementation of AI is not approved.
**Decision:** AI-assisted reflection is a later phase. The persistence implementation must not call a model or store model output.
**Rationale:** Saved questions need an owner and a stable record before any analysis. Consent to store a question is separate from consent to send it to a model.
**Consequences:** `docs/AI_BEHAVIOUR.md` remains the guardrail. A future AI decision should be a new entry.

## D-009 — Exploration lifecycle
**Status:** Approved on 2026-10-11 with D-007.
**Decision:** In-progress explorations can be continued. Completed explorations can be reopened for review, including priority changes, and do not accept new questions. Rename is available on both. Delete requires confirmation and then removes that exploration permanently. Starting another exploration keeps the previous saved one in the library.
**Rationale:** The prototype uses one in-memory list and clears it on "Start new exploration". Persistent use needs a library and a distinction between continue and review.
**Consequences:** The UX and acceptance criteria follow this lifecycle. Moving a completed exploration back to in-progress capture is out of scope. An exploration row is created with its first saved question (D-012), so an unsaved empty workspace is not a library item.

## D-010 — Account access
**Status:** Approved on 2026-10-11.
**Decision:** The first release uses email and password. Registration requires email confirmation. Password reset is included. Social login is not included. A persistent exploration requires a signed-in user with a confirmed email.
**Rationale:** Email and password covers registration, sign-in, and recovery without adding identity providers. Confirmation keeps explorations off unverified addresses. Anonymous cloud storage is a different product.
**Consequences:** Signed-out and unconfirmed visitors see account screens and cannot read or write saved explorations. There is no guest persistence and no social-login button. The in-memory prototype remains only until this access model is implemented.

## D-011 — Limits and deletion
**Status:** Approved on 2026-10-11.
**Decision:** A custom title is at most 120 characters after trimming. Question text is at most 2,000 characters after trimming. Blank text is rejected. Delete is permanent after explicit confirmation, and the database cascades to that exploration's questions.
**Rationale:** Bounds keep storage and the interface predictable. Confirmation is the safeguard for a delete that cannot be undone.
**Consequences:** The schema checks and the composer enforce the same limits. Soft delete and undo are out of scope.

## D-012 — Identity, colour, and when a row is created
**Status:** Approved on 2026-10-11.
**Decision:** Question ids are stable UUIDs. Node colour is derived from that id and the fixed palette, and it is not a column. Order is stored as `position`. A persistent exploration is inserted in the same transaction as its first saved question. The library lists explorations that have at least one question.
**Rationale:** Colour from the id stays stable if order ever changes, and it does not need a stored presentation field. Creating the row on the first question keeps empty workspaces out of the library.
**Consequences:** Leaving before the first successful save adds nothing to the library. A deferred database check rejects an exploration that commits with no questions. The prototype's numeric ids and stored `color` values are not the persistent contract.

## D-013 — Analytics and typechecking
**Status:** Approved on 2026-10-11. The privacy rule and the typecheck rule stay in force. The Vercel Analytics product was chosen while Vercel was the planned host. D-015 moves hosting to Linode, so whether that component stays is an open deployment choice.
**Decision:** Aggregate page views may be recorded. Do not send question text, titles, emails, or other exploration content to analytics. Remove `typescript.ignoreBuildErrors` so production builds validate types. Keep the `typecheck` script.
**Rationale:** Question text is private exploration content. A production build that skips TypeScript hides defects in auth and data-access code. The prototype already mounts `@vercel/analytics` in `app/layout.tsx`.
**Consequences:** No custom analytics event may include session content. `typescript.ignoreBuildErrors` has been removed, so `pnpm build` and `pnpm typecheck` both enforce types. Do not remove or replace the analytics component until open item 8 under D-015 is decided.

## D-014 — Database tests, not a frontend framework
**Status:** Approved on 2026-10-11.
**Decision:** Row-level security is covered by automated PostgreSQL tests using Supabase's database testing support: pgTAP tests run with `supabase test db`. A general-purpose frontend test framework is deferred.
**Rationale:** Ownership bugs are database bugs. pgTAP can log in as two users and assert the policies. A browser test runner is a separate dependency and is not required to prove those policies.
**Consequences:** Implementation includes pgTAP coverage for select, insert, update, and delete across two users. Those tests run against the local Supabase stack only. Do not add Vitest, Jest, Playwright, or Testing Library unless a later decision approves them. Manual UI checks remain in `docs/TEST_STRATEGY.md`.

## D-015 — Production hosting
**Status:** Approved on 2026-10-11. This does not authorise DNS changes, Linode changes, or applying migrations to the hosted database.
**Decision:** The existing Next.js, React, and TypeScript application is served from Linode at `https://curitopia.com`. DNS for that domain points at Linode, and the site is reached over HTTPS. Production data and Supabase Auth use the managed Supabase project that already exists. Source control is GitHub. This repository's origin is `https://github.com/itcambridge/curitopia.git`. The Supabase CLI and its local Docker database are for testing migrations, including `supabase test db`. They are not the production database.
**Rationale:** Users should reach one public site, and saved explorations should live in the hosted project that was created for that purpose. A local database is only a rehearsal of the schema.
**Consequences:** Architecture docs name Linode, `curitopia.com`, managed Supabase, and GitHub. D-007's schema, ownership rules, and auth method stay as approved. Production environment values belong on the Linode host. Do not point the app at the hosted project, change DNS, or change the Linode server until that deployment work is requested. The choices still open are listed below.

### Open deployment choices
These are not decided by D-015:

1. How the Next.js process is supervised on Linode, and which reverse proxy sits in front of it.
2. Where the HTTPS certificate is issued and renewed.
3. The DNS provider, the address records, and whether `www.curitopia.com` redirects to the apex.
4. How a GitHub revision is released onto Linode.
5. When `supabase/migrations/20261011162400_create_explorations.sql` is applied to the hosted Supabase project.
6. Applying the Supabase Auth site URL and redirect allow list in the hosted project dashboard. The application expects the values documented in `docs/ARCHITECTURE.md`. That dashboard change has not been made from this repository.
7. Which mail transport sends confirmation and password-reset messages.
8. Whether the existing Vercel Analytics component remains, is replaced, or is removed on Linode. D-013 still forbids sending exploration content.
