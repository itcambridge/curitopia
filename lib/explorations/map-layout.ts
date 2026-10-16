import type { Question } from '@/lib/explorations/types'

export const MAP_COORDINATE_DECIMALS = 4

export type LaidOut = Question & { x: number; y: number; radius: number; orbit: number; delay: string }

// Node and the browser can disagree in the last bits of sin, cos, and sqrt.
// Four decimal places is far coarser than that gap and is exact enough for a 100×100 viewBox.
export function mapCoordinate(value: number, decimals = MAP_COORDINATE_DECIMALS) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function layoutNodes(questions: Question[], centralQuestionId: string | null): LaidOut[] {
  if (questions.length === 0) return []
  const hub = centralQuestionId != null
    ? questions.find(question => question.id === centralQuestionId) ?? null
    : questions[0]
  const satellites = hub ? questions.filter(question => question.id !== hub.id) : questions
  const satCount = satellites.length
  const satR = satCount > 60 ? 3.6 : satCount > 25 ? 4.8 : satCount > 10 ? 6.2 : 7.5
  const centralR = 13
  const gap = 1.4
  const firstRing = centralR + satR + gap + 3.5
  const assigned: { orbit: number; ringR: number; indexInRing: number; capacity: number }[] = []
  let orbit = 1
  let ringR = firstRing
  let placedInRing = 0
  let capacity = Math.max(6, Math.floor((2 * Math.PI * ringR) / (2 * satR + gap)))

  for (let i = 0; i < satCount; i++) {
    if (placedInRing >= capacity) {
      orbit += 1
      ringR = firstRing + (orbit - 1) * (2 * satR + gap + 2.2)
      capacity = Math.max(8, Math.floor((2 * Math.PI * ringR) / (2 * satR + gap)))
      placedInRing = 0
    }
    assigned.push({ orbit, ringR, indexInRing: placedInRing, capacity })
    placedInRing += 1
  }

  const maxExtent = assigned.reduce((max, item) => Math.max(max, item.ringR + satR), centralR)
  const scale = maxExtent > 47 ? 47 / maxExtent : 1

  let satelliteIndex = 0
  return questions.map(question => {
    if (hub && question.id === hub.id) {
      return {
        ...question,
        x: mapCoordinate(50),
        y: mapCoordinate(50),
        radius: mapCoordinate(Math.max(centralR * scale, 9)),
        orbit: 0,
        delay: '0ms',
      }
    }
    const item = assigned[satelliteIndex]
    satelliteIndex += 1
    const angle = (item.indexInRing / item.capacity) * 2 * Math.PI - Math.PI / 2
    const radius = item.ringR * scale
    return {
      ...question,
      x: mapCoordinate(50 + Math.cos(angle) * radius),
      y: mapCoordinate(50 + Math.sin(angle) * radius),
      radius: mapCoordinate(satR * scale),
      orbit: item.orbit,
      delay: `${satelliteIndex * 80}ms`,
    }
  })
}

// One decimal place keeps every node on a ring on the same dashed circle.
export function orbitRingRadii(nodes: Pick<LaidOut, 'x' | 'y' | 'orbit'>[]) {
  return [...new Set(nodes.filter(node => node.orbit > 0).map(node => {
    const dx = node.x - 50
    const dy = node.y - 50
    return mapCoordinate(Math.sqrt(dx * dx + dy * dy), 1)
  }))]
}

export function labelLineY(nodeY: number, lineCount: number, lineIndex: number) {
  const startY = nodeY - ((lineCount - 1) * 1.7) / 2
  return mapCoordinate(startY + lineIndex * 1.8)
}
