# UX Specification

## Current shell
Preserve the v0-generated dark navy interface:
- Left sidebar with Curitopia identity/tagline.
- Mode selector: Focus and Quickfire.
- Question input and Add Question action.
- Small session statistics.
- Large orbital question map in the main area.
- Existing Map / List / Timeline controls should be preserved if already implemented, but do not add new view modes or invent functionality. If a control is present but not functional, either implement its obvious, in-scope behaviour or clearly disable/remove it only with approval.

## Quickfire flow
1. User selects Quickfire.
2. User can enter and submit a question quickly.
3. Each accepted question is added to the session and the question count updates.
4. The UI should not demand a parent, category, type, or relationship.
5. User can continue adding questions in any order.
6. User selects End Session.
7. Show the collected questions in the circular map and a simple review of the session. For the initial prototype, review can include count and the question list; do not fabricate AI-derived themes.

### Quickfire interaction requirements
- Enter submits when appropriate; Shift+Enter may create a newline if the input is multiline.
- Clear the input after a successful add.
- Keep keyboard focus convenient for repeated entry.
- Prevent blank/whitespace-only questions.
- Avoid modal dialogs or prompts after every question.
- If no questions exist, show a useful empty state.

## Focus flow
1. User starts with a central question/theme.
2. The central question remains visually prominent.
3. User adds satellite questions without mandatory classification.
4. Each new question appears around the centre in the map.
5. Selecting a satellite question highlights it and shows its full text in an accessible detail area or equivalent existing UI.
6. User can continue adding questions at any time.

## Visualisation behaviour
- Render from current question data, not a static screenshot.
- Central question is visually distinct.
- Satellite questions use orbital placement and restrained colour variation.
- Long questions must remain legible and inside their circles.
- Avoid overlaps between circles, labels and the central question.
- Initial viewport should frame the centre and as much of the current map as practical.
- If the full map cannot fit, provide a clear way to pan/zoom only if it can be implemented reliably; do not add fake controls.
- Respect `prefers-reduced-motion`.

## Responsive behaviour
- Desktop: sidebar plus large map.
- Narrow screens: stack or collapse the sidebar naturally; preserve question entry and the map without horizontal page overflow.
- Controls should be usable by keyboard and touch.
- Do not let decorative elements obscure questions or input controls.

## Session statistics
Only show metrics that can be calculated from current data. Initially support question count and, if the existing layout needs it, the number of visual orbits. Do not display made-up counts such as “new directions”, “longest chain”, “furthest from start” or “time exploring” unless they are actually computed from explicit data and their meaning is documented.
