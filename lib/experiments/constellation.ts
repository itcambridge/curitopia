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

const ITEM_RADIUS = 10
const CENTRE_RADIUS = 15
const GAP = 4.5

// How many spheres fit on this ring with a clear gap between their edges.
// The check uses the chord, which is the real distance between neighbours.
function ringCapacity(ringR: number) {
  const needed = 2 * ITEM_RADIUS + GAP
  let count = 1
  while (count < 48) {
    const chord = 2 * ringR * Math.sin(Math.PI / (count + 1))
    if (chord < needed) break
    count += 1
  }
  return count
}

// Items on one ring are spaced evenly in saved order. The first step is
// offset by half a place so a pair sits to the left and right of the question
// instead of stacking above and below it. Editing text does not change order,
// so a refresh or a small edit leaves the spheres in place.
export function layoutConstellation(items: readonly ConstellationItem[]): ConstellationLayout {
  const sorted = [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  const assigned: { id: string; orbit: number; ringR: number; indexInRing: number; capacity: number }[] = []
  let orbit = 1
  let ringR = CENTRE_RADIUS + ITEM_RADIUS + GAP
  let placedInRing = 0
  let capacity = ringCapacity(ringR)

  for (const item of sorted) {
    if (placedInRing >= capacity) {
      orbit += 1
      ringR += 2 * ITEM_RADIUS + GAP
      capacity = ringCapacity(ringR)
      placedInRing = 0
    }
    assigned.push({ id: item.id, orbit, ringR, indexInRing: placedInRing, capacity })
    placedInRing += 1
  }

  const maxExtent = assigned.reduce((max, item) => Math.max(max, item.ringR + ITEM_RADIUS), CENTRE_RADIUS)
  const size = Math.max(100, Math.ceil((maxExtent + 6) * 2))
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
      radius: ITEM_RADIUS,
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
    centre: { x: mapCoordinate(centre), y: mapCoordinate(centre), radius: CENTRE_RADIUS },
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
