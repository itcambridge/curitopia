# AI Behaviour — Proposed Next Phase

## Current decision
No AI calls are part of the running application. Do not add model SDKs, AI API routes, AI API keys, or AI-generated content until a separate task approves that work.

Accounts, saved explorations, the library, and hiding are implemented. Reflection is the proposed next product phase. `docs/REFLECTION_SPEC.md` describes the experience for review. It is not permission to build it. D-008 and D-017 record that limit.

This phase does not add analysis tables, prompt logs, embeddings, or jobs that read questions.

## What reflection is for
When the user asks, or after they finish a session, reflection should help them:

- Notice recurring themes across their questions.
- See possible connections between questions that do not look related.
- Read their prioritised questions in the context of the wider exploration.
- Notice important questions that are still unanswered.
- Decide which questions may be worth pursuing through further research or experimentation.

The last item stops at the suggestion. How an experiment would be planned is a separate future specification. Do not add that planner inside the reflection phase.

## Design principles
- Preserve original user-authored questions unchanged. Generated text lives beside the exploration, in a store specified when implementation is approved.
- Treat interpretations as suggestions, never facts. Label them that way in the interface.
- Treat prioritisation as a preference signal. A starred question is one the user chose to mark. It is not an objective measure of importance, and an unstarred question is not unimportant.
- Exclude hidden questions by default. Include them only when the user explicitly chooses that control for that reflection.
- Keep Quickfire capture uninterrupted. No coaching, themes, or model calls while questions are being entered. Analysis happens after End session, or when the user deliberately requests reflection on a saved exploration.
- Preserve privacy and ownership. Send only the exploration the signed-in owner asked to analyse. Signing in and saving an exploration is not consent to send question text to a model. Decide the provider, retention, cost, and consent before any call.
- Do not send question text, titles, or other exploration content to analytics.
- When AI is eventually implemented, validate model output against a typed schema, handle failure without changing the saved exploration, and show a loading state that does not block reading the questions.
- Do not diagnose mental-health conditions or promise therapeutic outcomes.
- Never invent questions and present them as user-authored.

## Relationship to saved data
The question store already keeps text, order, role, priority, perspective origin, and `is_hidden`. Those fields are the inputs. Do not add model-output columns to `questions` or `explorations` as part of an unrelated change. A reflection record, if one is approved later, is a separate store.
