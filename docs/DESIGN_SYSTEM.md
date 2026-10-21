# Design System

## Source of truth
The accepted v0 interface and the supplied reference images are the primary visual references. Inspect the existing code and retain its implemented tokens, styles and components. This document describes intent; it does not authorise a redesign.

## Visual direction
- Dark, cinematic, space-inspired canvas.
- Deep navy backgrounds rather than flat pure black.
- Fine, low-contrast orbital rings and restrained star details.
- An optional focus image may sit behind the map as a darkened, still background. It does not replace the navy canvas when no image is set, and it does not cover question nodes or controls.
- The experiment page uses the same left sidebar as the exploration page, and the constellation fills the space beside it. It uses this same navy palette as a constellation. The originating question is the large central sphere. Saved thoughts are smaller glass spheres on orbital rings, with a type icon and label. A list is the alternative view. Any saved thought may show a WebP image across its sphere. A translucent white wash and a soft radial highlight sit over that image, and the text uses a dark navy, `--sphere-image-ink`. Spheres without an image keep light text. That image is not a second Focus Image.
- Glowing circles with blue, violet, teal/green, pink and occasional warm amber accents.
- Central question has the strongest emphasis.
- The create sidebar and the review sidebar are subtly differentiated from the background with thin borders and restrained gradients. Review sections stay compact so the map remains the visual centre.
- Clean, legible typography; avoid excessive glow or visual noise.

## Hierarchy
1. Central question.
2. Individual satellite questions.
3. Question input and primary action.
4. Session count, shown in the compact workspace header.
5. Decorative stars/orbit lines.

## Circle and text rules
- Size a node according to its text length within sensible minimum and maximum bounds.
- Use readable line-height and padding.
- Wrap text by words where possible; avoid splitting words or rendering text beyond the circle.
- If a question is too long for the maximum node size, show a legible shortened label and make the full question available on selection. Do not silently lose the stored text.
- Keep contrast sufficient for text and controls.

## Motion
- New nodes may fade/scale gently into place.
- Existing nodes should not jump on every render.
- Avoid continuous motion that distracts from typing.
- Respect reduced-motion settings and provide a static equivalent.

## Story slides
Phase 1 and Phase 2 are in the application. `docs/STORIES_SPEC.md` describes the slides. They are not screenshots of the map or the constellation. Generated artwork can use the colours the idea needs. The frame, type, and mark stay with this identity.

- Dark navy and a cosmic ground, used where it still leaves the words readable.
- Restrained cyan, teal, violet, and amber. Avoid a new palette for stories.
- Images composed for the slide, at the export size. Do not scale up a 256-pixel experiment thumbnail and call it the slide.
- Few words on the picture: the question, or a short item line, and an optional subtitle. The item kind stays beside the preview. The downloaded file is a silent 9:16 MP4 of those frames.
- The same framing on every slide in one story.
- Contrast that keeps the question readable on top of the image.
- The approved slide canvas is vertical 9:16. On review, that frame is centred in the space beside the same left sidebar used by exploration and experiment. Portrait 4:5 is a future feed format. The Curitopia mark is optional and can be turned off.

A slide must not present a hypothesis as a result, or a generated image as evidence of a real event.

## Components
Prefer existing components and styling conventions in the repository. Do not add a component library solely to match this document.
