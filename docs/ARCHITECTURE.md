# Architecture Notes

## Important
This is an initial direction, not permission to replace the current implementation. First inspect the existing source, package manifest and dependencies. Document what is already present, then keep the simplest architecture that meets the MVP requirements.

## Intended prototype architecture
- Next.js App Router if that is what the current repository uses.
- React and TypeScript for UI and state.
- Existing styling approach (likely Tailwind CSS; verify before assuming).
- SVG for the orbital question map.
- Local component state for session questions.
- No backend or external AI dependency in the MVP.

## Suggested component boundaries
Adapt names to the current codebase; do not duplicate existing components.
- `ModeSelector`: Quickfire / Focus selection.
- `QuestionComposer`: input and Add Question behaviour.
- `SessionStats`: calculated count(s).
- `QuestionUniverse` or equivalent: SVG map and node rendering.
- `QuestionNode`: one question circle and its label.
- `QuickfireReview`: end-of-session review.
- `AppShell` / sidebar: use the existing shell if present.

## State and data flow
The question list is the source of truth. Statistics and the map are derived from it. Do not maintain independent counters that can drift out of sync.

A question should have a stable ID, full text, creation order/timestamp if useful, and an explicit role as central question or satellite. Do not infer semantic parent-child relationships in the MVP unless the UI actually records them.

## Rendering and performance
- Keep layout calculation separate from rendering where practical.
- Use stable IDs and stable layout coordinates.
- Do not call random number generation on every React render.
- Avoid adding a physics engine unless the existing implementation clearly requires one.
- 100 nodes should remain usable. Prefer a predictable layout and responsive scaling over elaborate simulation.
- Do not introduce libraries without explaining why they are necessary.

## Later, not now
Possible later additions include persistence, account support, semantic clustering and AI-generated summaries. These require separate product and architecture decisions and are excluded from the current MVP.
