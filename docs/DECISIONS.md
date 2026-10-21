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
**Consequences:** `docs/REFLECTION_SPEC.md` keeps the wider proposal. D-019 is the approved single-exploration implementation, and D-020 makes it available without completing the exploration. Pattern feedback and cross-session analysis are still not approved. D-018 extends the proposal with curiosity patterns and does not approve them either. D-022 records a separate user-authored Experiment workspace. Phase 1 is approved. It is not an AI experiment planner.

## D-018 — Curiosity patterns, proposed
**Status:** Proposed on 2026-10-13. Not approved for implementation.
**Decision:** Reflection may, once a later task approves it, help the user notice recurring interests. Three levels are specified: topics that repeat, possible connections between questions, and tentative deeper interests. Deeper interests are hypotheses, not diagnoses, personality assessments, or facts about motivation. The first implementation scope remains one exploration (D-017). Cross-session analysis is a later extension. It runs only after the user asks and sees which of their own explorations are included. Hidden questions stay out unless that request includes them. The user can say an interpretation resonates, ask to explore it, or reject it. Rejection is not treated as hidden confirmation.
**Rationale:** The direction of someone's questions may show subjects they return to. That observation is useful only if the user remains the authority on what it means, and only if the product does not silently profile them.
**Consequences:** The detail lives in `docs/REFLECTION_SPEC.md` and `docs/AI_BEHAVIOUR.md`. No model call, reflection screen, feedback store, or cross-session profile is authorised by this entry. A recurring interest may suggest a question worth a new exploration. A user-authored Experiment workspace is specified in D-022 and is not an AI plan. AI suggestions for experiments remain deferred.

## D-019 — Single-session reflection with OpenAI
**Status:** Approved on 2026-10-13 by the request to implement it. This does not approve D-018.
**Decision:** A signed-in owner can ask for a reflection of one completed exploration. The server loads that exploration with the owner's Supabase session, omits hidden questions, and sends the visible questions to OpenAI using the Responses API. The person confirms on the screen before the request. The result is validated, shown as a suggestion, and not stored. Cross-session profiling and experimentation planning stay out.
**Rationale:** The completed session is the first reflection that can be offered without interrupting Quickfire or Focus, and without building a profile.
**Consequences:** `OPENAI_API_KEY` is a server secret. `OPENAI_MODEL` is optional and defaults to `gpt-6-astra`. The route is `app/api/explorations/[id]/reflect`. There is no new table and no migration for the reflection itself. A missing key, an unknown exploration, and another person's exploration do not return question text. Review OpenAI's API data-handling terms before public launch. The current response is up to five follow-up questions. It does not return an overview, themes, a connections report, or notes on prioritised questions. Stage B still requires its own task. A user-authored Experiment workspace is D-022 and is not this reflection. AI planning of experiments remains deferred. D-020 removes the completed-session gate.

## D-020 — Explorations stay open
**Status:** Approved on 2026-10-14 by the request to replace completed sessions with persistent explorations.
**Decision:** An exploration is a resumable workspace. The user can leave it, open another, and return later to keep editing. Adding questions is not blocked because `status` is `completed`. Navigating away does not complete, reset, or lock an exploration. Review, priority, and reflection are available on a saved exploration without completing it. The owner still confirms before any question text is sent to OpenAI. A reflection is not stored. If the question set changes after a reflection is shown, that result is marked as an earlier set. Suggested questions can be copied or added to the same exploration. The `status` column stays. This decision does not approve cross-session analysis or an AI experiment planner. D-022 later approves a user-authored Experiment workspace, starting with a version that does not call a model.
**Rationale:** People return to a line of questions. A permanent completed state prevented that, and it made reflection a separate ending rather than part of the exploration.
**Consequences:** The workspace no longer calls an update that sets `status` to `completed`. Older completed rows remain readable and editable, and opening them does not change `status`. Inserts into a completed exploration were already allowed. Priority changes on an exploration that is still `active` are rejected by the hosted function until `supabase/scripts/allow_priority_during_exploration.sql` is pasted into the hosted SQL Editor. That script matches `supabase/migrations/20261014210000_allow_priority_during_exploration.sql`. It was not applied from the application. D-009's review-only rule is superseded for editing. D-019's consent, ownership, hidden-question exclusion, validation, and decision not to store the result remain in force.

