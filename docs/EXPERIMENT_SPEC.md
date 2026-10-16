# Experiment Specification

## Status
The product direction and the technical choices below were approved on 2026-10-16. See D-022.

Phase 1 opens one experiment at `/explorations/[id]/experiments/[experimentId]` and links back to the exploration. Phase 2 lets the owner add, edit, and delete concepts, notes, hypotheses, tests, observations, and discoveries on that page. None of those kinds is required, and they can be written in any order. `related_item_id` stays null. The hosted SQL has not been applied. Until `supabase/scripts/create_experiments.sql` is run in the SQL Editor, an experiment and its items cannot be saved. pgTAP for the new tables has not been run.

Phase 3, concept thumbnails and the concept map, is not built. AI assistance stays deferred. No experiment action calls a model.

D-017, D-019, and D-020 still forbid an AI experiment planner inside reflection. This workspace is written by the user.

Quickfire, Focus, editable explorations, reflection, and the Focus Image stay as they are. Starting an experiment does not move, delete, complete, or lock the exploration it came from.

## Agreed product direction

### User ownership of learning
The user decides what to investigate, what to try, and what counts as a useful discovery. The workspace can encourage experimentation and the satisfaction of finding something out. That satisfaction comes from the user's own work: looking something up, trying an idea, and learning from what happened. The application does not award a score, a level, or a verdict on whether the user was curious enough.

### Free-form exploration
There is no mandatory scientific method and no sequence the user must finish. Concepts, notes, hypotheses, tests, observations, and discoveries are optional building blocks. The user may add them in any order, revise them, and leave some unused.

A person might start with a picture of a concept, look at one part of it, write down what they noticed, and only later decide to test an explanation. That path is valid. So is a path that never forms a hypothesis.

### Lightweight practical experiments
The first version is for practical learning, not a formal laboratory record. A test might be reading the relevant documentation, inspecting a system in a safe environment, asking a colleague to demonstrate a process, or trying an idea in a low-risk way the user judges appropriate.

The workspace should invite the user to look at the evidence and to allow that an initial explanation may be wrong. A test does not have to end in a definitive conclusion. An observation can stand on its own.

Where an activity would touch production infrastructure, the interface keeps a clear expectation: the user follows the workplace rules that apply, including approval, change control, safety, and access. Curitopia must not encourage or walk through an unauthorised production change.

### Visual representations of concepts
A concept may carry a small image. The image is a memory aid for that idea and a way to notice how ideas relate. It is not a decoration for the whole exploration.

The user may later arrange or connect concepts. Moving objects is not required in order to benefit from the workspace. Someone who never drags a node, and never connects two concepts, can still record notes, tests, observations, and discoveries.

The visual language should feel related to the orbital question map: dark navy, the same palette, and nodes drawn from data. Its job is different. An exploration can hold many questions. An experiment looks at fewer ideas in more depth.

## Relationship to an existing exploration
An experiment starts when the owner explicitly chooses one question in a saved exploration. Priority is a mark the user already controls. It does not create an experiment by itself. Reflection does not create one either.

The experiment stores the exploration id and the question id. The question text shown in the experiment is the text on that question row. The experiment does not keep a second copy. If the user later edits the question in the exploration, the experiment shows the edited text. Hiding the question hides it on the exploration map and list. It does not delete the experiment, and it does not change the question's hidden state.

The selected question is the centre of the experiment. User-created concepts are optional branches around that centre. Notes and the other building blocks can sit on the centre or on a concept.

### Entering
From a saved exploration, the owner marks a question as important and chooses **Investigate further**. That label is not the Focus starter named Investigate.

The first time, that action creates the experiment. Opening it again loads the same experiment. There is one experiment for each question. A question that is no longer prioritised can still reopen its experiment. A question that was never prioritised, and has no experiment, does not start one.

A hidden question can be chosen only from the hidden list, because the normal map and list omit it. Choosing it does not restore it.

An unsaved workspace has no question row, so it cannot start an experiment. The exploration must already be saved.

### Leaving and returning
The experiment offers a way back to the original exploration, at that exploration's existing URL. Leaving does not save a completion, does not change `status`, and does not alter questions, priorities, or hidden state.

The signed-in home remains the exploration library. The first version does not add experiment cards to that library. The owner returns to an experiment from the question it belongs to. If an experiment already exists, the question shows that it can be reopened.

Closing the browser and coming back later restores the experiment from the database, in the same way a saved exploration restores.

## Proposed workspace
The workspace may contain:

