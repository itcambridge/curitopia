# Architecture Notes

## Status
The persistence architecture below is the approved design (D-007 through D-014 in `docs/DECISIONS.md`). Email and password authentication is implemented. Saved explorations are listed and opened from the hosted database. Rename and delete are not built.

Inspect the repository before implementation. Keep the current Next.js, React, TypeScript, Tailwind, and pnpm setup.

## Current application
Verified from the repository. This is the running application:

- Package manager: pnpm 12.3.4, with `pnpm-lock.yaml`.
- Next.js 16.4.0 App Router. The signed-in home is the library in `app/page.tsx`. The workspace is `components/exploration-screen.tsx`, opened at `/explorations/new` or `/explorations/[id]`. The root layout is `app/layout.tsx`.
- React 19 and TypeScript 5.7.
- Tailwind CSS 4, with the existing global styles.
- The orbital map is SVG rendered from the visible questions in `components/exploration-screen.tsx`. Hidden questions are omitted from that layout.
- The open exploration is loaded on the server and kept in React state while the person edits it. Saves go through server actions and the authenticated Supabase client, so row-level security applies. There is no `localStorage`. Selected question, map or list view, and the composer draft stay in the browser.
- `components/curitopia-app.tsx` is an earlier shell. Nothing imports it. It still contains fixed journey figures. Do not persist those figures or revive that shell as the data source.
- `@vercel/analytics` is a dependency. `app/layout.tsx` renders it when `NODE_ENV` is `production`. That page-view component stays. Do not send question text, titles, emails, or other exploration content to analytics.
- `typescript.ignoreBuildErrors` has been removed. `pnpm build` and `pnpm typecheck` both enforce types.
- `.gitignore` ignores `.env`, `.env.*` except `.env.example`, and `.vercel/`. `.env.example` lists placeholder names only.
- Scripts in `package.json`: `dev`, `build`, `start`, `typecheck`. There is no lint script and no frontend test script.
- `.cursor/rules/curitopia.mdc` is the always-applied project rule.

The earlier prototype used numeric question ids, often `Date.now()`, and stored a decorative colour. The running contract uses a UUID and derives colour from that id. See `docs/DATA_MODEL.md`. D-005 records the in-memory prototype and is superseded.

## Prototype boundaries
Adapt names to the current page. Do not duplicate the live UI.

- Mode selector: Quickfire and Focus.
- Question composer: input and Add Question.
- Focus perspective panel: optional Investigate, Reframe, Connect, and Challenge starters.
- Session statistics: counts derived from the question list and the layout.
- Question map: SVG layout and node rendering.
- Review: end-of-session list and priority toggles.
- Shell: a create sidebar, the map canvas, and a collapsible review sidebar.

The question list is the source of truth for the prototype. Statistics and the map are derived from it. Layout calculation stays separate from rendering. Layout for an unchanged list stays deterministic. Do not call random number generation on every React render. Do not add a physics engine. One hundred nodes should remain usable.

## Approved persistence architecture
Approved default:

- Keep this Next.js, React, and TypeScript application.
- Serve it from Linode at `https://curitopia.com`. DNS for that domain points at Linode, and browsers reach it over HTTPS. See D-015.
- Supabase Auth provides registration, email confirmation, sign-in, password reset, and sign-out. No social login. Auth is the managed Supabase project that already exists.
- Store explorations and questions in that project's managed PostgreSQL. The schema and row-level security in the two applied migrations stay the contract.
- Require a signed-in confirmed user before any persistent exploration is written or read.
- Enforce ownership with row-level security. The policies are in the applied SQL. pgTAP coverage exists and has not been run, so runtime isolation is still unverified. See `docs/TEST_STRATEGY.md`.
- Keep source in GitHub. The current origin is `https://github.com/itcambridge/curitopia.git`.
- Reflection of one saved exploration calls OpenAI from the server after the owner confirms. It does not require the exploration to be completed, and it does not store the result. Cross-session profiling stays unapproved. Phases 1 and 2 of the user-authored Experiment workspace are in the application (D-022). They do not add a model call. Thumbnails and a concept map are later. See D-019.

