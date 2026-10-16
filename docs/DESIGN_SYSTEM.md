# Design System

## Source of truth
The accepted v0 interface and the supplied reference images are the primary visual references. Inspect the existing code and retain its implemented tokens, styles and components. This document describes intent; it does not authorise a redesign.

## Visual direction
- Dark, cinematic, space-inspired canvas.
- Deep navy backgrounds rather than flat pure black.
- Fine, low-contrast orbital rings and restrained star details.
- An optional focus image may sit behind the map as a darkened, still background. It does not replace the navy canvas when no image is set, and it does not cover question nodes or controls.
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

## Components
Prefer existing components and styling conventions in the repository. Do not add a component library solely to match this document.
