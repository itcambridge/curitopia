# UX Specification

## Status
The shell, Quickfire, Focus, map, review, and prioritisation behaviours below remain in force. A signed-in user lands on the previous-explorations library. Opening an item loads that exploration. Rename and delete controls are not built yet.

## Current shell
Preserve the v0-generated dark navy interface:

- Left sidebar with Curitopia identity and tagline.
- Mode selector: Focus and Quickfire.
- Question input and Add Question action.
- Small session statistics derived from the open exploration.
- Large orbital question map in the main area.
- Map and List controls. Timeline stays unavailable until a real timeline exists.
- Selected-question panel that shows the full text of the selected question.
- End-of-session review with a priority control on each question.

When an older saved exploration is open, statistics describe that exploration. The prototype heading "Today's exploration" should not imply that a restored exploration happened today.

## Workspace behaviour
This is what the signed-in screens do:

1. Signing in opens the previous-explorations library. It lists that user's saved explorations, most recently updated first, and omits empty ones.
2. New exploration opens an empty Focus workspace and does not insert a row. The first saved question creates the exploration.
3. Opening an item loads that exploration. An in-progress exploration can continue. A completed exploration opens in review.
4. Switching between Focus and Quickfire keeps the current questions and saves the mode once an exploration exists.
5. End session & explore stops entry, shows the review, allows priority toggles, and marks a saved exploration complete.
6. Start new exploration leaves the previous saved exploration in the library and opens another empty workspace.
7. Refreshing an open exploration loads that same exploration. Refreshing a new workspace before the first save stays empty.

## Persistence-phase session lifecycle
A signed-in confirmed user has many explorations. Each saved exploration is either in progress or complete. An unsaved empty workspace is local only.

1. **Start.** New exploration opens the existing workspace in Focus with an empty question list and an empty composer. It does not copy the sample questions, and it does not insert a database row.
2. **Capture.** The user adds questions. The mode switch remains available and does not delete questions. Focus starters remain optional. The composer accepts a question only when the trimmed text is from 1 to 2,000 characters.
3. **Save.** The first accepted question creates the exploration and that question in one save. A title entered before that save is included. Later accepted questions, mode changes, completion, priority changes, and hide or restore update that exploration. The screen shows a quiet status: Saving, Saved, or Could not save. Quickfire does not show a dialog after a question. Rename is specified below and is not built.
4. **Leave.** Closing or signing out before the first successful save leaves the library unchanged. After a successful save, the exploration remains in the library.
5. **Finish.** End session & explore marks the exploration complete, shows the review, and enables priority toggles. The exploration stays in the library.
6. **Review.** Opening a complete exploration restores the map, list, full text, counts, and priority controls. The composer stays disabled. Priority changes are saved.
7. **Continue.** Opening an in-progress exploration restores questions in entry order and enables the composer. New questions append after the saved ones.
8. **Start another.** Start new exploration opens another unsaved workspace. The previous saved exploration remains in the library.
9. **Rename.** Specified, and not built. The user will be able to set or clear a title on a saved exploration. The trimmed title is at most 120 characters. A whitespace-only title is rejected. Clearing the title removes the custom name.
10. **Delete.** Specified, and not built. Delete will ask for confirmation and state that deletion is permanent. Confirming removes that exploration and its questions. Cancelling leaves it unchanged.

A complete exploration stays in review. Adding further questions means starting a new exploration.

## Hiding and restoring a question
This behaviour is available in the workspace. The hosted database already has `is_hidden`.

A person can hide a satellite question and later restore it. Hiding keeps the row. Text, id, position, role, priority, perspective origin, and derived colour stay as they were. Hidden questions are left out of the normal map, the list, and the visible question counts. The interface provides a way to reveal hidden questions and restore one.

The central question cannot be hidden. Its Hide control is disabled, and selecting it explains: "The central question anchors this exploration. Start a new exploration to explore a different central question." The database does not promote a satellite into the central role.

The last visible question cannot be hidden. Its Hide control is disabled. Quickfire can therefore hide satellites until one remains. Focus can hide satellites while the central question stays visible. Hide and Restore sit beside the question in the list and do not select it. If the database rejects a hide, the question stays visible and the screen says why, without discarding the exploration. Other save failures keep the existing Could not save state and retry.

Hiding or restoring a question in a completed exploration does not reopen it. The composer stays disabled, and the exploration remains complete.

Sign-out while a save has failed asks the user to confirm before discarding the unsaved change. Sign-out after a successful save, or before any question has been saved, returns to the signed-out screen and shows no exploration content.

## Previous explorations
Signed-in home is the previous-explorations library. The workspace opens from an item in that library or from New exploration.

The library shows only the signed-in user's saved explorations, most recently updated first. An exploration appears only after its first question has been saved. Empty workspaces are omitted.

Each item shows:

- Display title.
- Mode: Focus or Quickfire.
- Status: In progress or Complete.
- Question count: visible questions only. When some questions are hidden, the row also shows that hidden count.
- When it was last updated.

Actions on each item:

- **Continue** for an in-progress exploration.
- **Review** for a complete exploration.
- **Rename.** Specified, not built.
- **Delete**, which would open confirmation first. Specified, not built.

