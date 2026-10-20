# Product Brief — Curitopia

## Status
The persistence design is approved. See `docs/DECISIONS.md`. Authentication, saving an exploration, and the previous-explorations library are implemented. Rename and delete are not built.

## Product idea
Curitopia helps people keep asking questions, move beyond their first thought, and see where their thinking leads. The longer aim is to support independent thought, curiosity, and learning through investigation, and to make it easier to find a conversation or a goal in common with someone else. That is an aspiration. The product does not claim to reduce loneliness or polarisation, and those outcomes are not measured here.

Accounts, saved explorations, and the library are already in the application. People can sign in, keep explorations, prioritise questions, and return to them later. Sharing a selection of that work is a later proposal, `docs/STORIES_SPEC.md`. It is not built.

## Core principle
**Ask more questions. Suspend judgement. Discover what comes next.**

The app should encourage exploration rather than evaluate whether a question is clever, correct or valuable. Question volume and the visible journey are more appropriate feedback than a creativity score.

## Two modes

### Quickfire
A low-friction, stream-of-consciousness experience. Users enter questions rapidly and in any order. They do not need to connect, label, or assess them while typing. Saving must stay in the background so capture is not interrupted. Review, priority, and an optional reflection are available on the same exploration without ending it. In the current application this review is count, priority, and the question list.

### Focus
A deliberate exploration of a central question or theme. The theme remains visible while the user adds satellite questions. Optional Investigate, Reframe, Connect, and Challenge starters may help the user explore from another angle. Starters are optional; free entry remains available. Neither mode requires a category on every question.

## Audience and use cases
- Someone who wants to unload a stream of thoughts without organising them immediately.
- Someone exploring a subject, planning an idea, or looking for new perspectives.
- Someone who wants to look back at the questions they generated and notice which ones matter.
- Someone who wants to leave an exploration and resume it later, on a later visit, under their own account.

## Product outcomes
- Adding a question feels fast and frictionless.
- Users can tell which mode they are in.
- The orbital visualisation makes a growing set of questions feel tangible.
- Question text stays readable.
- Users can review what they entered and keep adding questions.
- A signed-in user can find previous explorations, leave one, open another, and return to any of them to continue editing.
- Questions, order, priorities, the central-question role, and Focus perspective origins survive leaving the page.
- Saving, loading, and failure are visible. A failed save does not pretend the exploration was stored.

## Persistence phase
Implemented:

1. Registration with email and password, email confirmation, sign-in, password reset, and sign-out. No social login.
2. Private explorations stored for a signed-in confirmed user. The exploration is created when its first question is saved.
3. Saving and restoring questions, priorities, central and satellite roles, Focus perspective origins, and hidden state.
4. A previous-explorations library that omits empty explorations and opens each exploration at its own URL.
5. Reopening any saved exploration, including one previously marked completed, and continuing to add, hide, restore, and prioritise questions.
6. Continuing an unfinished saved exploration.
7. Clear saving, loading, and error states. Question text is limited to 2,000 characters. A failed save is not reported as stored.
8. An optional focus image for a saved exploration. The person generates one from a prompt they confirm, or uploads a JPEG, PNG, or WebP. The image is stored for that exploration only after they choose Use image. The hosted SQL for the column and private bucket is written and has not been applied.

Specified and not built: renaming an exploration within 120 characters, and permanently deleting one after confirmation.

Approved technical default: Supabase Auth and managed Supabase PostgreSQL, with the existing Next.js application served from Linode at `https://curitopia.com`. The local Supabase stack is for migration tests. See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`. Production hosting on Linode is the intended deployment and is not confirmed complete.

## Proposed next phase
Reflection on one saved exploration is implemented. See `docs/AI_BEHAVIOUR.md` and D-019, as updated by D-020. It is optional, confirmed before any text is sent to OpenAI, and not saved. It does not require the exploration to be marked completed.

Still proposed: cross-session curiosity patterns and interpretation feedback. A recurring interest may later inspire a new exploration. The user would choose whether to pursue it. That path is not built.

A user-authored Experiment workspace is specified in `docs/EXPERIMENT_SPEC.md` and D-022. Phase 1 opens one experiment from a prioritised question. Phase 2 adds, edits, and deletes optional concepts, notes, hypotheses, tests, observations, and discoveries. Neither item editing nor opening an experiment calls a model. Any experiment item may have one thumbnail, including an image generated from a prompt the person submits. The SQL that allows that image on every item type has not been applied. A concept map is not built. AI suggestions remain deferred. Reflection does not start an experiment.

Curitopia Stories, in `docs/STORIES_SPEC.md` and D-025, lets the owner select, arrange, and review a temporary draft from one exploration, then download one silent MP4. It does not post anything, and it does not add music or narration.

## Non-goals
- A clinical or therapeutic tool, or claims of guaranteed stress relief.
- A social network inside Curitopia: public profiles, followers, likes, a public story feed, collaboration, achievements, leaderboards, subscriptions, or social login. Optional download of a reviewed story is proposed in `docs/STORIES_SPEC.md` and is not built. Posting that story to another service is outside the product unless a later decision adds it.
- AI-generated content, semantic analysis, or AI summaries inside Quickfire or Focus capture. Reflection and an optional focus image are separate confirmed actions. The Experiment workspace is user-authored. Phase 1 does not add a model call.
- A complex graph editor or full project-management system.
- Mandatory categorisation of questions.
- Anonymous or unconfirmed persistence, account merging, or moving an in-memory prototype session into an account.

## Product language
Prefer: explore, question, wander, investigate, connect, reflect.
Avoid: creativity score, intelligence score, diagnosis, guaranteed stress relief, claims that the app can exhaust or reset a specific brain system, or claims that it will end loneliness or polarisation.
