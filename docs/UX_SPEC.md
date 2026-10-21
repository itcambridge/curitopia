# UX Specification

## Status
The shell, Quickfire, Focus, map, review, and prioritisation behaviours below remain in force. A signed-in user lands on the previous-explorations library. Opening an item loads that exploration. Rename and delete controls are not built yet.

## Current shell
Preserve the v0-generated dark navy interface:

- Left sidebar for creating questions: Curitopia identity, home and sign-out icons, the Map and List switch, mode selector, question input, and the optional Flip perspective starters.
- Centre canvas for the exploration: a compact title and summary, and the orbital question map. Review hides from a compact control beside Close in the review header. While it is hidden, Show review sits with the sidebar navigation. Focus image, Hide image, and Dim image sit under the sidebar controls. A configured Focus Image sits behind the map.
- Right sidebar for review: the selected question, hidden questions, the question list and priority controls, and AI reflection. It scrolls on its own and can be collapsed. Below 1180px it opens as a drawer so the map is not squeezed between three columns.
- A timeline view is not shown until one exists.
- Review stays available while the exploration is still being edited.

When an older saved exploration is open, statistics describe that exploration. The prototype heading "Today's exploration" should not imply that a restored exploration happened today.

## Workspace behaviour
This is what the signed-in screens do:

1. Signing in opens the previous-explorations library. It lists that user's saved explorations, most recently updated first, and omits empty ones.
2. New exploration opens an empty Focus workspace and does not insert a row. The first saved question creates the exploration.
3. Opening an item loads that exploration. Every saved exploration can be edited, including one that was previously marked completed.
4. Switching between Focus and Quickfire keeps the current questions and saves the mode once an exploration exists.
5. All explorations returns to the library. It does not change the open exploration's questions or status.
6. Start new exploration, from the library, leaves the previous saved exploration in the library and opens another empty workspace.
7. Refreshing an open exploration loads that same exploration. Refreshing a new workspace before the first save stays empty.

## Persistence-phase session lifecycle
A signed-in confirmed user has many explorations. Each saved exploration remains editable. An unsaved empty workspace is local only. The database may still store `status` as `active` or `completed` for older rows. That value does not lock the workspace.

1. **Start.** New exploration opens the existing workspace in Focus with an empty question list and an empty composer. It does not copy the sample questions, and it does not insert a database row.
2. **Capture.** The user adds questions. The mode switch remains available and does not delete questions. Focus starters remain optional. The composer accepts a question only when the trimmed text is from 1 to 2,000 characters. A new question is saved with one question mark at the end. An existing question is not rewritten.
3. **Save.** The first accepted question creates the exploration and that question in one save. A title entered before that save is included. Later accepted questions, mode changes, priority changes, and hide or restore update that exploration. The screen shows a quiet status: Saving, Saved, or Could not save. Quickfire does not show a dialog after a question. Rename is specified below and is not built.
4. **Leave.** All explorations returns to the library without completing, resetting, or locking the open exploration. Closing or signing out before the first successful save leaves the library unchanged. After a successful save, the exploration remains in the library.
5. **Review.** The workspace shows the map, list, full text, counts, and priority controls while questions can still be added. Priority changes are saved.
6. **Continue.** Opening any saved exploration restores questions in entry order and leaves the composer enabled. New questions append after the saved ones. A row previously marked completed stays editable, and opening it does not change its stored status.
7. **Start another.** Start new exploration, from the library, opens another unsaved workspace. The previous saved exploration remains in the library.
8. **Rename.** Specified, and not built. The user will be able to set or clear a title on a saved exploration. The trimmed title is at most 120 characters. A whitespace-only title is rejected. Clearing the title removes the custom name.
9. **Delete.** Specified, and not built. Delete will ask for confirmation and state that deletion is permanent. Confirming removes that exploration and its questions. Cancelling leaves it unchanged.

Leaving an exploration does not complete it. A row that is already `completed` stays `completed` until a later, separate decision changes that column. The workspace still accepts new questions.

## Reflection
On a saved exploration, Review offers Reflect on this exploration. The composer stays available. Choosing reflection explains that the visible questions, prioritisation, and Focus perspective origins will be sent to OpenAI. Cancel sends nothing. Confirm shows a loading state, then up to five suggested questions under "Questions to explore next". Those questions are labelled as suggestions the user did not write. Each one can be copied or added to the same exploration. A failure shows the error and Retry. The result is not saved. If the question set changes after a reflection is shown, the result stays visible and is marked as an earlier set, so it is not mistaken for suggestions about the current questions. Hidden questions are not sent. An exploration with more than 80 visible questions explains the limit and sends nothing.

## Focus image
A saved exploration can have one optional background image. The control is Focus image, on the map. It does nothing until the exploration has been saved, and it does not generate an image when a question is added.

The panel offers two ways to propose an image. Generate starts from an editable prompt inspired by the central question, or by the first visible question when there is no central question. The person can replace that prompt. Generate is the confirmation: the panel says the prompt will be sent to OpenAI and that API usage may incur a cost. Opening the panel or editing the prompt sends nothing. The request contains that prompt only. Upload accepts a JPEG, PNG, or WebP from the device and does not send the file to OpenAI. The server checks the file type, size, and image header.

Either path shows a preview. Use image stores it for that exploration. Cancel, or choosing another image, leaves the current background as it was. Remove image clears it. Hide image and Dim image change only the current view. With no image, or while the image is hidden, the map uses the existing navy background.

The question map stays in front of the image. The image does not receive pointer events. A dark veil keeps the nodes readable, and Dim image darkens it further. If the image cannot be loaded, the navy background remains and the screen offers another attempt.

