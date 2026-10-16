import assert from 'node:assert/strict'
import test from 'node:test'
import { labelLineY, layoutNodes, mapCoordinate, orbitRingRadii } from '@/lib/explorations/map-layout'
import type { Question } from '@/lib/explorations/types'

function question(id: string, role: Question['role'] = 'satellite'): Question {
  return { id, text: 'What belongs on this orbit?', color: '#8fb4de', role, isPrioritised: false, isHidden: false }
}

function atPrecision(value: number, decimals: number) {
  return value === mapCoordinate(value, decimals)
}

test('coordinates that differ only in the last bits render as the same value', () => {
  const server = 30.341223334093247
  const client = 30.34122333409325
  assert.notEqual(server, client)
  assert.equal(mapCoordinate(server), mapCoordinate(client))
  assert.equal(mapCoordinate(server), 30.3412)
  assert.equal(labelLineY(mapCoordinate(server), 3, 1), labelLineY(mapCoordinate(client), 3, 1))
})

test('layout coordinates stay within four decimal places and a second pass matches the first', () => {
  const hub = question('central', 'central')
  const questions = [hub, ...Array.from({ length: 12 }, (_, index) => question(`satellite-${index}`))]
  const first = layoutNodes(questions, hub.id)
  const second = layoutNodes(questions, hub.id)
  assert.deepEqual(second, first)
  assert.equal(first[0].x, 50)
  assert.equal(first[0].y, 50)
  assert.equal(first[0].orbit, 0)
  for (const node of first) {
    assert.equal(Number.isFinite(node.x), true)
    assert.equal(Number.isFinite(node.y), true)
    assert.equal(node.radius > 0, true)
    assert.equal(node.x >= 0 && node.x <= 100, true)
    assert.equal(node.y >= 0 && node.y <= 100, true)
    assert.equal(atPrecision(node.x, 4), true)
    assert.equal(atPrecision(node.y, 4), true)
    assert.equal(atPrecision(node.radius, 4), true)
    const lines = node.orbit === 0 ? 3 : 2
    for (let line = 0; line < lines; line += 1) {
      const y = labelLineY(node.y, lines, line)
      assert.equal(Number.isFinite(y), true)
      assert.equal(atPrecision(y, 4), true)
    }
  }
  const satellites = first.filter(node => node.orbit > 0)
  assert.equal(satellites.length, 12)
  for (const node of satellites) {
    const distance = Math.hypot(node.x - 50, node.y - 50)
    assert.equal(distance > node.radius, true)
  }
  const rings = orbitRingRadii(first)
  assert.equal(rings.length > 0, true)
  for (const ring of rings) assert.equal(atPrecision(ring, 1), true)
  for (const orbit of new Set(satellites.map(node => node.orbit))) {
    const onOrbit = satellites.filter(node => node.orbit === orbit)
    const radii = new Set(orbitRingRadii(onOrbit))
    assert.equal(radii.size, 1)
  }
})
