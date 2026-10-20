# Curitopia Stories

## Status
**Approved** on 2026-10-20 as the first-release design, in D-025. Phase 1 selects, arranges, and reviews a draft at `/explorations/[id]/story`. Phase 2 adds confirmed artwork for one slide at a time. The image request uses `1152x2048` for `gpt-image-2.5-flare`, which is a native 9:16 size. The review step downloads one silent 1080 by 1920 MP4, encoded in the browser. Background music, narration, PDF, and publishing are not built.

The approved first release does not add a story table, a story storage bucket, or a change to reflection. Background music, narration, a user-chosen soundtrack, Suno, a 4:5 export, PDF, a suggested closing question, persistent drafts, and a direct social connection stay **Future**.

## What this is
Curitopia Stories would turn a selection from one private exploration into a short visual slideshow the person could download and, if they choose, share on a social network they already use.

The aim is not to export the question map. A story is a sequence of questions, images, and discoveries that invites another person to think. Images and short lines attract attention. The questions are the substance.

Stories are a bridge from private curiosity toward a public conversation. They are not a new social network inside Curitopia. A person can make and download a story without publishing it anywhere.

## Place in the product
Curitopia already helps someone ask more questions, suspend judgement, and investigate a question they care about. Quickfire, Focus, reflection, and the Experiment workspace stay private. Stories, if built, would be a later, optional way to show a chosen part of that work to other people.

The longer hope is that shared questions help people think for themselves, stay curious, learn by investigating, and notice conversations or goals they have in common. That might, over time, make isolation and polarisation a little easier to resist. Those are aspirations. This specification does not claim that Curitopia will reduce loneliness or polarisation, and it does not treat either outcome as something the product has measured.

## Principles
- **The user is the author.** Curitopia may propose a sequence, a subtitle, or an image. The person chooses what is included, what the words say, and whether anything leaves their account.
- **Questions are the substance.** A short subtitle and an image can open a slide. The question itself stays on the slide, so a short line cannot replace or quietly change its meaning.
- **Invite curiosity, not engagement farming.** A story should prompt thought and conversation. It is not built to provoke outrage, compete for popularity, or keep someone scrolling. The first version has no likes, followers, rankings, or recommendation feed.
- **Preserve intellectual honesty.** An unanswered question stays a question. A hypothesis stays tentative. A test is something the person chose to try. An observation is what they recorded. A discovery is what they concluded. The product must not promote one of these into a fact, and it must not invent an outcome that was never saved.
- **Respect privacy.** Private exploration content is not exported unless the person selects it and reviews the result. Hidden questions and unselected experiment items stay out.
- **Make sharing optional.** Export downloads files. It does not post them. Publishing on another service, if the person wants that, happens outside Curitopia unless a later decision designs a direct connection and asks for a separate authorisation.

## What already exists, and what this proposal may use
These capabilities exist in the application today. Stories would read from them. It would not change them.

- A saved exploration has questions, a central question when the mode is Focus, priorities, and hidden questions. Hidden questions leave the normal map and list.
- Reflection of one exploration can suggest further questions after confirmation. The result is not stored. Stories must not be added inside that reflection flow.
- An experiment can hold concepts, notes, hypotheses, tests, observations, and discoveries, each in the person's own words. An item may have a small private thumbnail. Those thumbnails are at most 256 by 256 pixels. They are for the constellation, not for a social slide.
- A saved exploration may have one optional Focus Image. That image is a background for the exploration. It is not automatically a story slide.

## First experience
The first version starts from one saved exploration the signed-in owner already has. It does not need a public profile, followers, or an in-app feed.

Proposed journey:

1. From that exploration, the person chooses **Create a Story**.
2. Curitopia offers content from that exploration that is relevant and available to select. Hidden questions are omitted from this offer. Experiment items are listed only so the person can choose them. Nothing is pre-selected as "share this" without a deliberate choice. A sensible starting offer may highlight the central question and prioritised questions, still unchecked until the person includes them.
3. The person chooses which questions, concepts, and other experiment items to include. Not every question has to be included. A story does not have to use every slide type below.
4. Curitopia prepares a sequence of slides from that selection.
5. The person reviews the sequence, edits the words, replaces or regenerates images, and reorders the slides.
6. The person exports the finished story as one silent MP4. Export downloads that file to their device. It does not upload it and it does not publish it. PDF is excluded from this release.

