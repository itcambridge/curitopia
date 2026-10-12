# Product Brief — Curitopia

## Status
The persistence design is approved. See `docs/DECISIONS.md`. The prototype in the repository still keeps the exploration in memory until implementation starts. This brief does not authorise migrations or authentication code.

## Product idea
Curitopia helps people keep asking questions, move beyond their first thought, and see where their thinking leads. The next phase turns the prototype into a private, persistent application: people can sign in, keep explorations, prioritise questions, and return to them later.

## Core principle
**Ask more questions. Suspend judgement. Discover what comes next.**

The app should encourage exploration rather than evaluate whether a question is clever, correct or valuable. Question volume and the visible journey are more appropriate feedback than a creativity score.

## Two modes

### Quickfire
A low-friction, stream-of-consciousness experience. Users enter questions rapidly and in any order. They do not need to connect, label, or assess them while typing. Saving must stay in the background so capture is not interrupted. When they finish, Curitopia shows a retrospective view of the questions and a lightweight breakdown of what was captured. In the current prototype, and in the persistence phase, this breakdown is count, priority, and the question list. AI-generated themes remain a later phase.

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
- Users can finish a session and review what they entered.
- A signed-in user can find previous explorations, reopen a finished one for review, and continue an unfinished one.
- Questions, order, priorities, the central-question role, and Focus perspective origins survive leaving the page.
- Saving, loading, and failure are visible. A failed save does not pretend the exploration was stored.

## Persistence phase
The next phase adds:

1. Registration with email and password, email confirmation, sign-in, password reset, and sign-out. No social login.
2. Private explorations stored for a signed-in confirmed user. The exploration is created when its first question is saved.
3. Saving and restoring questions, priorities, central and satellite roles, and Focus perspective origins.
4. A previous-explorations library that omits empty explorations.
5. Reopening a completed exploration for review.
6. Continuing an unfinished saved exploration.
7. Renaming an exploration within 120 characters, and permanently deleting one after confirmation.
8. Clear saving, loading, and error states. Question text is limited to 2,000 characters.

Approved technical default: Supabase Auth and managed Supabase PostgreSQL, with the existing Next.js application served from Linode at `https://curitopia.com`. The local Supabase stack is for migration tests. See `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`. The prototype in the repository still keeps the exploration in memory.

## Non-goals
- A clinical or therapeutic tool, or claims of guaranteed stress relief.
- Social sharing, collaboration, public profiles, achievements, leaderboards, subscriptions, or social login.
- AI-generated content, semantic analysis, or AI summaries in the persistence phase. Those remain a later phase described in `docs/AI_BEHAVIOUR.md`.
- A complex graph editor or full project-management system.
- Mandatory categorisation of questions.
- Reopening a completed exploration in order to add more questions. Completion stays a review state. A further burst of questions is a new exploration.
- Anonymous or unconfirmed persistence, account merging, or moving an in-memory prototype session into an account.

## Product language
Prefer: explore, question, wander, investigate, connect, reflect.
Avoid: creativity score, intelligence score, diagnosis, guaranteed stress relief, or claims that the app can exhaust or reset a specific brain system.
