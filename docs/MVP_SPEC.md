# MVP Specification and Acceptance Criteria

## Status
The prototype baseline describes the original frontend. Authentication, saving an exploration, and the previous-explorations library are implemented. Hiding and restoring a question is implemented. Rename and delete are not built yet.

## Prototype baseline
The current application is a local Next.js prototype. It demonstrates Quickfire, Focus, question entry, priorities after the session ends, optional Focus perspective starters, the SVG orbital map, and accurate basic statistics. Session data lives in React state.

### In scope
- Two modes: Quickfire and Focus.
- Add question using a textarea and button.
- In-memory exploration state for the prototype.
- Optional Focus starters: Investigate, Reframe, Connect, and Challenge.
- Display a central question and satellite question nodes.
- Select a question and read its full text.
- Question count and orbit count based on actual question data.
- End-of-session review with priority toggles.
- Responsive layout and keyboard interaction.
- Existing styling, refined only where required for usability.

### Prototype acceptance criteria
1. The app starts with `pnpm dev`.
2. The initial screen contains the Curitopia visual identity, mode selector, question entry, statistics, and map.
3. A non-empty question can be added by button and keyboard.
4. Blank questions are rejected and do not add a node.
5. The displayed count matches the number of questions held in state.
6. Switching modes does not delete the current exploration.
7. Quickfire accepts questions in any order and does not require categorisation, a parent, or a perspective.
8. Ending the session displays the questions, the collected count, the prioritised count, and priority toggles.
9. Focus keeps its central question visually prominent while satellites are added.
10. Every full question remains accessible when its node label is shortened.
11. Circles do not overlap the central node or each other in common test cases. Dense layouts stay usable through the list and review.
12. The initial map view does not clip the central question.
13. The layout remains usable at desktop and mobile widths without page-level horizontal scrolling.
14. Reduced-motion preferences are respected.
15. The prototype does not call an AI service. The persistence design is approved; implementing it waits until that work is requested.
16. Lint, type-check, tests, and production build are run where scripts exist. Actual results are reported. `package.json` currently provides `dev`, `build`, `start`, and `typecheck`. `next.config.mjs` still sets `typescript.ignoreBuildErrors` until the approved removal of that bypass.

## Persistence phase
This phase is the approved design. Once implementation is requested and built, it adds accounts and private saved explorations on top of the prototype baseline. It does not add AI, sharing, social login, or a second exploration model.

### In scope
- Registration with email and password, email confirmation, sign-in, password reset, and sign-out.
- Private persistence for a signed-in confirmed user.
- Creating the exploration when its first question is saved.
- Previous-explorations library that omits empty explorations.
- Continue an in-progress saved exploration.
- Reopen a complete exploration for review.
- Rename an exploration, with a 120-character limit.
- Permanent delete after explicit confirmation.
- Question text limited to 2,000 characters.
- Node colour derived from the stable question id and not stored.
- Visible saving, loading, and error states.
- Restored question order, text, central and satellite roles, priority flags, mode, completion, and Focus perspective origins.
- Aggregate page-view analytics, with no exploration content attached. The prototype still uses the existing Vercel Analytics component. Whether that component stays on Linode is open in `docs/DECISIONS.md`.
- Production builds that validate TypeScript, plus the existing `typecheck` script.
- Automated row-level security tests with Supabase pgTAP.

### Out of scope
- AI services or AI-generated question analysis.
- Payments, subscriptions, social login, sharing, or collaboration.
- Analytics events that include question text, titles, emails, or other exploration content.
- Notifications.
- Additional modes, a timeline implementation, or a graph editor.
- Mandatory categorisation.
- Guest or unconfirmed persistence, migrating the current in-memory prototype into a user account, or merging accounts.
- Soft-deleting or undoing deletion of an exploration. Hiding a question keeps the row and is not deletion.
- Turning a complete exploration back into an in-progress one so more questions can be added.
- Reordering or individually deleting questions.
- Promoting a satellite to central, or hiding the central question.
- A general-purpose frontend test framework.

### Persistence acceptance criteria
These apply after implementation is requested and built.