The person can leave the draft at any step. Cancel or discard drops the draft and does not change the exploration. The draft exists only in the browser for that editing session. Refreshing the page or closing the tab can discard an unfinished story, including slide order, subtitles, and images that have not been downloaded.

There is no required narrative shape. One story might be a single question and a closing question. Another might follow a question into a test and a discovery. The person decides.

## Slide types
A story is an ordered list of slides. Each slide has one job. The person can omit any type.

### A. Opening question
The opening is the exploration's central question, or another question the person picks on purpose.

The slide uses a strong image and a short title or hook so someone else wants to continue. The full question remains on the slide. The image is made for the slide's dimensions. It is not a screenshot of the question map and it is not an enlarged constellation thumbnail.

### B. Starred questions
Prioritised questions are the natural set to offer. The person can include some of them and leave others out. A later design may also let them include a question that was never prioritised. That is still an explicit selection. This specification does not require every included question to have been starred.

For a selected question, Curitopia may propose a subtitle of about two or three words, shown over a relevant image. Examples of the tone, not templates to reuse:

- "Memory or prediction?"
- "Beyond the senses"
- "Testing the unknown"

The person can edit or clear the subtitle. The full question stays visible so the short line cannot change what was asked. The subtitle is presentation. It is not a new question and it is not a factual claim.

### C. Concepts and important ideas
The person may include concepts, or other ideas they saved as experiment items, when they want those ideas in the story.

The slide uses the saved text. If that item has a thumbnail and the thumbnail is suitable, it can inform the slide, but a 256-pixel constellation image should not be scaled up and treated as the finished social image. When the saved image is too small or the wrong shape, the story can use a separate image made for the slide. Creating that larger image is part of the story, not a change to the item's thumbnail.

### D. Experiments, tests, and discoveries
The person may include hypotheses, tests, observations, and discoveries. Notes can be included only when the person selects them. None of these are added automatically.

The slide must keep the kind visible and honest:

- A hypothesis is a tentative explanation.
- A test is an investigation the person chose to perform.
- An observation is what they noticed or recorded.
- A discovery is what they learned or concluded.

A hypothesis is not shown as a result. A test is not shown as completed if the person did not record an outcome. An empty discovery is not invented. The person decides which of this material is fit to show to someone else.

### E. Closing question
The story may end with a question that invites the viewer to think or to start a conversation. In this release that question is one the person writes. A suggested or model-written closing question is **Future**.

A closing question is still a question. It is not a moral, a call to outrage, or a claim about what the viewer should believe.

## Visual design and export
Slides should feel designed for sharing. They should not look like screenshots of the workspace, the question map, or the experiment constellation.

They follow the existing Curitopia identity, described in `docs/DESIGN_SYSTEM.md`:

- A dark navy, cosmic ground where that still serves the slide.
- Restrained cyan, teal, violet, and amber accents.
- Imagery that belongs together across the story.
- Type that stays clear, with strong contrast against the image.
- Little text on each slide: the question, a short subtitle when there is one, and the kind of experimental item when that distinction matters.
- The same framing from slide to slide, so a carousel feels like one piece.

The approved export canvas is **vertical 9:16**. That is the shape of the downloaded slide. It is not a claim that the existing image API returns a 9:16 file by itself. Portrait 4:5, for a feed carousel, is **Future**.

The current product is usable at desktop and mobile widths. `docs/UX_SPEC.md` describes a three-column workspace from 1180 pixels. It does not require mobile-first sharing. 9:16 is the file someone downloads, not a claim that the Curitopia workspace is mobile-first.

Images are composed for that 9:16 canvas. Enlarging a concept thumbnail, a Focus Image, or a screen capture is not the design.

The approved output is one silent MP4 after the person has reviewed the sequence. Each frame is the same 1080 by 1920 slide used for the portrait preview: accepted artwork when there is some, the question or item text for that slide, its subtitle, the gradient, and the Curitopia mark only when it is turned on. A slide with no artwork uses the dark text frame. Artwork that is still waiting for a decision blocks the download. PDF is excluded. The review screen shows the slides, including order, words, and images, before any file is made. A small Curitopia mark is optional.

Three things stay separate:

- The private exploration, its questions, priorities, hidden state, experiment items, thumbnails, and Focus Image.
- The story: the person's selection, order, edited subtitles, and any images made for the slides.
- The rendered export: one downloaded silent 9:16 MP4. It is not stored. PDF is excluded from this release.

