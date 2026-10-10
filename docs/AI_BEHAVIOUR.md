# AI Behaviour — Deferred

## Current decision
No AI calls are part of the initial prototype. Do not add model SDKs, API routes, API keys, environment variables or AI-generated content.

## Potential future use
A later version may use AI to:
- Summarise themes after a Quickfire session.
- Identify possible connections between questions.
- Offer optional Focus prompts.
- Suggest a concise review of the exploration.

## Guardrails for a future implementation
- Quickfire capture must remain uninterrupted; any AI reflection happens after the session.
- Label generated interpretations as suggestions, not facts.
- Preserve the user's original questions unchanged.
- Never invent questions and present them as user-authored.
- Do not diagnose mental-health conditions or promise therapeutic outcomes.
- Use typed, validated output schemas and graceful failure handling.
- Establish privacy, retention, cost and consent decisions before sending user content to an external model.
- AI analysis must be separately approved and specified before implementation.