- The originating question, read from `questions`.
- User-created concepts, and optional relationships between them.
- Free-form notes.
- Optional hypotheses, written as tentative explanations.
- Optional tests, written as practical investigative actions.
- Observations and other evidence the user wants to keep.
- Discoveries, conclusions, or a revised understanding.
- An optional small image on a concept.

These are available blocks, not a form the user must complete and not steps in a wizard. The user can add, edit, and return to any of them. A concept does not need a test. A test does not need a discovery.

The centre is always the originating question. Everything else is optional. Removing the last concept does not remove the experiment, because the question is still the centre. That differs from an exploration, which is created with its first question and is kept out of the library when it has no questions.

## Concept map
When this phase is built, the concept map should be SVG drawn from the experiment's items, following D-003. It is not a bitmap and it is not the question map in `docs/QUESTION_MAP_SPEC.md`.

Proposed presentation, still to be approved with the implementation:

- The originating question is the largest node.
- Concepts and the other visible items use smaller nodes. Colour comes from the stable item id and the existing palette. It is not stored.
- Layout is derived from saved order and from the optional association recorded on an item. Coordinates are not stored. Existing items do not jump on an ordinary re-render.
- The user does not have to drag nodes. Free placement is deferred.
- A concept thumbnail is drawn inside its node. The node stays selectable if the image is missing.
- Long text is shortened on the node. The full text is available on selection, as on the question map.
- Reduced motion, narrow screens, and an empty experiment (question only) are part of the same layout rules.

## Images
A concept image is not a Focus Image. The Focus Image is one optional background behind an exploration's question map. `explorations.focus_image_path` points at a file in the private `exploration-images` bucket. A concept thumbnail belongs to one concept inside one experiment, is drawn inside that concept's node, and uses its own rows and its own bucket. The two features do not share files or columns.

### Storage
Phase 3 only. The phase 1 migration does not add `image_path` or a bucket. Reuse the private-storage pattern from D-021, without reusing that bucket:

- The file lives in Supabase Storage. The item row stores the object path and small metadata. It does not store the image bytes.
- The bucket is private. There is no public URL. The browser does not use the service-role key.
- The bucket name is `experiment-thumbnails`. The files are small compressed WebP thumbnails, not full-resolution originals. The maximum edge and byte size are still to be measured before that phase is built.
- A proposed path is `{user_id}/{experiment_id}/{item_id}/{file_id}`, plus an extension chosen when the thumbnail format is decided. The first segment must be the experiment owner's user id. The second must be that experiment's id.
- Select, insert, update, and delete on `storage.objects` are limited to the authenticated owner. A `SECURITY INVOKER` function can resolve the path to an experiment the current user owns, in the same spirit as `exploration_image_owner`. The exact function is part of the implementation migration, which this task does not write.
- The owner reads a thumbnail through an application route that uses that person's Supabase session. Another user's id, path, or experiment id does not return the file. A missing object and another user's object should fail the same way, so a guess does not reveal that the image exists.
- The server inspects the uploaded bytes before saving them. Type, size, and image content are checked on the server, not only in the browser.
- Upload does not call OpenAI. Generating a concept image with a model is not part of the first version.
- Do not remove a usable thumbnail until its replacement has been stored. If removing the old file fails after the new path is saved, keep the new image. If deleting the file fails after the path is cleared, restore the path. Those are the Focus Image failure rules, and they fit here.

Only a concept has an image in this proposal. Notes, hypotheses, tests, observations, and discoveries do not.

### Loading
The map must stay fast when an experiment has several concepts:

- The map request does not include original, full-resolution images.
- The interface loads a thumbnail, lazily, after the nodes are drawn.
- A private cache header is appropriate. A public or shared cache is not, because the object is private. The Focus Image response uses `private` caching; a thumbnail response should stay in that family. The exact `max-age` can match that route unless measurement says otherwise.
- While a thumbnail is loading, and when it cannot be loaded, the node shows a placeholder in the thumbnail's box. The placeholder uses the node's derived colour. The node does not change size when the image arrives or fails.
- The map is drawn from the item rows. A slow or failed thumbnail does not block the other nodes or the text.

### Limits still to assess
Do not treat any pixel size, format, or compression setting as chosen. The repository does not currently resize images. Focus Image stores a file that has already passed type and dimension checks. Concept thumbnails need a derived small file, which the current application does not produce.

Before implementation, measure sample images and record the chosen limits in `docs/DECISIONS.md`. The assessment should answer:

- The maximum edge of a thumbnail, and the maximum file size.
- The format and whether compression settings are fixed.
- Whether the original upload is discarded after a thumbnail is stored, or kept beside the thumbnail and never sent to the map.