Editing or deleting a story does not change a question, a priority, an experiment item, or an existing image. Exporting does not write those records either. Replacing a story image does not replace a thumbnail or a Focus Image.

## Image generation and AI
**Approved** for the first release: slide images, when generated, use Curitopia's existing OpenAI Image API integration. **Implementation pending.** This approval does not mean the current image function is already suitable for a story slide. Suitability has not been tested.

Before an implementation is treated as complete, that work has to inspect the actual model, request parameters, supported output sizes, and how the bytes are handled. It has to show that the result can be composed as a high-quality 9:16 slide. Do not claim that check has passed until it has been run. 9:16 is the slide canvas. It is not an assumption that the API returns that aspect ratio on its own.

What the current image features actually do, and why that is not yet a story slide:

- An experiment thumbnail is a WebP of at most 256 by 256 pixels and 150 KB. It is made for a constellation sphere. It must not be treated as a finished, full-resolution 9:16 slide without a quality check.
- A Focus Image, when generation is used, is requested at 1536 by 1024 pixels. That is a landscape frame. An upload may be larger, up to 4096 pixels on the long edge, and is still one background for the exploration. The hosted SQL for that image has not been applied. It must not be treated as a finished story slide without a quality check. Cropping it into 9:16 is not a substitute for a slide composed for that canvas.
- Both features call the OpenAI Image API only after an explicit Generate, from the server, using `OPENAI_IMAGE_MODEL` when set and `gpt-image-2.5-flare` otherwise. The request sends the submitted prompt, not the exploration. An upload is not sent. A Focus Image is stored only after Use image. A thumbnail is stored only after the file passes the server checks. Those retention rules belong to those features. Stories does not copy them.

Rules for a story image, once implementation starts:

- Generate or reuse an image only for content the person has selected for that one slide. The request does not include the rest of the exploration, hidden questions, unselected items, other explorations, account details, or unrelated conversation.
- The screen says what will be sent, that it goes to the OpenAI Image API, and that the call can use API credit. The person confirms before the request. Cancelling sends nothing. They review the image before it is used on the slide.
- The browser does not receive API keys. The call goes through the server, as the current image features do. The image may pass through the server only for as long as that call needs, and is returned to the browser. It is not stored in a bucket and it is not given a database path. Implementation must check the real data flow and must not log or otherwise keep the image payload.
- The person can regenerate, replace, or remove the image before download. That does not change a Focus Image or an experiment thumbnail.
- A subtitle the model proposes is a suggestion. It is not the person's question. They can edit it. The closing question is not one of these suggestions.
- An illustrated slide is not presented as a photograph of a real test, place, or event.

Reflection stays as specified in `docs/AI_BEHAVIOUR.md`. This release does not add story text or story images to the reflection request.

## Video export
The review step can download `curitopia-story.mp4`. The file is a silent H.264 video in an MP4 container, 1080 by 1920 pixels, at 30 frames per second. Each slide stays fully visible for 4 seconds. A crossfade of about half a second joins one slide to the next, so the opening slide is first and a closing question, when the person wrote one, is last. The total length is the holds plus those crossfades. The review screen shows that approximate length before encoding starts.

Encoding happens in the browser. Curitopia does not upload the frames or the finished file, and it does not store them. Creating the video does not call the image API again and does not change the exploration.

## Future direction: music and narration
**Future.** Not part of this release. The downloaded video has no soundtrack and no narration.

A later version could add:

- An optional instrumental soundtrack.
- A way for the person to choose that soundtrack.
- Optional narration.
- A video file that includes that audio.

Suno has been named as one music service to investigate. That is an option to research. It is not an approved integration, and this document does not assume Suno offers a public API that Curitopia can call. Before any implementation, a separate decision has to establish:

- Whether a suitable API exists and whether this product can use it.
- The current price and the limits on use.
- Who owns the generated music, and which licence applies.
- Whether that music may be mixed into a video the person exports and posts elsewhere.
- Any rule about commercial use, attribution, or keeping the audio inside Suno's own product.

Narration and any music provider each need their own product and technical decision. Neither is part of the silent video.

## Privacy and sharing
Privacy is part of the feature, not a later polish.

