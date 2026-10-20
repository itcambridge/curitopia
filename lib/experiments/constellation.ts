import { mapCoordinate } from '@/lib/explorations/map-layout'

export type ConstellationItem = {
  id: string
  position: number
  relatedItemId: string | null
}

export type ConstellationNode = {
  id: string
  x: number
  y: number
  radius: number
  orbit: number
}

export type ConstellationLink = {
  fromId: string
  toId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type ConstellationLayout = {
  size: number
  centre: { x: number; y: number; radius: number }
  nodes: ConstellationNode[]
  rings: number[]
  links: ConstellationLink[]
}

// Satellites stay one size. A larger experiment adds a ring instead of
// shrinking every sphere until they fit on the first orbit.
const ITEM_RADIUS = 8.6

// How many spheres fit on this ring. The chord is the distance between
// neighbouring centres, so the check includes both diameters and the gap.
function ringCapacity(ringR: number, itemRadius: number, gap: number) {
  const needed = 2 * itemRadius + gap
  let count = 1
  while (count < 36) {
    const chord = 2 * ringR * Math.sin(Math.PI / (count + 1))
    if (chord + 1e-6 < needed) break
    count += 1
  }
  return count
}

/** Largest square that fits the canvas left after the experiment heading. */
export function constellationStageSide(canvasWidth: number, canvasHeight: number) {
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) return 0
  return Math.min(canvasWidth, canvasHeight)
}

// The same percentages the stage uses for left, top, and width. Width and
// position share one square, so the rendered gap matches this layout.
export function renderedCircle(circle: { x: number; y: number; radius: number }, layoutSize: number, stageSide: number) {
  return {
    cx: (circle.x / layoutSize) * stageSide,
    cy: (circle.y / layoutSize) * stageSide,
    radius: (circle.radius / layoutSize) * stageSide,
  }
}

// Items on one ring are spaced evenly in saved order. The first step is
// offset by half a place so a pair sits to the left and right of the question
// instead of stacking above and below it. Editing text does not change order,
// so a refresh or a small edit leaves the spheres in place.
export function layoutConstellation(items: readonly ConstellationItem[]): ConstellationLayout {
  const sorted = [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  const itemRadius = ITEM_RADIUS
  const centreRadius = itemRadius * 1.22
  const gap = Math.max(4, itemRadius * 0.62)
  const assigned: { id: string; orbit: number; ringR: number; indexInRing: number; capacity: number }[] = []
  let orbit = 1
  let ringR = centreRadius + itemRadius + gap
  let placedInRing = 0
  let capacity = ringCapacity(ringR, itemRadius, gap)

  for (const item of sorted) {
    if (placedInRing >= capacity) {
      orbit += 1
      ringR += 2 * itemRadius + gap
      capacity = ringCapacity(ringR, itemRadius, gap)
      placedInRing = 0
    }
    assigned.push({ id: item.id, orbit, ringR, indexInRing: placedInRing, capacity })
    placedInRing += 1
  }

  const maxExtent = assigned.reduce((max, item) => Math.max(max, item.ringR + itemRadius), centreRadius)
  const size = Math.ceil((maxExtent + 6) * 2)
  const centre = size / 2
  const onOrbit = new Map<number, number>()
  for (const item of assigned) onOrbit.set(item.orbit, (onOrbit.get(item.orbit) ?? 0) + 1)
  const nodes = assigned.map(item => {
    const count = onOrbit.get(item.orbit) ?? 1
    const angle = ((item.indexInRing + 0.5) / count) * 2 * Math.PI - Math.PI / 2
    return {
      id: item.id,
      x: mapCoordinate(centre + Math.cos(angle) * item.ringR),
      y: mapCoordinate(centre + Math.sin(angle) * item.ringR),
      radius: itemRadius,
      orbit: item.orbit,
    }
  })
  const byId = new Map(nodes.map(node => [node.id, node]))
  const links: ConstellationLink[] = []
  for (const item of sorted) {
    if (!item.relatedItemId || item.relatedItemId === item.id) continue
    const from = byId.get(item.id)
    const to = byId.get(item.relatedItemId)
    if (!from || !to) continue
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.hypot(dx, dy) || 1
    links.push({
      fromId: from.id,
      toId: to.id,
      x1: mapCoordinate(from.x + (dx / distance) * from.radius),
      y1: mapCoordinate(from.y + (dy / distance) * from.radius),
      x2: mapCoordinate(to.x - (dx / distance) * to.radius),
      y2: mapCoordinate(to.y - (dy / distance) * to.radius),
    })
  }

  return {
    size,
    centre: { x: mapCoordinate(centre), y: mapCoordinate(centre), radius: centreRadius },
    nodes,
    rings: [...new Set(assigned.map(item => mapCoordinate(item.ringR, 1)))],
    links,
  }
}

export function spherePreview(body: string, max = 36) {
  const text = body.trim().replace(/\s+/g, ' ')
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const base = (space > 12 ? cut.slice(0, space) : cut).trimEnd()
  return `${base}…`
}

// Short horizontal lines for a sphere. Words stay whole. Text that does not
// fit ends on the last line with an ellipsis, still on a word boundary.
export function sphereLines(body: string, maxLines = 3, maxChars = 16) {
  const words = body.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (words.length === 0 || maxLines < 1 || maxChars < 2) return []
  const lines: string[] = []
  let index = 0

  while (index < words.length && lines.length < maxLines) {
    const isLast = lines.length === maxLines - 1
    let line = ''

    while (index < words.length) {
      const word = words[index]
      const candidate = line ? `${line} ${word}` : word
      const wordsRemain = index < words.length - 1
      if (isLast) {
        const limited = wordsRemain ? `${candidate}…` : candidate
        if (limited.length <= maxChars) {
          line = candidate
          index += 1
          continue
        }
        if (!line) {
          lines.push(`${word.slice(0, maxChars - 1).trimEnd()}…`)
          return lines
        }
        break
      }
      if (candidate.length <= maxChars) {
        line = candidate
        index += 1
        continue
      }
      if (!line) {
        lines.push(`${word.slice(0, maxChars - 1).trimEnd()}…`)
        return lines
      }
      break
    }

    if (line) lines.push(isLast && index < words.length ? `${line}…` : line)
  }

  return lines
}
