# MVP Specification and Acceptance Criteria

## MVP scope
Deliver a working local frontend prototype of Curitopia using the current v0 codebase. It must demonstrate Quickfire, Focus, question entry, the SVG orbital map and accurate basic statistics.

## In scope
- Two modes: Quickfire and Focus.
- Add question using a text input/textarea and button.
- In-memory session state.
- Display a central question and satellite question nodes.
- Select a satellite node.
- Basic count based on actual question data.
- A simple Quickfire end-of-session review.
- Responsive layout and accessible keyboard interaction.
- Existing styling preserved and refined only where required for usability.

## Out of scope
- Login, accounts, roles or permissions.
- Database, API, Supabase or any remote persistence.
- AI services or AI-generated question analysis.
- Payments, subscriptions, social features, sharing or collaboration.
- Notifications, analytics or tracking.
- Additional modes or features not requested.

## Acceptance criteria
1. The app starts using the repository's documented development command.
2. The initial screen contains the Curitopia visual identity, mode selector, question entry, statistics and map.
3. A non-empty question can be added by button and keyboard.
4. Blank questions are rejected without adding a node.
5. The displayed count matches the number of questions held in state.
6. Switching modes does not unexpectedly delete the current session.
7. Quickfire accepts questions in any order and does not require categorisation.
8. Ending Quickfire displays the questions and a basic, accurate review.
9. Focus keeps its central question visually prominent while satellites are added.
10. Every full question remains accessible even if its node label is shortened.
11. Circles do not overlap the central node or each other in common test cases; any unavoidable dense-layout limitation is handled gracefully.
12. The initial map view does not accidentally clip the central question.
13. The layout remains usable at desktop and mobile widths without page-level horizontal scrolling.
14. Reduced-motion preferences are respected.
15. No backend, AI service or additional feature is introduced.
16. Lint, type-check, tests and production build are run where scripts exist; actual results are reported.

## Test data
Test with:
- Short question: “Why do we dream?”
- Long question: “Could the stories we tell ourselves change the way we remember the past?”
- A blank string and whitespace-only string.
- At least 1, 10, 25 and 100 satellite questions.
- A mix of short and long question text.
