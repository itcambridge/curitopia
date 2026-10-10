# Data Model — MVP

## Runtime model
Use a typed in-memory model that fits the current codebase. No database is required for this MVP.

## Suggested types

```ts
export type CuritopiaMode = "quickfire" | "focus";

export interface Question {
  id: string;
  text: string;
  createdAt: number;
  role: "central" | "satellite";
  isPrioritised: boolean;
}

export interface ExplorationSession {
  id: string;
  mode: CuritopiaMode;
  centralQuestionId: string | null;
  questions: Question[];
  status: "active" | "completed";
  startedAt: number;
  endedAt?: number;
}
```

Treat this as a suggested contract, not a mandate to replace an existing compatible model. Adjust names to match the current code if appropriate.

## Rules
- Store the full question text.
- IDs must be stable and unique.
- Counts are derived from `questions.length`.
- `isPrioritised` is stored on each question and defaults to `false`. The prioritised count is derived from the question list. Priority is set only after a session ends and does not change text, order or `role`.
- In Quickfire, questions may have no semantic relationship to one another.
- In Focus, the central question is explicitly identified; do not pretend all satellites have meaningful parent links unless the user has created those links.
- Completion is a session state, not deletion.
- Do not store passwords, credentials or unnecessary personal data.
- Do not add localStorage or other persistence unless requested; the current MVP can use React state and clearly disclose that a refresh may reset the session.