## Production and local databases
Production data lives only in the hosted Supabase project. The local Supabase CLI stack, including Docker Postgres on port 54322, is a place to rehearse migrations and run `supabase test db`. It is not a second production database and it does not receive real accounts.

The exploration SQL and the later hide SQL were applied to the hosted project through the SQL Editor. Do not recreate those tables or edit the applied migration files. A further schema change is a new forward-only migration, reviewed as SQL, and applied only when that work is requested. Do not run `supabase db push` or `supabase db reset` as part of an application task. Do not change DNS or the Linode server until deployment work is requested. The open deployment choices are listed under D-015. They include the Linode process supervisor, the HTTPS certificate, DNS record shape, the GitHub release path, Auth redirect URLs, confirmation email transport, and whether Vercel Analytics stays after the host change.

D-005 is the historical prototype decision. D-007 replaces it. The current exploration is stored in the hosted database.

### Application shape
- Server-rendered account checks using a cookie-backed Supabase session.
- The browser uses the publishable Supabase key. Queries run as the signed-in user so row-level security applies.
- The service-role key bypasses row-level security. This phase does not need it in the application. Do not expose it to the browser, commit it, or use it to read user explorations from UI code.
- Session refresh uses the Next.js 16 root `proxy.ts` and `supabase.auth.getClaims()`. Protected pages use the same verified claims. `getSession()` is not used to decide access.
- Routes in place: `/login`, `/signup`, `/forgot-password`, `/reset-password`, and `/auth/confirm`. A signed-in person lands on `/`, the previous-explorations library. `/explorations/new` is an unsaved workspace. `/explorations/[id]` opens that saved exploration. Rename and delete wait for a later task.
- Installed persistence libraries: `@supabase/supabase-js` and `@supabase/ssr`. Database tests use the Supabase CLI and pgTAP. No other persistence library, and no general-purpose frontend test framework.

### Modules in place
Keep these small. Leave map layout in its current form.

- Account screens for registration, confirmation, sign-in, password reset, and sign-out.
- Exploration library, listing only explorations that have at least one question.
- A save-status indicator on the workspace: Saving, Saved, or Could not save, with retry.
- Hide and restore for eligible questions. A rejected hide returns the row to the stored visible state.
- A typed data-access boundary that maps database rows to the UI question model and derives colour from the question id.

Still absent: rename and a delete confirmation. Reflection of one saved exploration is implemented and is not stored. It does not require the exploration to be marked completed.

The page may keep a local copy of the open exploration while a request is in flight. After a successful response, the server row is the source of truth. A failed request leaves the local change in place and surfaces the error described in `docs/UX_SPEC.md`.

The first accepted question calls `public.create_exploration_with_first_question`, which inserts the exploration and that question in one statement. The owner is `auth.uid()`. Until that statement commits, there is no library row. Later writes are per change: insert one question, update mode, update one priority flag, or update `is_hidden`. The workspace does not set `status` to `completed`. Rename and delete are specified and not built. Sending the entire question list on every keystroke is not the write model. See `docs/DATA_MODEL.md`.

Question ids are created in the client before the insert so a retry of the same question does not create a second row. Positions are allocated with the insert so two overlapping adds cannot claim the same order. Colour uses the id, not the position. See `docs/DATA_MODEL.md`.

### Environment variables
Names the application reads:

- `NEXT_PUBLIC_SUPABASE_URL` — project URL, available in the browser.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key from the Supabase Connect dialog, available in the browser. It is safe to expose only because row-level security rejects unowned rows.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, not required for this phase, never prefixed with `NEXT_PUBLIC`.
- `OPENAI_API_KEY` — server-only secret for reflection of one saved exploration. Never prefix it with `NEXT_PUBLIC_`.
- `OPENAI_MODEL` — optional model id for text reflection. When unset, the server uses `gpt-6-astra`.
- `OPENAI_IMAGE_MODEL` — optional model id for Focus Image generation. When unset, the server uses `gpt-image-2.5-flare`. It is not the same setting as `OPENAI_MODEL`.