Display title is the user's title when they have set one. Otherwise it is the visible central question, otherwise the first visible question, otherwise "Untitled exploration". A long fallback is shortened on the library row; the full question remains available inside the exploration.

Empty library: explain that explorations will appear here, and offer New exploration.

Loading: show a loading status and do not show another person's data, sample questions, or a false empty library.

Load error: show an error and a retry action. Do not replace a failed load with an empty exploration.

A signed-out request for an exploration route shows the account screen and includes no saved question text. A signed-in user whose email is not confirmed cannot open or create a saved exploration. For a confirmed user, an unknown id and another user's id show the same not-found state.

Leaving a new workspace before the first question is saved does not add a library item.

Delete confirmation names the exploration and states that deletion is permanent and cannot be undone. The actions are Delete and Cancel. While the delete is in progress, the confirm action shows a pending state. If deletion fails, the item stays in the library and an error is shown.

Rename edits the title and saves it. The trimmed title must be from 1 to 120 characters. A whitespace-only or longer title is rejected and the previous title stays. Clearing the title removes the custom name and the display title falls back as above.

The library and the workspace both offer sign-out.

## Account entry
Signed-out visitors see registration, sign-in, and password reset. They do not see saved explorations. There is no social login and no guest exploration that is stored in the database.

- Create account asks for email and password.
- After registration, the screen tells the person to confirm the email before explorations can be saved.
- Sign in asks for email and password. An unconfirmed account cannot open the library.
- Password reset asks for the account email, then accepts a new password from the confirmation link.
- Errors remain on the form.
- A successful sign-in with a confirmed email opens the library.
- Sign-out returns to the signed-out screen.

## Quickfire flow
1. User selects Quickfire.
2. User can enter and submit a question quickly.
3. Each accepted question is added to the exploration and the question count updates.
4. The UI does not demand a parent, category, type, or relationship.
5. User can continue adding questions in any order.
6. User selects End session & explore.
7. Show the collected questions in the circular map and a simple review. Review includes the question count, the prioritised count, and the question list. Priority can be toggled in this review. Do not fabricate AI-derived themes.

### Quickfire interaction requirements
- Enter submits when appropriate; Shift+Enter may create a newline if the input is multiline.
- Clear the input after a successful add.
- Keep keyboard focus convenient for repeated entry.
- Prevent blank or whitespace-only questions.
- Reject a question whose trimmed text is longer than 2,000 characters, without adding it and without a modal.
- Avoid modal dialogs or prompts after every question. A save failure uses a non-blocking status and retry, not a modal per question.
- If no questions exist, show a useful empty state.
- Unsubmitted text in the composer is not a saved question. Refresh may clear the composer.

## Focus flow
1. User starts with a central question or theme. The first question in an empty Focus exploration is the central question.
2. The central question remains visually prominent.
3. User adds satellite questions without mandatory classification.
4. Optional perspective controls offer Investigate, Reframe, Connect, and Challenge. Choosing one may insert a starter into the composer. The user can edit or replace that text before adding it. Free typing remains available when no starter is selected.
5. A question added from a starter records that perspective origin. A freely typed question does not.
6. Each new question appears around the centre in the map.
7. Selecting a question highlights it and shows its full text in the selected-question panel.
8. User can continue adding questions at any time until the exploration is ended.
9. Switching to Quickfire hides the perspective controls and does not attach a perspective origin to new questions. Questions already added keep the origin they had.

## Saving, loading, and errors
- The open exploration remains visible while a save is in flight.
- Saved means the latest accepted change has been stored.
- Could not save keeps the change on screen and offers retry. The local change remains until the save succeeds or the user discards it through the sign-out confirmation.
- Could not load does not render sample questions and does not treat failure as an empty exploration.
- Counts shown on screen match the questions currently held for that exploration.

## Visualisation behaviour
- Render from current question data, not a static screenshot.
- When a question has the central role, it is the visual hub.
- When no question has the central role, as in Quickfire, the first question is the visual hub. That display choice does not change the question's stored role.
- Satellite questions use orbital placement and restrained colour variation. Colour is decorative. The prototype stores a colour chosen when the question is added. The approved persistence design derives colour from the stable question id, as described in `docs/DATA_MODEL.md`, and does not store it.
- Long questions must remain legible and inside their circles.
- Avoid overlaps between circles, labels, and the central question.
- Initial viewport should frame the centre and as much of the current map as practical.
- If the full map cannot fit, provide a clear way to pan or zoom only if it can be implemented reliably.
- Respect `prefers-reduced-motion`.
- A restored exploration uses the same layout rules as a newly entered one, so a given saved order produces the same map.

## Responsive behaviour
- Desktop: sidebar plus large map.
- Narrow screens: stack or collapse the sidebar naturally; preserve question entry and the map without horizontal page overflow.
- The library is usable at desktop and mobile widths.
- Controls should be usable by keyboard and touch.
- Do not let decorative elements obscure questions or input controls.
- Confirmation actions are reachable by keyboard.

## Session statistics
Only show metrics that can be calculated from the open exploration. Support question count and the number of visual orbits. Do not display made-up counts such as "new directions", "longest chain", "furthest from start", or "time exploring" unless they are computed from explicit data and their meaning is documented.
