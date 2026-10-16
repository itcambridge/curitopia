# Reflection Specification — Proposal

## Status
Stage A, for one saved exploration, is implemented as described in D-019 and D-020. The screen offers Reflect on this exploration without requiring the exploration to be completed. The user confirms before any question text is sent to OpenAI. The result is a suggestion kept in the page, not in the database. If questions change afterwards, the suggestion is marked as an earlier set.

Still proposed, and not implemented: an include-hidden control, "That resonates" / "Not quite" feedback, Level 3 as a stored interest, and Stage B cross-session analysis. D-017 and D-018 remain proposals for those parts. A user-authored Experiment workspace is specified separately in `docs/EXPERIMENT_SPEC.md` and is not started from reflection.

The implemented response is up to five new questions, under the heading "Questions to explore next". Fewer than five is valid. Each suggestion is labelled as a question the user did not write, and each one can be copied or added to the same exploration. The response does not include an overview, themes, a connections report, or notes on prioritised questions.

## When it appears
Reflection is available on a saved exploration the user can already open. It does not replace the composer.

- Quickfire capture stays uninterrupted. The composer does not wait on a model.
- Review and reflection sit with the exploration while questions can still be added.
- A new unsaved workspace has nothing to analyse. The action stays unavailable until the first question has been saved.
- After the visible question set changes, an existing result is marked stale. It is not presented as a reflection of the current questions.

## Inputs
Stage A sends only the exploration the signed-in owner selected. Stage B, if a later task builds it, sends only the explorations that owner has just included, after the screen shows that scope.

Included by default:

- Visible question text, in saved order.
- Role: central or satellite.
- Mode: Quickfire or Focus.
- Perspective origin, when one was stored. The values are Investigate, Reframe, Connect, and Challenge.
- Whether the user marked the question as prioritised.
- The custom title, when one exists. Otherwise the same display title the library already uses.

These signals are not the same kind of evidence, and none of them proves an underlying interest:

- Question text shows what was explored.
- Prioritisation shows what the user chose to mark. It is a preference, not a score. The reflection must be able to discuss an unprioritised question.
- Perspective origin shows which optional Focus starter filled the composer. A question typed freely has no origin. An origin is not a measure of importance.
- Feedback on an earlier reflection, once a later approved policy stores it, shows whether that interpretation resonated. Stage A does not require that store. Absence of feedback means nothing.

Excluded by default:

- Hidden questions. A separate control can include them for that request. The default on the next request is still to exclude them.
- In Stage A, every other exploration. Stage B may include other explorations only after the user selects that scope.
- Another user's rows.
- Emails, account ids, and analytics payloads.

The user's original text is not rewritten before it is stored, and it is not rewritten by the reflection.

## User controls
- Request reflection, or skip it. Finishing a session does not require opening the reflection.
- Include hidden questions, off by default.
- Dismiss the reflection and return to the map, list, and review. Dismissing does not delete questions.
- Try again after a failure. Retry does not duplicate questions.

On a proposed pattern, the user can answer "That resonates.", "Explore the connection.", or "Not quite." Disagreeing takes one action. It is not treated as proof that the interpretation was secretly correct. "Explore the connection." shows the cited questions and the proposed link again. It does not start an experiment and does not rewrite the questions.

No control in this proposal edits question text, hides a question, changes priority, or starts an experiment. Adding a suggested question is a separate, explicit action and creates a normal question.

## Outputs
The implemented result is a suggestion, not a finding about the user. The screen says the questions were suggested and that the user did not write them.

The response is a list of at most five new questions. It may be shorter, including empty, when the exploration does not support five distinct directions. The model is instructed not to add filler. The screen does not show a summary of the exploration, a grouping of existing questions, a separate connections report, or an analysis of which questions were prioritised.

A suggestion is dropped when it repeats another suggestion, or when it matches a visible question after a simple text normalisation: trim, collapse spaces, ignore capitalisation, and ignore a trailing question mark. That check does not identify every paraphrase. The instructions also tell the model not to rephrase a question that is already present. A malformed response is not shown.

The sections below remain a proposal for a later task. They are not part of the current response.

1. **Themes.** Short groupings of the user's own questions. Each theme names the questions it used.
2. **Possible connections.** Pairs or small sets of questions that may be related, including questions that look unrelated. Each connection quotes or cites the user's questions and says why the link is only a possibility.
3. **Prioritised questions in context.** How the questions the user marked sit among the rest of the visible exploration. This part does not rank unmarked questions as less important.
4. **Unanswered questions.** Questions that still look open. The model does not invent an answer.
5. **Worth pursuing.** A short list of existing questions that may repay research or experimentation, with a one-line reason each. No method, materials, or experiment plan.

Every cited question is one the user wrote. If the model mentions a question that is not in the input, that output is invalid and is not shown. A pattern with too little support is withheld. The screen says the evidence is insufficient rather than stating a weak pattern as if it were established. There is no fixed minimum number of sessions. That threshold would need testing before anyone sets it.

## Recurring interests and curiosity patterns
This is a distinct proposed capability. Its job is to help the user notice what they repeatedly explore. It does not tell them what they think or why they think it. The user decides whether an interpretation resonates.

Each meaningful pattern shows a short description, the questions or sessions that support it, the connection the model sees, and language that keeps the claim tentative. It is an invitation to explore, not a finding.