Store real values in the local environment used for migration tests and, when deployment is requested, on the Linode host. `.gitignore` already ignores `.env` files and allows a value-free `.env.example`. Do not commit filled env files, keys, or user data. An example file, if added during implementation, lists names only. Do not put the hosted database password or a Supabase access token in the repository.

### Migrations and security
- Keep SQL migrations in `supabase/migrations`. The applied files are `20261011162400_create_explorations.sql` and `20261013191000_add_question_hidden.sql`. Do not edit them. `20261014210000_allow_priority_during_exploration.sql` has not been applied to the hosted project. The same statements are in `supabase/scripts/allow_priority_during_exploration.sql`. `20261015191000_add_focus_image.sql` adds the optional focus-image path and private storage policies. It has not been applied. The SQL Editor copy is `supabase/scripts/add_focus_image.sql`. Do not apply either script automatically.
- Enable row-level security on application tables before any user data is written. The migration does this.
- Policies restrict rows to `auth.uid()`.
- The anonymous role has no policies on exploration or question tables.
- Application code and policies both treat ownership as the signed-in user. Policies remain the enforcement that still holds if a client is bypassed.
- Do not log question text, passwords, or tokens.
- Do not add analytics events that include question text or session content. The prototype still mounts Vercel Analytics. Keeping that component on Linode is open under D-013 and D-015.

### Rendering, colour, and performance
- Keep layout calculation deterministic from the saved question order.
- Do not store map coordinates or node colour. Colour is a pure function of the question UUID and the fixed palette in `docs/DATA_MODEL.md`.
- One hundred saved questions should remain usable with the current scale-to-fit layout.
- Do not introduce a realtime subscription in this phase. Reload and explicit refetch cover open, continue, and retry.

### Supabase Auth URL configuration
Set these in the hosted project under Authentication → URL Configuration. The application does not change that dashboard.

- Site URL: `https://curitopia.com`
- Redirect URLs: `https://curitopia.com/auth/confirm` and `http://localhost:3000/auth/confirm`

Also allow the same paths on any other local port you use. Do not add a wildcard that covers other domains. Under Authentication → Sign In / Providers → Email, turn on Confirm email. The default Supabase mailer is rate-limited. Production confirmation and password-reset messages need a custom SMTP provider under Authentication → Emails → SMTP.

The app sends confirmation and recovery links to `/auth/confirm`. That route accepts a PKCE `code` and a `token_hash` with `type`. For a link that must work in a browser other than the one that requested it, set the Confirm signup and Reset password email templates to:

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

`next` is accepted only for `/` and `/reset-password`.

### Typecheck
`typescript.ignoreBuildErrors` is removed. Keep `"typecheck": "tsc --noEmit"`. A production build fails on type errors.

## Remaining gaps
These are unfinished product pieces, not open design choices:

1. **Library actions.** The library lists, opens, continues, and reviews saved explorations. Rename and delete are not built.
2. **Verification.** Typecheck and the production build passed after reflection was added. That does not prove the live OpenAI call, hide-and-restore, or database isolation. Hosted catalog checks for hiding were reported as passing. A manual two-account browser check is recorded in `docs/TEST_STRATEGY.md`. pgTAP has not been run.
3. **Analytics.** The page-view component is already present. It must not receive exploration content. Whether it remains on Linode is undecided.

## Later, not this phase
Cross-session curiosity patterns remain a proposal in `docs/REFLECTION_SPEC.md`. Phases 1 and 2 of the Experiment workspace open one experiment and edit its items. The SQL is written and has not been applied. Thumbnails, a concept map, and AI suggestions are later. Sharing, collaboration, and realtime presence stay out. Social login and guest persistence are excluded by D-010.
