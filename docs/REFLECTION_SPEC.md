# Reflection Specification — Proposal

## Status
Proposal for review, dated 2026-10-13. This document does not authorise implementation. Do not add a model, a reflection screen, prompt logs, or an experiments planner until a later task says so. D-017 records the same limit.

Experimentation planning is out of scope. Reflection may name questions worth pursuing. It does not design the experiment.

## When it appears
Reflection is available only after the user finishes a session, or when they deliberately request it on a saved exploration they can already open.

- Quickfire capture stays uninterrupted. The composer does not wait on a model.
- An in-progress exploration can be reflected on only if the user asks. Asking does not complete the exploration and does not disable the composer.
- A completed exploration opens in review, as it does now. Reflection is an additional action on that review, not a replacement for the question list, the map, or priority toggles.
- A new unsaved workspace has nothing to analyse. The action stays unavailable until the first question has been saved.

## Inputs
The model, when one is approved, receives only the exploration the signed-in owner selected.

Included by default:

- Visible question text, in saved order.
- Role: central or satellite.
- Mode: Quickfire or Focus.
- Perspective origin, when one was stored.
- Whether the user marked the question as prioritised.
- The custom title, when one exists. Otherwise the same display title the library already uses.

Excluded by default:

- Hidden questions. A separate control can include them for that request. The default on the next request is still to exclude them.
- Questions belonging to any other exploration.
- Another user's rows.
- Emails, account ids, and analytics payloads.

Prioritisation is passed as the user's preference, with instructions that it is not a score. The reflection must be able to discuss an unprioritised question.

The user's original text is not rewritten before it is stored, and it is not rewritten by the reflection.

## User controls
- Request reflection, or skip it. Finishing a session does not require opening the reflection.
- Include hidden questions, off by default.
- Dismiss the reflection and return to the map, list, and review. Dismissing does not delete questions.
- Try again after a failure. Retry does not duplicate questions.

No control in this proposal edits question text, hides a question, changes priority, completes an exploration, or starts an experiment.

## Outputs
Each reflection is a suggestion. The screen says so in plain language. It does not present the model as having found facts about the user.

The output has five parts, each allowed to be empty when the exploration does not support it:

1. **Themes.** Short groupings of the user's own questions. Each theme names the questions it used.
2. **Possible connections.** Pairs or small sets of questions that may be related, including questions that look unrelated. Each connection quotes or cites the user's questions and says why the link is only a possibility.
3. **Prioritised questions in context.** How the questions the user marked sit among the rest of the visible exploration. This part does not rank unmarked questions as less important.
4. **Unanswered questions.** Questions that still look open. The model does not invent an answer.
5. **Worth pursuing.** A short list of existing questions that may repay research or experimentation, with a one-line reason each. No method, materials, or experiment plan.

Every cited question is one the user wrote. If the model mentions a question that is not in the input, that output is invalid and is not shown.

## Failure states
- **Loading.** The existing exploration remains readable. The reflection area shows that it is working.
- **Refusal or empty model output.** The screen says reflection is unavailable and leaves questions unchanged.
- **Invalid output.** Schema validation fails, a citation does not match a supplied question, or the text claims to be the user's question. Discard that output and show the same unavailable state.
- **Network or provider error.** Show the failure and offer retry. Do not mark the exploration unsaved, and do not change `is_hidden`, priority, mode, or completion.
- **Signed out, or the exploration is no longer readable.** Do not send the request. Show the same not-available result the library already uses for a missing exploration, without the question text.

A failed reflection never replaces the question list with sample questions or with another exploration.

## Privacy
Question text goes to a model only after a later decision names the provider, what is retained, and how the user consents. That consent is separate from creating an account. The request uses the signed-in user's session. It does not use a service-role key. Analytics still must not receive question text, titles, or reflection text.

## Acceptance criteria
These apply only after an implementation task is approved.

1. Quickfire can add several questions with no reflection UI and no model request between them.
2. End session still shows the current review. Reflection is optional there.
3. Requesting reflection does not change question text, ids, positions, roles, origins, priority, hidden flags, or completion.
4. Hidden questions are absent from the request unless Include hidden questions is on.
5. Prioritised questions are described as the user's choices.
6. Each theme, connection, and suggestion cites only questions from that request.
7. An invalid or failed response leaves the exploration as it was and can be retried.
8. Another account's exploration cannot be submitted.
9. Reflection text is not sent to analytics.
10. The screen does not plan an experiment.

## Not in this proposal
- Choosing a model vendor, writing prompts, or adding an API key.
- Storing reflections.
- Rename, delete, or any database migration.
- A timeline, clustering on the map, or new modes.
- An experimentation specification.
