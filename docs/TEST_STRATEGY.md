# Test Strategy

## Status
The checks below are the verification plan. Recorded results are listed immediately after this status. This document does not add a frontend test framework.

## Recorded results
These results come from earlier implementation reports, the user's report of the hosted schema script, and a manual browser check on 2026-10-13. They were not re-run for this note, and this note did not connect to the hosted database.

- `npm test` covers reflection helpers, the resumable-exploration rules, and focus-image decisions. Focus-image tests mock OpenAI and storage. They check prompt confirmation, file validation, path ownership, replacement, and removal. They do not create a storage bucket and do not prove the hosted storage policies.
- The user reported that all 16 checks in `supabase/scripts/verify_question_hidden.sql` passed after the hide SQL was applied in the hosted SQL Editor. Those checks read catalog metadata: the `is_hidden` column, its default, the central-question check, the last-visible trigger, and the continued presence of row-level security and the earlier deferred checks. They do not hide a row.
- End-to-end hide and restore in the signed-in application, including refresh, has not been confirmed. The browser session used while implementing that screen was signed out.
- Manual browser check, two accounts: each account showed a different exploration library. While signed in as Account B, opening an exploration URL that belongs to Account A showed "This exploration is not available" and did not reveal that exploration. This is a screen-level observation only.
- Automated database Row Level Security tests remain outstanding. `supabase/tests/explorations_rls.test.sql` and `supabase/tests/questions_hidden.test.sql` have not been executed with `supabase test db`. The browser check does not verify database policies, direct table access, updates, deletes, or inserts. Do not treat it as proof that database-level isolation is fully verified.
- Email confirmation and password reset have account screens and redirect routes. A local sign-in was reported after the environment was configured. An email-confirmation redirect problem on localhost was left for the production domain. Those mail flows are not recorded as fully verified.
- Linode process supervision, TLS, DNS, and the GitHub release path are open under D-015. Do not describe the public site as deployed.

Do not describe row-level security as fully verified until the pgTAP files have actually passed. The manual two-account browser check above does not replace those tests.