## D-021 — Optional focus image
**Status:** Approved on 2026-10-15 by the request to add it. The hosted SQL has not been applied.
**Decision:** A saved exploration may have one optional background image. The person can generate it from a prompt they edit and explicitly submit, or upload a JPEG, PNG, or WebP. The image is previewed and becomes the background only after Use image. It can be replaced, removed, hidden for the current view, or dimmed. No image is created when an exploration or question is saved. The file is stored in a private Supabase Storage bucket. The exploration row stores the object path, not the image bytes.
**Rationale:** A personal image can give an exploration a visual context. It should stay behind the question map, and it should be sent to a model only when the person asks for generation.
**Consequences:** `supabase/migrations/20261015191000_add_focus_image.sql` is the forward-only change. Paste `supabase/scripts/add_focus_image.sql` into the hosted SQL Editor. `OPENAI_IMAGE_MODEL` is optional and defaults to `gpt-image-2.5-flare`. Generation uses the Image API and sends only the confirmed prompt. Upload does not call OpenAI. The storage policies are written and have not been executed, so they are not evidence that another account is blocked at the database. The exploration remains usable when image generation or storage is unavailable. A concept thumbnail inside an experiment is a different feature, proposed in D-022, and does not reuse this column or bucket.

## D-022 — Experiment workspace
**Status:** Approved on 2026-10-16. Phases 1 and 2 are in the application. The hosted experiment SQL has not been applied. Phase 3 thumbnails are specified in D-023. AI experiment suggestions are not built.
**Decision:** An experiment is a user-authored investigation of one prioritised question from a saved exploration. There is one experiment per question. The control is "Investigate further". Concepts, notes, hypotheses, tests, observations, and discoveries are optional, can be written in any order, and each item is at most 2,000 characters. The user chooses what to try and what counts as a discovery. Tests are practical and low-risk. The interface must not encourage an unauthorised production change. Connecting or moving concepts is optional. The originating exploration stays editable. Deleting a question or exploration must not silently delete the experiment; those foreign keys restrict the delete until an explicit workflow exists. Concept thumbnails, in a later phase, use a private `experiment-thumbnails` bucket and small WebP files, separate from the Focus Image. The route is `/explorations/[id]/experiments/[experimentId]`. AI suggestions are deferred. The detail is `docs/EXPERIMENT_SPEC.md`.
**Rationale:** People should be able to investigate a question they have marked, keep the wider exploration, and feel the result of their own work. A general graph, a mandatory method, and a model are not required for that.
**Consequences:** `supabase/migrations/20261016190000_create_experiments.sql` is the forward-only change. Paste `supabase/scripts/create_experiments.sql` into the hosted SQL Editor. It does not edit `explorations` or `questions` and does not create a storage bucket. Once that SQL is applied, the owner can create and reopen the experiment and can add, edit, and delete its items. pgTAP coverage is in `supabase/tests/experiments_rls.test.sql` and has not been run. Reflection still does not plan an experiment. Thumbnail storage is D-023 and is a separate script. The exploration control is now a flask icon with the accessible name Investigate further. The priority star is unchanged. Create a Story opens from this experiment for the parent exploration.

## D-023 — Concept thumbnails
**Status:** Approved on 2026-10-16 by the request to add them. The hosted thumbnail SQL has been applied. pgTAP has not been run.
**Decision:** A concept may have one optional thumbnail. Notes, hypotheses, tests, observations, and discoveries do not. The stored file is a WebP of at most 256 by 256 pixels and 150 KB, compressed toward about 100 KB. The original image is not stored. The path is `{user_id}/{experiment_id}/{item_id}/{file_id}.webp` in the private `experiment-thumbnails` bucket, which is not the Focus Image bucket. The browser makes the thumbnail. The server checks the file contents, dimensions, and size, then stores it and updates `experiment_items.image_path`. Upload does not call OpenAI. Generate uses `OPENAI_IMAGE_MODEL` and sends only the prompt the person submits, and only after they choose Generate. Cancel leaves the saved thumbnail unchanged. The constellation shows the image inside the concept sphere without changing the sphere layout. A missing image leaves the text sphere usable.
**Rationale:** A small picture can make a concept easier to recognise. It should stay private, small, and separate from the question text.
**Consequences:** The matching migration is `supabase/migrations/20261016213000_add_experiment_thumbnails.sql`, and the same statements are in `supabase/scripts/add_experiment_thumbnails.sql`. That SQL has been applied on the hosted project. D-024 removes the concept-only limit. Node tests mock storage and the image model. They are not a two-account check. No new image-processing dependency was added.