#### Authentication
1. A person can create an account with email and password, confirm the email, and sign in.
2. An unconfirmed account cannot create or open a saved exploration.
3. A signed-in person can request a password reset and set a new password.
4. The account screens do not offer social login.
5. A signed-in person can sign out. After sign-out, saved explorations are not shown.
6. A signed-out visitor who requests an exploration address cannot read or change a saved exploration.
7. A failed sign-in or registration shows an error on the account screen and does not reveal whether a specific exploration exists.

#### Persistence
8. Saved question text, order, central and satellite roles, priority flags, and Focus perspective origins survive reload and a later sign-in.
9. Mode and completion status are restored with the exploration.
10. The first accepted question creates the exploration. Leaving before that save does not add a library item.
11. A successful save is indicated on screen. A failed save keeps the unsaved change visible, shows an error, and offers retry.
12. A failed load shows an error and retry. It does not show the sample questions, and it does not show an empty exploration as a successful load.
13. Blank and whitespace-only questions are rejected and are not written.
14. A question whose trimmed text is longer than 2,000 characters is rejected and is not written.
15. Node colour is the same for a given question id after reload, and the database row has no colour column.

#### Private sessions
16. The library and an open exploration show only explorations owned by the signed-in user, and only those with at least one question.
17. Ownership is enforced in the database. A second user cannot read, update, or delete the first user's rows by calling the data API directly. pgTAP tests cover select, insert, update, and delete for both users.

#### Reopening
18. A complete exploration can be reopened into review: map or list, full question text, counts, and priority controls.
19. Review of a complete exploration leaves the composer disabled, so new questions are not added.
20. A priority change made during review is saved and is present on the next open.

#### Continuation
21. An in-progress exploration can be continued. Saved questions return in order, and further questions append after them.
22. Ending an in-progress exploration marks it complete, keeps it in the library, and opens review.
23. Starting a new exploration leaves the previous saved exploration in the library and does not insert a row before the new exploration's first question.

#### Rename and deletion
24. Rename stores a trimmed title of at most 120 characters and shows it in the library and in the reopened exploration.
25. A longer or whitespace-only title is rejected, and the stored title is unchanged.
26. Clearing a title restores the fallback display title.
27. Delete asks for confirmation that names the exploration and states that deletion is permanent. Cancel leaves the exploration in place.
28. Confirming delete removes that exploration and its questions from the library and from later loads, and leaves the user's other explorations in place.
29. A failed delete leaves the exploration in the library and shows an error.

#### Preserved behaviour
30. Quickfire still accepts questions in any order, with no category, no required perspective, and no dialog after each question.
31. Focus still offers optional Investigate, Reframe, Connect, and Challenge starters, and free typing still adds a question.
32. A starter-backed Focus question restores the perspective it was given. A freely typed question has none.
33. Switching mode inside an in-progress exploration does not delete its questions.
34. The orbital map is still rendered from the question data.
35. The phase does not call an AI service or add an analysis store.
36. No analytics payload includes question text, titles, or other exploration content.
37. `next.config.mjs` does not set `typescript.ignoreBuildErrors`. `pnpm typecheck` still runs `tsc --noEmit`, and `pnpm build` fails when types are invalid.

#### Question visibility
These apply after the hide controls are requested and built. The database rules are in D-016.

38. A satellite can be hidden and later restored. The row, text, order, role, priority, and perspective origin remain.
39. Hidden questions are absent from the map, the list, and the visible counts, and can be revealed in order to restore one.
40. The central question cannot be hidden. The interface explains that it anchors the exploration and that a different centre means a new exploration.
41. The last visible question cannot be hidden.
42. Hiding or restoring a question in a completed exploration leaves it completed.

## Test data
Test the prototype and, once built, the persistence phase with:

- Short question: "Why do we dream?"
- Long question: "Could the stories we tell ourselves change the way we remember the past?"
- A blank string, a whitespace-only string, and a 2,001-character question.
- A title of 120 characters and a title of 121 characters.
- At least 1, 10, 25, and 100 satellite questions.
- A mix of short and long question text.
- One question from each Focus starter, plus a freely typed Focus question.
- An in-progress exploration and a complete exploration that contains both prioritised and unprioritised questions.
- Two accounts, to confirm one cannot read the other.
