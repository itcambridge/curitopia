# Decision Log

Record decisions here. Add new entries with date, decision, rationale, and consequences. Superseded entries stay in the log.

Approved entries are the design default. Each entry records whether that decision is already in the application. A proposed entry is a review document. It is not permission to build it.

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
**Consequences:** `docs/AI_BEHAVIOUR.md` remains the guardrail. D-017 records the wider reflection proposal. D-019 approves the single-exploration call. D-020 removes the requirement that the exploration be completed first. D-008 still forbids cross-session profiling, a stored model output, and adding AI inside an unrelated change.

## D-009 — Exploration lifecycle
**Status:** Approved on 2026-10-11 with D-007.
**Decision:** In-progress explorations can be continued. Completed explorations can be reopened for review, including priority changes, and do not accept new questions. Rename is available on both. Delete requires confirmation and then removes that exploration permanently. Starting another exploration keeps the previous saved one in the library.
**Rationale:** The prototype uses one in-memory list and clears it on "Start new exploration". Persistent use needs a library and a distinction between continue and review.
**Consequences:** The UX and acceptance criteria followed this lifecycle until D-020. D-020 supersedes the rule that a completed exploration cannot accept new questions. An exploration row is created with its first saved question (D-012), so an unsaved empty workspace is not a library item. The library is in the application. Rename and delete are still specified only. `status` remains in the database.

## D-010 — Account access
**Status:** Approved on 2026-10-11.
**Decision:** The first release uses email and password. Registration requires email confirmation. Password reset is included. Social login is not included. A persistent exploration requires a signed-in user with a confirmed email.
**Rationale:** Email and password covers registration, sign-in, and recovery without adding identity providers. Confirmation keeps explorations off unverified addresses. Anonymous cloud storage is a different product.
**Consequences:** Signed-out and unconfirmed visitors see account screens and cannot read or write saved explorations. There is no guest persistence and no social-login button. The earlier in-memory prototype is not the running application.

## D-011 — Limits and deletion
**Status:** Approved on 2026-10-11.
**Decision:** A custom title is at most 120 characters after trimming. Question text is at most 2,000 characters after trimming. Blank text is rejected. Delete is permanent after explicit confirmation, and the database cascades to that exploration's questions.
**Rationale:** Bounds keep storage and the interface predictable. Confirmation is the safeguard for a delete that cannot be undone.
**Consequences:** The schema checks and the composer enforce the same limits. Exploration deletion stays permanent. Hiding an individual question without deleting it is specified in D-016.

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
5. Whether the hosted project's Supabase migration-history table matches the files in `supabase/migrations`. The exploration SQL and the hide SQL were applied through the hosted SQL Editor. This repository has not run `supabase db push`, and the documentation audit did not reconnect to confirm the live catalog again. Further changes are new forward-only migrations. Do not edit those applied files and do not recreate `explorations` or `questions`.
6. Applying the Supabase Auth site URL and redirect allow list in the hosted project dashboard. The application expects the values documented in `docs/ARCHITECTURE.md`. That dashboard change has not been made from this repository.
7. Which mail transport sends confirmation and password-reset messages.
8. Whether the existing Vercel Analytics component remains, is replaced, or is removed on Linode. D-013 still forbids sending exploration content.

## D-016 — Hide and restore a question
**Status:** Approved on 2026-10-13. The hosted database has the column, and the workspace can hide and restore questions.
**Decision:** A question can be hidden and later restored. Hiding sets `questions.is_hidden` and does not delete the row. Text, id, position, role, priority, perspective origin, and derived colour stay. Hidden questions are omitted from the normal map, list, and visible counts. The interface must reveal hidden questions so one can be restored. A central question cannot be hidden; a different centre means a new exploration. The last visible question cannot be hidden. Hiding or restoring does not reopen a completed exploration. Future AI analysis excludes hidden questions unless the user explicitly includes them.
**Rationale:** People need to set a question aside without losing it or changing the exploration's centre. A check and a locking trigger keep those limits even if the interface is wrong.
**Consequences:** `supabase/migrations/20261013191000_add_question_hidden.sql` is the forward-only change. The same statements are in `supabase/scripts/add_question_hidden.sql` for the hosted SQL Editor. Existing questions default to visible. Row-level security and the deferred non-empty checks stay as they are. The friendly refusal for a central question is: "The central question anchors this exploration. Start a new exploration to explore a different central question." After that script, the user reported that all 16 catalog checks in `supabase/scripts/verify_question_hidden.sql` passed. Those checks do not hide a row and do not sign in as two users. A later manual browser test with two accounts passed: each account saw a different exploration library, and opening another account's exploration URL showed "This exploration is not available" without revealing the exploration. That confirms observed application-level access protection. It does not prove database-level row-level security isolation. The automated pgTAP tests have not been run, so direct database-access isolation remains unverified. End-to-end hide and restore in a signed-in session is also still unverified. See `docs/TEST_STRATEGY.md`. D-020 keeps hiding from changing `status`, and it no longer treats a completed exploration as locked.

