# AI Behaviour — Single-Session Reflection

## Current decision
Single-session reflection is implemented for one saved exploration. It does not require that exploration to be marked completed. It is not automatic, and it is not stored. Cross-session curiosity patterns, feedback profiles, and experimentation planning are still proposals. Do not add them, or another model provider, until a separate task says so.

The call uses the OpenAI Responses API from `app/api/explorations/[id]/reflect/route.ts`. The browser never receives `OPENAI_API_KEY` and never calls OpenAI itself. D-019 records the original approval. D-020 records that reflection and editing continue together. D-017 and D-018 remain proposals beyond that slice.

No analysis table, prompt log, embedding, or background job reads questions.

## Configuration
Server environment only:

- `OPENAI_API_KEY` — required. Never prefix it with `NEXT_PUBLIC_`.
- `OPENAI_MODEL` — optional. When unset, the server uses `gpt-6-astra`, the model OpenAI's current model guide recommends as the starting point: https://developers.openai.com/api/docs/models

The request sets `store` to false so this call does not ask OpenAI to keep the response for later retrieval. OpenAI may still process the text under its API data-handling terms. Review those terms before public launch.

## What is sent
For the one saved exploration the signed-in owner opened, the server loads rows through that person's Supabase session and sends only the visible questions. Each question includes its id, text, role, prioritisation flag, and Focus perspective origin when one was stored. The exploration mode is included. Hidden questions, other explorations, emails, and account ids are not included. `status` is not a condition for the request.

The purpose is to generate the reflection described below. Signing in is not consent. The screen asks before the request is sent. Cancelling sends nothing.

## What comes back
The handler validates a strict JSON object before showing it. The object has one field, `suggestions`: up to five new questions. A shorter list is valid, including an empty list when nothing distinct was strong enough to suggest. The screen does not show an overview, a theme grouping, a connections report, or notes on prioritised questions.

Each suggestion is question text. A suggestion that repeats another suggestion, or that matches a visible question after trimming, collapsing spaces, ignoring capitalisation, and ignoring a trailing question mark, is dropped. That comparison does not catch every paraphrase. The model instructions also tell it not to rephrase a question the user already asked. A response that is not the expected object, or that contains a suggestion longer than 300 characters, is rejected and the screen shows the same unavailable message as any other invalid result. The screen shows only the validated suggestions.

Each suggestion can be copied or added to the same exploration. The result lives in the page until the user leaves or the question set changes. A later add, priority change, or hide keeps the result visible and marks it as an earlier set. Reloading asks again. It is not written to the database.

## What reflection is for
When the user asks, reflection should help them find a useful question to ask next. A good suggestion may:

- Identify a foundational topic whose clarification would make several other questions easier.
- Reveal a missing perspective, assumption, or alternative explanation.
- Open a new line of enquiry from a real connection in the exploration.
- Identify a practical, low-risk next step.
- Help the user decide which of their questions to investigate first.

The model uses the central question and the other visible questions as its context. Priority, mode, and a Focus perspective origin are available when they help it write a better question. It does not summarise what the user has already explored, and it does not claim to know their motivations.

How an experiment would be planned is a separate future specification. Do not add that planner inside the reflection phase.

A distinct proposed capability is noticing recurring interests. It helps the user see subjects they return to. It does not tell them what they think or why. `docs/REFLECTION_SPEC.md` defines three levels: recurring topics, possible connections, and tentative deeper interests. Each level cites the user's questions and stays a suggestion.

The first implementation reads one saved exploration. Analysis across earlier explorations is a later extension. It would run only when the user asks, and only after the screen shows which explorations are in scope. The application must not build a standing profile of the user in the background.

## Design principles
- Preserve original user-authored questions unchanged. A suggestion can be shown without being stored. Any store for generated text waits until an implementation task specifies it.
- Treat interpretations as suggestions, never facts. Label them that way in the interface.
- Treat prioritisation as a preference signal. A starred question is one the user chose to mark. It is not an objective measure of importance, and an unstarred question is not unimportant.
- Exclude hidden questions by default. Include them only when the user explicitly chooses that control for that reflection.
- Keep Quickfire capture uninterrupted. No coaching, themes, or model calls while questions are being entered. Reflection is a separate confirmed action on a saved exploration.
- Preserve privacy and ownership. Send only the explorations the signed-in owner included in that request. For the first scope, that is one exploration. Signing in and saving an exploration is not consent to send question text to a model. Decide the provider, retention, cost, and consent before any call.
- When AI is eventually implemented, validate model output against a typed schema, handle failure without changing the saved exploration, and show a loading state that does not block reading the questions.
- Do not diagnose mental-health conditions, infer trauma, or promise therapeutic outcomes.
- Do not infer sensitive characteristics, beliefs, or motivations as facts. A deeper reading is a hypothesis the user can accept, correct, or reject. Disagreement is not evidence that the interpretation was secretly right.
- Do not describe a pattern as a personality assessment, a discovery about the unconscious, or a fixed profile of the user.
- Never invent quotations of the user's questions, and never present a suggested question as one the user wrote. A suggested question is labelled as a suggestion. If the response is not valid, it is not shown.
- Question text shows what was explored. Priority shows what the user chose to mark. A Focus perspective origin shows which optional starter filled the composer. Later feedback, if a future policy stores it, shows whether an interpretation resonated. None of these is proof of an underlying interest.
- Never send question text, titles, or other exploration content to analytics. Do not keep cross-session profiles or generated insights as durable facts about the user unless a later task approves that data policy.

## Relationship to saved data
The question store already keeps text, order, role, priority, perspective origin, and `is_hidden`. Those fields are the inputs for reflection. Do not add reflection-output columns to `questions` or `explorations`. A reflection record, if one is approved later, is a separate store. `explorations.focus_image_path` is a separate optional reference to an image file the person chose. It does not store a reflection.

## Focus image generation
Focus image generation is a separate confirmed action. The server calls the OpenAI Image API only after the person chooses Generate. The request contains the prompt they submitted. It does not include the question list, hidden questions, a reflection, or account metadata. `OPENAI_IMAGE_MODEL` selects the image model and defaults to `gpt-image-2.5-flare`. `OPENAI_MODEL` is not used for images. An uploaded image is not sent to OpenAI. The image file, once the person chooses Use image, is stored for that exploration. The prompt is not stored.