The hosted database does not have this column until `supabase/scripts/add_focus_image.sql` is run in the SQL Editor. Until then, the exploration still opens and the image cannot be saved.

## Experiment (proposed)
Not built. Product direction is agreed in D-022. Implementation waits for a later approval. The full proposal is `docs/EXPERIMENT_SPEC.md`.

The owner of a saved exploration marks a question as important and chooses Investigate further. That opens one experiment for that question, with the question as the centre, at `/explorations/[id]/experiments/[experimentId]`. The question is a large sphere. The constellation uses most of the space under that heading. When the exploration has a Focus Image, the same image sits behind the experiment, dimmed, and Hide image or Dim image on this page does not change the exploration. Saved concepts, notes, hypotheses, tests, observations, and discoveries are smaller spheres around it, in saved order. A list shows the same items. Opening a sphere shows the full text, with edit and delete. Every saved item shows Add image, or Replace image and Remove image. Add thought creates any of the six kinds and shows those image controls for each type. None is required. A line is shown only when an item is explicitly related to another. A saved image covers that item's sphere. An item without an image keeps the text sphere. The user does not have to drag anything.

Leaving the experiment returns to the same exploration. The exploration stays editable. Its questions, priorities, hidden state, mode, and `status` are unchanged. The library remains a list of explorations. The experiment is reopened from its question.

This is not the Focus starter named Investigate, and it is not an AI plan. Reflection does not create an experiment. No model is called. A test is a practical, low-risk action the user describes. The screen must not encourage an unauthorised production change.

## Hiding and restoring a question
This behaviour is available in the workspace. The hosted database already has `is_hidden`.

A person can hide a satellite question and later restore it. Hiding keeps the row. Text, id, position, role, priority, perspective origin, and derived colour stay as they were. Hidden questions are left out of the normal map, the list, and the visible question counts. The interface provides a way to reveal hidden questions and restore one.

The central question cannot be hidden. Its Hide control is disabled, and selecting it explains: "The central question anchors this exploration. Start a new exploration to explore a different central question." The database does not promote a satellite into the central role.

The last visible question cannot be hidden. Its Hide control is disabled. Quickfire can therefore hide satellites until one remains. Focus can hide satellites while the central question stays visible. Hide and Restore sit beside the question in the list and do not select it. If the database rejects a hide, the question stays visible and the screen says why, without discarding the exploration. Other save failures keep the existing Could not save state and retry.

Hiding or restoring a question does not change `status` or `ended_at`. The composer stays available.

Sign-out while a save has failed asks the user to confirm before discarding the unsaved change. Sign-out after a successful save, or before any question has been saved, returns to the signed-out screen and shows no exploration content.

## Previous explorations
Signed-in home is the previous-explorations library. The workspace opens from an item in that library or from New exploration.

The library shows only the signed-in user's saved explorations, most recently updated first. An exploration appears only after its first question has been saved. Empty workspaces are omitted.

Each item shows:

- Display title.
- Mode: Focus or Quickfire.
- Question count: visible questions only. When some questions are hidden, the row also shows that hidden count.
- When it was last updated.

Actions on each item:

- **Continue** for every saved exploration.
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
6. The map and review stay available while questions are added. Review includes the question count, the prioritised count, and the question list. Priority can be toggled there. Optional reflection is separate and asks before anything is sent. Do not fabricate AI-derived themes.

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
8. User can continue adding questions at any time.
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
- Wide screens, from 1180px: three columns. The sidebars have a maximum width and the map uses the space between them. Collapsing review gives that width back to the map.
- From 901px to 1179px: the create sidebar stays beside the map, and review opens over the map as a drawer.
- At 900px and below: the map comes first, at about three quarters of the viewport height, and the question composer follows. Review stays a drawer opened from the map bar. Question entry and the map stay usable without horizontal page overflow.
- The library is usable at desktop and mobile widths.
- Controls should be usable by keyboard and touch.
- Do not let decorative elements obscure questions or input controls.
- Confirmation actions are reachable by keyboard.

## Curitopia Stories
**Approved.** Select, arrange, and review are in the application from **Create a Story** on the experiment for a saved exploration. Artwork is created for one slide after confirmation. **Download video (MP4)** saves one silent 9:16 video in the browser. D-025 and `docs/STORIES_SPEC.md`.

From that experiment the owner chooses **Create a Story** for the parent exploration, then:

1. See questions and experiment items from that exploration offered for selection. Hidden questions are omitted. Nothing is included until the person selects it.
2. Choose an opening question, any starred or other questions they want, and any concepts, hypotheses, tests, observations, or discoveries they want to show.
3. Review a sequence of slides. Edit subtitles, replace images, and reorder slides. The full question stays on a question slide.
4. Preview the slides as they will export.
5. Download one 9:16 image file per slide. PDF is excluded. Download does not upload or publish the files. An optional Curitopia mark can be left off.
6. Cancel or discard the draft at any point. The draft lives only in the browser, so a refresh or a closed tab can discard it. Discarding it does not change questions, priorities, experiment items, thumbnails, or the Focus Image.

Hidden questions stay out, with no control to add them. A closing question, if any, is written by the person. The full question stays on a question slide. These limits are **Approved**. Phase 1 and Phase 2 are in the application. Download is not. The detail is `docs/STORIES_SPEC.md`.

## Session statistics
Only show metrics that can be calculated from the open exploration. The workspace header shows the question count and the number of visual orbits. Do not display made-up counts such as "new directions", "longest chain", "furthest from start", or "time exploring" unless they are computed from explicit data and their meaning is documented.
