# Decision Log

Record approved decisions here. Add new entries with date, decision, rationale and consequences.

## D-001 — Two modes
**Decision:** Curitopia has Quickfire and Focus modes.
**Rationale:** Quickfire supports unrestricted question capture; Focus supports deliberate exploration of a central theme.

## D-002 — Protect Quickfire flow
**Decision:** No mandatory categorisation or prompts during Quickfire capture.
**Rationale:** The user wants stream-of-consciousness question generation without disrupting flow.

## D-003 — Map is data-driven
**Decision:** Render the orbital visualisation from question data, using SVG or the existing equivalent implementation.
**Rationale:** The map must respond to newly entered questions and cannot be a static image.

## D-004 — No AI in initial prototype
**Decision:** AI summaries and semantic connections are deferred.
**Rationale:** First validate the interface and core interactions with the smallest viable implementation.

## D-005 — No backend in initial prototype
**Decision:** Use local React state for the first prototype; no database, authentication or cloud persistence.
**Rationale:** Avoid infrastructure before the core interaction has been validated.

## D-006 — Preserve accepted v0 design
**Decision:** Keep the current v0-generated UI as the baseline and make targeted refinements only.
**Rationale:** The user has accepted the design and wants to guide the implementation rather than restart it.