### Level 1 — Recurring topics
Name a subject or concept that appears more than once in the material being analysed. A single-session example: "Several of these questions return to consciousness." A later cross-session example: "You've returned to questions about consciousness in several explorations." Show the original questions. Do not report a topic that appears only as a stretched reading of one question.

### Level 2 — Connecting interests
Suggest a possible relationship between questions that may look unrelated. Example: "Your questions about dreams, spirituality and reality may share a broader theme: how we distinguish experience from what we can know to be true." Explain the proposed connection and cite the questions that support it. Call the link possible.

### Level 3 — Possible deeper interests
Offer a tentative reading of what the user may be drawn to understanding. Example: "You may be particularly interested in how people distinguish what they believe from what they can know." Frame it as a hypothesis. Do not present it as a psychological fact, a diagnosis, a personality assessment, or a discovery about unconscious motivation.

Level 3 still cites the questions it used. If those questions do not support the reading, the reading is invalid and is not shown.

## Two stages
### Stage A — Questions to explore next
This is the implemented reflection. It starts from the exploration the user is reviewing and suggests up to five questions that could move the exploration forward. Questions from other explorations are not included. The proposed theme, connection, and deeper-interest levels above are not part of this response.

### Stage B — Cross-session curiosity patterns
A later extension. The user explicitly asks to analyse selected previous explorations, or their exploration history. Before the request is sent, the screen states the scope in plain language, including how many explorations are included and that hidden questions are excluded unless the user turns that option on.

Stage B does not run silently across every session. It reads only explorations the signed-in owner can already open. Row-level security remains the boundary. One user's questions are never sent or shown as part of another user's reflection. Proposed themes still cite the supporting questions. The user can reject, correct, or explore a suggested pattern. If the selected material is too thin for a reliable pattern, the screen says so.

## From a pattern to a later exploration
A possible future path is: recurring theme, then an interesting question, then a question the user prioritises, then a deliberate new exploration, then an optional investigation. This proposal stops before that investigation. The user chooses whether a pattern becomes a new exploration. Reflection does not open an experiment on their behalf and does not write the investigation plan. The experiment workspace, if later approved, is `docs/EXPERIMENT_SPEC.md`.

## Failure states
- **Loading.** The existing exploration remains readable. The reflection area shows that it is working.
- **Refusal or empty model output.** The screen says reflection is unavailable and leaves questions unchanged.
- **Invalid output.** The response is not the expected object, or a suggestion is too long to be a question. Discard that output and show the same unavailable state. A suggestion that copies a visible question is omitted; the rest of a valid list can still be shown.
- **Network or provider error.** Show the failure and offer retry. Do not mark the exploration unsaved, and do not change `is_hidden`, priority, mode, or completion.
- **Signed out, or the exploration is no longer readable.** Do not send the request. Show the same not-available result the library already uses for a missing exploration, without the question text.

A failed reflection never replaces the question list with sample questions or with another exploration.

## Privacy
Question text goes to a model only after a later decision names the provider, what is retained, and how the user consents. That consent is separate from creating an account. The request uses the signed-in user's session. It does not use a service-role key. Analytics still must not receive question text, titles, or reflection text.

The analysis reads question content. It does not look for hidden psychological traits. It does not diagnose a mental-health condition, infer trauma, or state sensitive beliefs or motivations as facts. A recurring theme is not stored as a durable profile of the user unless a later task approves that data policy. Generated insights are suggestions. The user remains the authority on what their curiosity means.

## Acceptance criteria
These apply only after an implementation task is approved.

1. Quickfire can add several questions with no reflection UI and no model request between them.
2. Review and optional reflection are available while questions can still be added. Adding a question after a reflection marks that result as an earlier set.
3. Requesting reflection does not change question text, ids, positions, roles, origins, priority, hidden flags, or `status`.
4. Hidden questions are absent from the request unless Include hidden questions is on.
5. The result contains at most five new questions and does not include a summary, themes, a connections report, or notes on prioritised questions.
6. A suggestion that copies a visible question, or repeats another suggestion, is not shown. Simple text comparison does not catch every paraphrase.
7. An invalid or failed response leaves the exploration as it was and can be retried.
8. Another account's exploration cannot be submitted.
9. Reflection text is not sent to analytics.
10. The screen does not plan an experiment.
11. A pattern cites the questions it used, uses tentative language for a deeper interest, and is withheld when the evidence is insufficient.
12. "Not quite." dismisses that pattern without changing the saved questions and without treating the disagreement as confirmation.
13. Stage A does not send questions from any other exploration.

Stage B is not part of the first implementation. When a later task approves it, that task also has to show the scope before the request, keep hidden questions out unless included, refuse another user's rows, and avoid storing a standing profile unless that storage is part of the approved design.

## Not in this proposal
- Choosing a model vendor, writing prompts, or adding an API key.
- Storing reflections, feedback, or a cross-session profile. Stage A does not need that store. A later task may propose one only with an explicit retention policy.
- Implementing Stage B.
- Rename, delete, or any database migration.
- A timeline, clustering on the map, or new modes.
- Adding experiment items, thumbnails, or AI suggestions. Phase 1 lives in `docs/EXPERIMENT_SPEC.md`. Reflection still does not start an experiment or write an investigation plan.