The recommendation, not yet a decision, is to store only the thumbnail when the product needs no larger view. That keeps the map from ever requesting a full-resolution file. The cost is that a larger view later would need a new upload. Storing both files is the alternative if a larger view is required. Choose one of those after the samples are measured.

## AI assistance
AI that suggests a better experiment, names an assumption, or offers another way to investigate is a later capability. It is advisory. The user chooses what to accept and what to do next. The first version must be useful with no model call at all.

Nothing in the first version sends experiment text, concept images, or the originating question to OpenAI as part of this workspace. Existing reflection and Focus Image generation stay on their own confirmed actions and their own routes.

Unresolved questions, to be approved before any experiment AI is built:

- Which text would be sent: the one experiment, the originating question only, or also the rest of that exploration's visible questions.
- Whether hidden questions of the source exploration are excluded, as they are for reflection.
- How consent is asked, and that saving an experiment is not consent to send it.
- That a suggestion is labelled as a suggestion, can be ignored, and is not written into the experiment unless the user explicitly adds it.
- Whether a suggestion is stored. The reflection result is not stored. This should default the same way unless a later decision says otherwise.
- Provider, model, retention, `store: false`, cost, and the same rule against sending content to analytics.
- How the product stops a suggestion from recommending an unauthorised production change.
- Failure behaviour that leaves the user's notes unchanged.

Do not answer those by implication in an implementation task.

## Proposed data model
The approved exploration store is unchanged. This section proposes two new tables. It is not a migration.

### Why two tables
`experiments` and `experiment_items` are enough for the agreed direction.

`experiments` is the link to one exploration and one question, plus ownership and timestamps. `experiment_items` holds every optional block. The block's kind says whether the text is a concept, note, hypothesis, test, observation, or discovery. One optional parent says what the block is attached to. A null parent means it sits on the originating question.

That is a forest of optional notes around the question, which matches "concepts branching from the centre" without making a link mandatory.

A third table of arbitrary links would allow any concept to connect to several others. That is a general graph. The first version does not need it, and free dragging is deferred, so the extra table would mostly be unused. It remains the extension if a later decision wants more than one association per item.

Separate tables per kind would repeat the same text, order, and ownership columns. One item table with a `kind` check is the smaller model.

JSON for the whole experiment would avoid a second table and would make row-level security, ordering, and image paths harder to constrain. It is a poor fit for the ownership rules already used for questions.

Items do not copy `user_id`. Questions do not either. Policies join to the parent. `experiments.user_id` is the exception worth having: storage paths and policies need a stable owner id, and a direct `user_id = auth.uid()` check matches `explorations`. A trigger or insert check must keep it equal to the parent exploration's `user_id`, so the two cannot drift.

### `experiments` (proposed)

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `uuid`, primary key | Client-generated UUID, so a retry is the same row. |
| `user_id` | `uuid`, not null, references `auth.users(id)` on delete cascade | Owner. Must match the parent exploration. |
| `exploration_id` | `uuid`, not null, references `explorations(id)` on delete cascade | Originating exploration. |
| `question_id` | `uuid`, not null, references `questions(id)` on delete cascade | Originating question. Unique in this table for the first version. |
| `created_at` | `timestamptz`, not null, default `now()` | Server insert time. |
| `updated_at` | `timestamptz`, not null, default `now()` | Server time of the last change to the experiment or an item. |

The question must belong to that exploration. Hiding the question does not delete this row. Deleting the exploration, when deletion exists, would delete the experiment and its items. Deleting the question row would do the same. Individual question deletion is not a current feature.

There is no `status`. An experiment is not completed by leaving it.

### `experiment_items` (proposed)

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `uuid`, primary key | Client-generated UUID. Also the source of derived colour. |
| `experiment_id` | `uuid`, not null, references `experiments(id)` on delete cascade | Parent experiment. |
| `position` | `integer`, not null | Zero-based order within the experiment. Unique there. |
| `kind` | `text`, not null | `concept`, `note`, `hypothesis`, `test`, `observation`, or `discovery`. |
| `body` | `text`, not null | The user's text. Trimmed. Blank rejected. |
| `related_item_id` | `uuid`, null, references `experiment_items(id)` | Optional association. Null means the item sits on the originating question. |
| `image_path` | `text`, null | Added in phase 3. Thumbnail path. Allowed only when `kind` is `concept`. Not in the phase 1 migration. |
| `created_at` | `timestamptz`, not null, default `now()` | Server insert time. |
| `updated_at` | `timestamptz`, not null, default `now()` | Server update time. |

Proposed checks, with the numbers still awaiting approval:

