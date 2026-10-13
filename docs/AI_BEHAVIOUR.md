# AI Behaviour — Deferred

## Current decision
No AI calls are part of the prototype or the persistence phase. Do not add model SDKs, AI API routes, AI API keys, or AI-generated content while accounts and saved explorations are being specified or, later, implemented.

Persistence may store the user's questions so a future phase can analyse an exploration the user chooses to review. This phase does not add analysis tables, prompt logs, embeddings, or jobs that read those questions.

## Potential future use
A later version may use AI to:

- Summarise themes after a Quickfire session.
- Identify possible connections between questions.
- Offer optional Focus prompts beyond the current fixed starters.
- Suggest a concise review of a saved exploration.

That work starts only after persistence is in place and after a separate product and privacy decision. See `docs/DECISIONS.md`.

## Guardrails for a future implementation
- Quickfire capture must remain uninterrupted. Any AI reflection happens after the session, or when the user explicitly asks for a review of a saved exploration.
- Label generated interpretations as suggestions, not facts.
- Preserve the user's original questions unchanged. Generated text lives beside the exploration, in a store specified at that time.
- Never invent questions and present them as user-authored.
- Do not diagnose mental-health conditions or promise therapeutic outcomes.
- Use typed, validated output schemas and graceful failure handling. A failed model call leaves the saved exploration intact.
- Decide privacy, retention, cost, and consent before sending stored question text to an external model. Signing in and saving an exploration is not that consent.
- Send only the exploration the user asked to analyse, for the signed-in owner.
- Exclude hidden questions unless the user explicitly chooses to include them.
- AI analysis must be separately approved and specified before implementation.

## Relationship to saved data
The approved question store keeps text, order, role, priority, and perspective origin. Those fields are sufficient for a later review. Do not add model output columns to `questions` or `explorations` during the persistence phase.