## D-017 — AI-assisted reflection, proposed
**Status:** Proposed on 2026-10-13. The completed-session slice is implemented under D-019. The rest of this entry is not approved.
**Decision:** The next product phase, once approved as its own task, is post-session reflection. It may suggest themes, possible connections, a reading of prioritised questions in the context of the wider exploration, important unanswered questions, and questions that may be worth research or experimentation. It does not change the user's questions, and it does not plan the experiment.
**Rationale:** Persistence, the library, and hiding are in the application. Reflection is the remaining product step described in `docs/AI_BEHAVIOUR.md`. Sending question text to a model needs its own privacy decision, which sign-in does not provide.
**Consequences:** `docs/REFLECTION_SPEC.md` keeps the wider proposal. D-019 is the approved single-exploration implementation, and D-020 makes it available without completing the exploration. Pattern feedback, cross-session analysis, and an experiments spec are still not approved. D-018 extends the proposal with curiosity patterns and does not approve them either.

## D-018 — Curiosity patterns, proposed
**Status:** Proposed on 2026-10-13. Not approved for implementation.
**Decision:** Reflection may, once a later task approves it, help the user notice recurring interests. Three levels are specified: topics that repeat, possible connections between questions, and tentative deeper interests. Deeper interests are hypotheses, not diagnoses, personality assessments, or facts about motivation. The first implementation scope remains one exploration (D-017). Cross-session analysis is a later extension. It runs only after the user asks and sees which of their own explorations are included. Hidden questions stay out unless that request includes them. The user can say an interpretation resonates, ask to explore it, or reject it. Rejection is not treated as hidden confirmation.
**Rationale:** The direction of someone's questions may show subjects they return to. That observation is useful only if the user remains the authority on what it means, and only if the product does not silently profile them.
**Consequences:** The detail lives in `docs/REFLECTION_SPEC.md` and `docs/AI_BEHAVIOUR.md`. No model call, reflection screen, feedback store, or cross-session profile is authorised by this entry. A recurring interest may suggest a question worth a new exploration. Planning an experiment remains a separate future specification.

## D-019 — Single-session reflection with OpenAI
**Status:** Approved on 2026-10-13 by the request to implement it. This does not approve D-018.
**Decision:** A signed-in owner can ask for a reflection of one completed exploration. The server loads that exploration with the owner's Supabase session, omits hidden questions, and sends the visible questions to OpenAI using the Responses API. The person confirms on the screen before the request. The result is validated, shown as a suggestion, and not stored. Cross-session profiling and experimentation planning stay out.
**Rationale:** The completed session is the first reflection that can be offered without interrupting Quickfire or Focus, and without building a profile.
**Consequences:** `OPENAI_API_KEY` is a server secret. `OPENAI_MODEL` is optional and defaults to `gpt-6-astra`. The route is `app/api/explorations/[id]/reflect`. There is no new table and no migration for the reflection itself. A missing key, an unknown exploration, and another person's exploration do not return question text. Review OpenAI's API data-handling terms before public launch. The current response is up to five follow-up questions. It does not return an overview, themes, a connections report, or notes on prioritised questions. Stage B and experiment planning still require their own tasks. D-020 removes the completed-session gate.

## D-020 — Explorations stay open
**Status:** Approved on 2026-10-14 by the request to replace completed sessions with persistent explorations.
**Decision:** An exploration is a resumable workspace. The user can leave it, open another, and return later to keep editing. Adding questions is not blocked because `status` is `completed`. Navigating away does not complete, reset, or lock an exploration. Review, priority, and reflection are available on a saved exploration without completing it. The owner still confirms before any question text is sent to OpenAI. A reflection is not stored. If the question set changes after a reflection is shown, that result is marked as an earlier set. Suggested questions can be copied or added to the same exploration. The `status` column stays. This decision does not approve cross-session analysis or experiment planning.
**Rationale:** People return to a line of questions. A permanent completed state prevented that, and it made reflection a separate ending rather than part of the exploration.
**Consequences:** The workspace no longer calls an update that sets `status` to `completed`. Older completed rows remain readable and editable, and opening them does not change `status`. Inserts into a completed exploration were already allowed. Priority changes on an exploration that is still `active` are rejected by the hosted function until `supabase/scripts/allow_priority_during_exploration.sql` is pasted into the hosted SQL Editor. That script matches `supabase/migrations/20261014210000_allow_priority_during_exploration.sql`. It was not applied from the application. D-009's review-only rule is superseded for editing. D-019's consent, ownership, hidden-question exclusion, validation, and decision not to store the result remain in force.

## D-021 — Optional focus image
**Status:** Approved on 2026-10-15 by the request to add it. The hosted SQL has not been applied.
**Decision:** A saved exploration may have one optional background image. The person can generate it from a prompt they edit and explicitly submit, or upload a JPEG, PNG, or WebP. The image is previewed and becomes the background only after Use image. It can be replaced, removed, hidden for the current view, or dimmed. No image is created when an exploration or question is saved. The file is stored in a private Supabase Storage bucket. The exploration row stores the object path, not the image bytes.
**Rationale:** A personal image can give an exploration a visual context. It should stay behind the question map, and it should be sent to a model only when the person asks for generation.
**Consequences:** `supabase/migrations/20261015191000_add_focus_image.sql` is the forward-only change. Paste `supabase/scripts/add_focus_image.sql` into the hosted SQL Editor. `OPENAI_IMAGE_MODEL` is optional and defaults to `gpt-image-2.5-flare`. Generation uses the Image API and sends only the confirmed prompt. Upload does not call OpenAI. The storage policies are written and have not been executed, so they are not evidence that another account is blocked at the database. The exploration remains usable when image generation or storage is unavailable.