## First inspect existing tooling
`package.json` defines `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), and `test`. `test` runs Node's built-in test runner against the reflection helpers and the focus-image decisions. It does not install Vitest, Jest, Playwright, or Testing Library (D-014). It does not call OpenAI, and it does not log in to Supabase.

`typescript.ignoreBuildErrors` has been removed. `pnpm build` validates types and the `typecheck` script remains. Report both results.

Row-level security tests use pgTAP, run with the Supabase CLI command `supabase test db`. The test files are already in `supabase/tests`. They have not been executed. The reflection tests stub the exploration load, so a not-found result in those tests is not evidence of database isolation.

## Prototype smoke tests
- App starts with `pnpm dev` and loads without console errors.
- Quickfire and Focus can be selected.
- A question can be added with the button and with the keyboard.
- Blank and whitespace-only input is rejected.
- Input clears after a successful submission, and focus stays in the composer.
- Counts reflect the actual question array.
- Quickfire can be reviewed, including the prioritised count, without ending the exploration.
- After the session ends, a question can be marked important and unmarked.
- Focus central question remains visible.
- A Focus starter fills the composer and can be edited before add. Free typing still works.
- Selecting a question highlights it and exposes its full text.
- Map and List both show the same questions. Timeline and the unused more-options control are not shown.
- Switching mode does not clear questions.
- Start new exploration opens another empty workspace and leaves earlier saved explorations in the library. The old prototype instead cleared the only in-memory list.
- Layout works at narrow and wide viewport sizes.
- Reduced-motion preference is honoured.

## Layout stress tests
Test 1, 10, 25, and 100 satellite questions, including long text. Check circle overlap, central-node collision, clipping, readable labels, and interaction performance.

## Prototype automated tests
A frontend test runner is deferred. When one is approved later, cover:

- Blank-question validation.
- Adding a question and updating derived counts.
- Mode switching without data loss.
- Quickfire entry, review, and priority toggles on an exploration that is still being edited.
- Stable question order.
- Deterministic layout coordinates for identical inputs.
- Perspective origin stored for a Focus starter and omitted for free typing and for Quickfire.

## Persistence tests
Run the database checks with `supabase test db` when the schema exists. Run the screen checks manually until a frontend framework is approved. Use two confirmed accounts. Do not use production user data.

### Database policies
pgTAP tests live in `supabase/tests/explorations_rls.test.sql` and `supabase/tests/questions_hidden.test.sql`. They are intended to run with `supabase test db` against the local Supabase database. They have not been executed. The read-only hosted catalog check is `supabase/scripts/verify_question_hidden.sql`. The user reported that its 16 checks passed. See Recorded results above. The tests must show:

- User A can insert an exploration only with `user_id` equal to A.
- User A can select, update, and delete only A's explorations.
- User A can insert, select, update, and delete questions only on A's explorations.
- User B receives no rows for A's exploration or questions on select.
- User B cannot update or delete A's rows, and cannot insert a question onto A's exploration.
- The anonymous role cannot read or write either table.
- A question longer than 2,000 characters, a blank question, and a title longer than 120 characters are rejected.
- An exploration transaction that commits with no questions is rejected.
- A Quickfire question with a perspective origin is rejected.
- A priority change on an active exploration is rejected.
- Deleting an exploration deletes its questions.
- A new question is stored with `is_hidden` false.
- Hiding a satellite sets `is_hidden` true and leaves the row in place. Restoring sets it false. Text, position, role, priority, and perspective origin stay.
- Hiding a central question is rejected.
- Hiding the last visible question is rejected, including when two such hides are attempted together.
- Hiding or restoring a question does not change `status` or `ended_at`.
- A completed exploration still accepts another question, and its status stays `completed`.
- Priority can change while an exploration is `active`, after `20261014210000_allow_priority_during_exploration.sql` is applied.
- User B cannot hide User A's question.

### Accounts
- Register, confirm the email, and sign in.
- An unconfirmed account cannot open the library or save an exploration.
- Password reset sets a new password and that password can sign in.
- The account UI has no social-login action.
- Sign out hides saved explorations.
- A failed sign-in stays on the account screen.
- A signed-out request for an exploration URL shows the account screen, with no question text in the response body.

### Ownership
- The library and an open exploration show only the signed-in user's saved explorations. A manual browser check confirmed that two accounts saw different libraries.
- An unknown id and another user's id produce the same not-found result in the UI. The same manual check opened Account A's exploration URL while signed in as Account B and saw "This exploration is not available", without the exploration. Database policy tests for this case are still outstanding. See Recorded results.

### Round trip
- The first accepted question creates the exploration and that question together. A second question appends.
- Reload and sign in again.
- Restored fields: text, position, role, priority, perspective origin, mode, status, title, and timestamps used for library order. Colour is absent from the row and matches the id-to-palette rule after reload.
- A Focus exploration restores one central question. A Quickfire exploration restores every question as a satellite.
- The map of a restored exploration matches the map of the same questions before reload.
- A retried question insert with the same id does not create a duplicate.
- Two rapid adds do not share a position.
- Starting a workspace and leaving before the first save does not add a library row.

### Lifecycle
- Open a saved exploration, including one previously marked completed, add a question, leave to the library, and open it again. The new question is last, and `status` is unchanged.
- Toggle priority, reload, and confirm the flag. On an exploration that is still `active`, this depends on the priority SQL having been applied.
- Start a new exploration and confirm the previous one is still listed.
- Rename within 120 characters, reload, and confirm the title. A 121-character title is rejected. Clear the title and confirm the fallback label.
- Delete asks for confirmation and states that deletion is permanent. Cancel keeps the row. Confirm removes that exploration and its questions only.
- A failed save leaves the change on screen and shows retry.
- A failed library or exploration load shows an error, not the sample questions and not an empty success state.

### Flow guards
- Quickfire save does not open a dialog per question.
- A 2,001-character question is refused without a modal and without a write.
- Quickfire does not persist a perspective origin.
- Focus starters remain optional.
- No request is sent to an AI service during question entry. Reflection is a separate confirmed request on a saved exploration.
- Sample dream questions are not inserted for a new account.
- Analytics traffic for a session does not include question text, titles, or exploration content.

### Reflection
Automated, with OpenAI mocked and the exploration load stubbed. These do not prove account isolation or database row-level security:

- An unsigned call does not load or send an exploration.
- A saved exploration can be reflected whether or not it was marked completed.
- Adding, prioritising, or hiding a question after a reflection marks that result stale and keeps the suggestion available to copy or add.
- A stubbed not-found load returns "This exploration is not available." The same response is what the route uses when a real load finds no row. The stub does not show why the row was missing.
- Hidden questions are left out of the model input. Prioritised questions keep their stored flag and perspective origin.
- More than 80 visible questions are refused without a model call.
- A cited question id outside the supplied set is rejected.
- A missing `OPENAI_API_KEY`, malformed model output, a rate limit, a timeout, and an upstream error return fixed messages.
- Cancelling the confirmation returns to idle or the previous result and does not satisfy the send gate.
- The reflection component is rendered in the workspace review in `components/exploration-screen.tsx`, including while questions can still be added. The source still contains the Quickfire mode switch, Focus starters, priority toggles, hide/restore, and an All explorations link. It does not call `saveExplorationStatus`.

Not tested in a browser:

- A signed-in owner requesting reflection for their own saved exploration, then adding a question and seeing the earlier result marked stale.
- Another account opening that exploration URL.
- Cancelling the confirmation in the browser, and Retry after a failure.
- Quickfire, Focus, prioritisation, and hide/restore while the reflection panel is on screen.

## Reporting
Report the exact commands run and whether each passed. Separate automated results from manual observations. Never claim a check was run when it was not.
