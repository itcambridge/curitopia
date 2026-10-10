# Test Strategy

## First inspect existing tooling
Read `package.json` and repository configuration to discover actual lint, type-check, test and build scripts. Do not assume a test framework is installed.

## Manual smoke tests
- App starts and loads without console errors.
- Quickfire and Focus can be selected.
- A question can be added by clicking the button and using the keyboard.
- Blank input is rejected.
- Input clears after a successful submission.
- Counts reflect the actual question array.
- Quickfire can be ended and reviewed.
- Focus central question remains visible.
- Selecting a satellite highlights it and exposes its full text.
- No node label is cut off or inaccessible.
- Map fits the initial viewport.
- Layout works at narrow and wide viewport sizes.
- Reduced-motion preference is honoured.

## Layout stress tests
Test 1, 10, 25 and 100 satellite questions, including long text. Check circle overlap, central-node collision, clipping, readable labels and interaction performance.

## Automated tests
Add tests using the repository's existing test tooling if available. At minimum, cover:
- Blank-question validation.
- Adding a question and updating derived counts.
- Mode switching without accidental data loss.
- Quickfire completion.
- Stable question IDs.
- Deterministic layout coordinates for identical inputs.

Do not install a new testing framework without first explaining the need and asking if the dependency would materially change the project.

## Reporting
Report the exact commands run and whether each passed. Separate automated results from manual observations. Never claim a check was run when it was not.