- `kind` is one of the six values.
- `body` is the trimmed value. A working limit of 2,000 characters would match question text. Approve the number before the migration.
- `related_item_id` is not the item's own id, and it references an item in the same experiment. The application also rejects a cycle. A database trigger may do the same if it stays small.
- `image_path` is null, or `kind` is `concept` and the path matches the owner, experiment, and item.
- `position` is greater than or equal to 0. The same insert pattern as questions can assign the next position and ignore a client-supplied one.

No column stores coordinates, colour, a test result code, or a required workflow state. "Tried" and "I might be wrong" are things the user can write. They are not statuses the schema demands.

### Values that stay derived
- Node colour, from `experiment_items.id` and the palette in `docs/DATA_MODEL.md`.
- Layout coordinates.
- Short labels on nodes, cut from `body` for display.
- Whether an image has finished loading.

### Ownership
Enable row-level security. Grant no policies to the anonymous role.

- `experiments`: select, update, and delete only where `user_id = auth.uid()`. Insert only when `user_id` is `auth.uid()`, the exploration is owned by that user, and the question belongs to that exploration. Updates cannot move `user_id`, `exploration_id`, or `question_id`.
- `experiment_items`: select, insert, update, and delete only where the parent experiment is owned by `auth.uid()`.
- Storage policies, as above, for the thumbnail bucket only.

A missing experiment and another user's experiment should produce the same not-found behaviour used for explorations.

pgTAP for two accounts is required when this is implemented, on the same terms as D-014. Until those tests pass, the policies are not evidence of isolation. This document does not add those tests.

## First version
Build this only after a later task approves implementation and the open technical choices below.

Include:

- An explicit start from a question on a saved exploration, and a return to that exploration without changing it.
- One experiment per question, reopened on the next visit.
- Optional concepts, notes, hypotheses, tests, observations, and discoveries, in any order, with edit and delete of those items.
- An optional single association from an item to another item or, by default, to the originating question.
- A derived concept map that shows the question at the centre.
- Optional concept thumbnails, using the storage and loading rules above, once the size and format have been decided.
- Placeholders, lazy thumbnail loading, and a map that still works when an image fails.
- The practical-experiment guidance, including the production-change expectation.
- Ownership enforced in the database.

Leave out:

- AI suggestions, AI image generation, and any new model call.
- A required stage, score, or conclusion.
- Free dragging, stored coordinates, and a general link graph.
- A second experiment library on the signed-in home.
- Cross-session profiling, sharing, and collaboration.
- Changes to reflection, Focus Image, Quickfire, or Focus.

### Acceptance criteria
These apply only after implementation is requested.

1. Choosing "Investigate further" on a saved question creates one experiment, and choosing it again opens that same experiment.
2. The experiment shows the current text of the originating question and a control that returns to `/explorations/[id]`.
3. Returning does not change the exploration's questions, priority, hidden flags, mode, or `status`.
4. The user can add any of the six item kinds, leave the others unused, and come back later to the items they saved.
5. A concept does not require a test, and a test does not require a discovery.
6. An item can be edited and removed without removing the experiment or the question.
7. Another account cannot read or change the experiment, its items, or its thumbnails.
8. A concept image is a thumbnail inside the node. The question map's Focus Image is unchanged.
9. The map is usable when every thumbnail fails, and a missing image shows a placeholder.
10. No experiment action calls OpenAI.
11. The interface does not instruct the user to bypass workplace approval, change control, safety, or access rules.

## Approved choices
Approved on 2026-10-16, to be built in three increments. AI stays out of all three.

1. Implement the phase, starting with a usable workspace that does not call a model.
2. One experiment per question. Several concepts and tests can live inside it.
3. The control label is "Investigate further".
4. Two tables, `experiments` and `experiment_items`. No general-purpose graph.
5. `experiments.user_id` is stored and used for ownership and row-level security.
6. Each item's `body` is at most 2,000 trimmed characters. The limit is per item. The experiment as a whole can hold many items.
7. Deleting a question or an exploration does not silently delete an experiment. The foreign keys use `ON DELETE RESTRICT`. An explicit deletion workflow is still to be designed before either can be removed while an experiment depends on it.
8. Concept images, when phase 3 is built, use a separate private bucket named `experiment-thumbnails` and store small compressed WebP thumbnails. Full-resolution originals are not what the map loads. Exact edge length and byte cap are still to be measured before that phase.
9. The route is `/explorations/[id]/experiments/[experimentId]`.
10. AI assistance is deferred. The first three phases make no model call.

Phase 1 is the create-and-open step. Phase 2 is the optional items on the experiment page. Phase 3 adds the thumbnails and the concept map.