- Choosing **Create a Story** does not publish anything.
- Only content the person explicitly includes is in the story.
- Hidden questions are left out of the offer. This release does not add a way to reveal or include them. Unselected questions stay in the exploration and out of the export.
- Notes, hypotheses, tests, observations, and discoveries are not copied into a story unless the person selects those items.
- The review step shows the whole output before a file is created.
- Cancel and discard are always available. Discarding a draft does not alter the exploration.
- Downloading does not upload the files anywhere. A button that posted them to another network is **Future**. It would need its own design and a separate confirmation for each publish.
- Story content is exploration content. It is not sent to analytics. D-013 still applies.

The Curitopia mark is optional. The person chooses whether it appears on the exported slides, provided that choice stays simple in this release.

## Approved first version
**Approved** on 2026-10-20. **Implementation pending.** The purpose is to learn whether people value a shareable sequence made from their own curiosity. It is not a social network.

The journey is **Create a Story**, then select content, arrange slides, review, and download one silent MP4.

Include:

- **Create a Story** on one existing exploration.
- An explicit selection of visible questions, including prioritised ones, and of experiment items the person wants to show. Hidden questions are not offered and cannot be added.
- A closing question only when the person writes one. No suggested closing question.
- Image slides with a short subtitle the person can edit. The full question stays on the slide, and the subtitle does not replace it.
- A hypothesis stays tentative. A test is not shown as successful unless the person recorded that outcome. A missing outcome is not invented.
- The person controls order, words, and images, and reviews the whole story before export.
- One visual theme on a vertical 9:16 canvas. An optional Curitopia mark, which the person can leave off.
- A draft that lives in the browser for that editing session. Refreshing or closing the tab may discard it. No story table and no story bucket.
- Generated images use the existing OpenAI Image API, only after confirmation, only for that slide's selected content, and only after the person reviews the result. The bytes are not kept on the server. Whether the current call can actually produce a good 9:16 slide is not yet verified.
- Download of one silent 1080 by 1920 MP4 to the person's device. Each slide is held for about 4 seconds, with a crossfade of about half a second. The download does not upload or publish the file.
- Cancel or discard leaves the exploration, its questions, priorities, items, thumbnails, and Focus Image unchanged. Story edits do not write those records.

**Future**, and out of this release:

- PDF.
- A 4:5 feed export.
- A way to include a hidden question.
- A model-written closing question.
- Persistent story drafts, story tables, and a story storage bucket.
- Suno, or any other music generator.
- Background music, narration, and a user-chosen soundtrack.
- Any direct connection to an external social network.
- A public story feed, profiles, followers, likes, popularity counts, and recommendation.
- A timeline editor.

The silent video is the shareable file. Music, narration, and a social graph answer different questions and can wait.

## Approved decisions
Each item is **Approved**. The workflow, artwork, and silent MP4 download are in the application. D-025 records the same list.

1. **Draft storage.** Browser-side editing state only. No story tables and no story bucket. A refresh or a closed tab can discard the unfinished story.
2. **Export format.** 9:16 portrait is the slide canvas and the silent MP4. 4:5 can be considered later. 9:16 does not mean the image API already returns that ratio.
3. **PDF.** Excluded. The download is one silent MP4.
4. **Branding.** The Curitopia mark is optional. The person chooses whether it appears, if that stays simple.
5. **Hidden questions.** Excluded. No control to include them.
6. **Closing question.** Written by the person. A suggested closing question is future.
7. **Image provider.** The existing OpenAI Image API integration. The current function is not assumed to be suitable. Implementation is complete only after the real model, parameters, sizes, and image handling have been inspected, and only after a 9:16 slide has been shown to be suitably composed. That test has not been run. A 256-pixel thumbnail and the landscape Focus Image are not finished slide assets without a quality check. Generation needs confirmation, a review of the result, and only that slide's selected content.
8. **Retention.** Do not keep story images or exported slides on the server. Bytes may pass through the server only as required to call the image API and return the result to the browser. No bucket and no database reference. Implementation must check that path and must not log or retain the image payload.
9. **Publishing.** Export means a download. Creating, editing, or exporting never publishes the story. No external social network in this release.

If a later task needs a stored draft, the sketch in `docs/DATA_MODEL.md` is still unapproved. It is not a migration, and this release does not use it.

## What not to build from this document
Phases 1 to 4 are in the application. Download flattens each slide to a 1080 by 1920 frame in the browser and assembles those frames into one silent MP4. Do not add a new table, a bucket, a PDF, music, or narration because this file exists. Do not treat Suno as available. Do not change reflection, the question map, or the experiment constellation as part of story export.