## D-024 — Thumbnails on every experiment item
**Status:** Approved on 2026-10-17. The forward-only SQL has not been applied. pgTAP has not been run.
**Decision:** Every experiment item may have one optional thumbnail, using the same upload, generation, preview, and private-storage path as D-023. Concepts, notes, hypotheses, tests, observations, and discoveries share that workflow. A saved image covers its sphere with a centre crop and does not change the sphere's size, position, or the constellation layout. Items without an image keep the current text sphere. The originating question sphere is unchanged. The prompt suggestion quotes only that item's text. Generate still runs only after an explicit request.
**Rationale:** The same picture should be available on any thought, and it should be recognisable as that sphere rather than a small inset.
**Consequences:** Paste `supabase/scripts/allow_thumbnails_on_all_experiment_items.sql` into the hosted SQL Editor. The matching migration is `supabase/migrations/20261017172000_allow_thumbnails_on_all_experiment_items.sql`. It replaces `experiment_items_image_path_check` and `experiment_thumbnail_owner(text)`. It does not recreate the bucket or the storage policies. Until it is applied, a non-concept image cannot be stored. Existing concept paths stay valid.

## D-025 — Curitopia Stories
**Status:** Product direction recorded on 2026-10-19. The first-release decisions were **Approved** on 2026-10-20. Select, arrange, review, confirmed artwork, and a silent 9:16 MP4 download are in the application. The video is encoded in the browser from the same 1080 by 1920 frames and is not stored. Each slide is held for about 4 seconds, with a crossfade of about half a second, and the file has no audio. Background music, narration, a user-chosen soundtrack, Suno, PDF, a 4:5 export, a suggested closing question, persistent drafts, and a direct social connection remain **Future**.
**Decision:** The owner of a saved exploration may, once this is built, turn a selection of their own questions, images, and discoveries into a visual slideshow and download it. The journey is create, select, arrange, review, download. The person chooses every included item, reviews the slides, and can discard the draft. Export downloads files to their device. It does not publish them. Hidden questions stay out, with no control to include them. Unselected experiment items stay private. A hypothesis stays tentative, and a generated image is not evidence of a real event. A closing question is written by the person. The detail is `docs/STORIES_SPEC.md`.
**Approved for the first release:** The draft stays in the browser. A refresh or a closed tab can discard it. There is no story table and no story bucket. The slide canvas is vertical 9:16. That shape is the export, not a claim that the image API already returns 9:16. PDF is excluded. The Curitopia mark is optional. Slide images, when generated, use the existing OpenAI Image API. The current image function is not assumed to be suitable. Implementation is complete only after the real model, parameters, sizes, and handling have been inspected, and only after a composed 9:16 slide has been tested. That test has not been run. A 256-pixel thumbnail and the landscape Focus Image are not finished slide assets without a quality check. Generation needs confirmation, a review, and only that slide's selected content. Generated images and exported slides are not kept on the server. Bytes may pass through the server only to call the API and return the result. Implementation must not log or retain the image payload. Export does not upload or connect to another network.
**Rationale:** Private curiosity is the product. A reviewed story is one way to invite someone else into a question without building another social network. Whether people want that is untested. A small first release, without a new store or a social connection, is enough to learn that.
**Consequences:** No story screen, route, table, bucket, or model call is added by this entry. Reflection, the question map, and the experiment constellation stay as they are. Suno is a future option to investigate, not an approved integration, and a public API for it is not assumed. D-013 still forbids sending story content to analytics. Building Stories waits for an implementation task. That task follows these approved limits. It does not reopen them unless a later decision says so. A later task added the story screen. The current download is one silent file, `curitopia-story.mp4`, created in the browser. It does not add music, narration, PDF, storage, or a social connection.
