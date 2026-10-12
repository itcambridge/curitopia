# Test Strategy

## Status
Prototype checks below apply to the current application. Persistence checks apply when the approved design is implemented. This document does not add a frontend test framework.

## First inspect existing tooling
`package.json` defines `dev`, `build`, `start`, and `typecheck` (`tsc --noEmit`). It does not define lint or frontend test scripts. No frontend test framework is installed, and none is approved (D-014).

`typescript.ignoreBuildErrors` has been removed. `pnpm build` validates types and the `typecheck` script remains. Report both results.

Row-level security tests use pgTAP, run with the Supabase CLI command `supabase test db`. Add those tests with the database implementation. Do not install Vitest, Jest, Playwright, or Testing Library for this phase.

## Prototype smoke tests
- App starts with `pnpm dev` and loads without console errors.
- Quickfire and Focus can be selected.
- A question can be added with the button and with the keyboard.
- Blank and whitespace-only input is rejected.
- Input clears after a successful submission, and focus stays in the composer.
- Counts reflect the actual question array.
- Quickfire can be ended and reviewed, including the prioritised count.
- After the session ends, a question can be marked important and unmarked.
- Focus central question remains visible.
- A Focus starter fills the composer and can be edited before add. Free typing still works.
- Selecting a question highlights it and exposes its full text.
- Map and List both show the same questions. Timeline stays disabled.
- Switching mode does not clear questions.
- Start new exploration clears the in-memory questions. This prototype action is replaced in the persistence phase by creating another saved exploration.
- Layout works at narrow and wide viewport sizes.
- Reduced-motion preference is honoured.

## Layout stress tests
Test 1, 10, 25, and 100 satellite questions, including long text. Check circle overlap, central-node collision, clipping, readable labels, and interaction performance.

## Prototype automated tests
A frontend test runner is deferred. When one is approved later, cover:

- Blank-question validation.
- Adding a question and updating derived counts.
- Mode switching without data loss.
- Quickfire completion and priority toggles.
- Stable question order.
- Deterministic layout coordinates for identical inputs.
- Perspective origin stored for a Focus starter and omitted for free typing and for Quickfire.

## Persistence tests
Run the database checks with `supabase test db` when the schema exists. Run the screen checks manually until a frontend framework is approved. Use two confirmed accounts. Do not use production user data.

### Database policies
pgTAP tests live in `supabase/tests/explorations_rls.test.sql` and run with `supabase test db` against the local Supabase database. They must show:

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

### Accounts
- Register, confirm the email, and sign in.
- An unconfirmed account cannot open the library or save an exploration.
- Password reset sets a new password and that password can sign in.
- The account UI has no social-login action.
- Sign out hides saved explorations.
- A failed sign-in stays on the account screen.
- A signed-out request for an exploration URL shows the account screen, with no question text in the response body.

### Ownership
- The library and an open exploration show only the signed-in user's saved explorations.
- An unknown id and another user's id produce the same not-found result in the UI.

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
- Continue an in-progress exploration and append a question. The new question is last.
- End the exploration, reopen it, and confirm the composer is disabled.
- Toggle priority on a complete exploration, reload, and confirm the flag.
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
- No request is sent to an AI service.
- Sample dream questions are not inserted for a new account.
- Analytics traffic for a session does not include question text, titles, or exploration content.

## Reporting
Report the exact commands run and whether each passed. Separate automated results from manual observations. Never claim a check was run when it was not.
