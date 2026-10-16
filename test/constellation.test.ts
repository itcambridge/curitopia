import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { layoutConstellation, sphereLines, spherePreview, type ConstellationItem } from '@/lib/experiments/constellation'
import { mapCoordinate } from '@/lib/explorations/map-layout'

function item(id: string, position: number, relatedItemId: string | null = null): ConstellationItem {
  return { id, position, relatedItemId }
}

function separated(layout: ReturnType<typeof layoutConstellation>) {
  const circles = [layout.centre, ...layout.nodes]
  for (let i = 0; i < circles.length; i += 1) {
    for (let j = i + 1; j < circles.length; j += 1) {
      const left = circles[i]
      const right = circles[j]
      const distance = Math.hypot(left.x - right.x, left.y - right.y)
      assert.equal(distance + 0.05 >= left.radius + right.radius, true)
    }
  }
}

test('the same items keep the same places', () => {
  const items = Array.from({ length: 12 }, (_, index) => item(`item-${index}`, index))
  const first = layoutConstellation(items)
  const second = layoutConstellation(items)
  assert.deepEqual(second, first)
  assert.equal(first.links.length, 0)
  assert.equal(first.nodes.length, 12)
  for (const node of first.nodes) {
    assert.equal(node.x, mapCoordinate(node.x))
    assert.equal(node.y, mapCoordinate(node.y))
    assert.equal(node.radius >= 7, true)
  }
  separated(first)
  separated(layoutConstellation(Array.from({ length: 28 }, (_, index) => item(`many-${index}`, index))))
})

test('a line is drawn only for an explicit relationship', () => {
  const alone = layoutConstellation([item('a', 0), item('b', 1), item('c', 2)])
  assert.deepEqual(alone.links, [])
  const linked = layoutConstellation([item('a', 0), item('b', 1, 'a'), item('c', 2)])
  assert.deepEqual(linked.links.map(link => [link.fromId, link.toId]), [['b', 'a']])
  const missing = layoutConstellation([item('a', 0, 'missing'), item('b', 1)])
  assert.deepEqual(missing.links, [])
  const self = layoutConstellation([item('a', 0, 'a')])
  assert.deepEqual(self.links, [])
  assert.equal(spherePreview('  A short note  '), 'A short note')
  assert.equal(spherePreview('Consciousness without sensory input'), 'Consciousness without sensory input')
  const long = spherePreview('Revisit a place from a previous dream and write down every detail you remember')
  assert.equal(long.endsWith('…'), true)
  assert.equal(long.includes('dream and write'), false)
  assert.equal(/\s…$/.test(long) || !long.slice(0, -1).endsWith(' '), true)
})

test('two thoughts sit beside the question, and more thoughts spread around it', () => {
  const pair = layoutConstellation([item('a', 0), item('b', 1)])
  assert.equal(pair.nodes[0].radius < pair.centre.radius, true)
  for (const node of pair.nodes) {
    const distance = Math.hypot(node.x - pair.centre.x, node.y - pair.centre.y)
    assert.equal(distance >= node.radius + pair.centre.radius + 3, true)
    assert.equal(Math.abs(node.x - pair.centre.x) > node.radius, true)
  }
  assert.equal(Math.abs(pair.nodes[0].y - pair.nodes[1].y) < 1, true)
  assert.equal(pair.nodes[0].x > pair.centre.x, true)
  assert.equal(pair.nodes[1].x < pair.centre.x, true)
  separated(pair)

  const six = layoutConstellation(Array.from({ length: 6 }, (_, index) => item(`spread-${index}`, index)))
  const distinctX = new Set(six.nodes.map(node => node.x))
  assert.equal(distinctX.size >= 3, true)
  assert.equal(six.nodes.some(node => node.x < six.centre.x), true)
  assert.equal(six.nodes.some(node => node.x > six.centre.x), true)
  separated(six)
  const again = layoutConstellation(Array.from({ length: 6 }, (_, index) => item(`spread-${index}`, index)))
  assert.deepEqual(again, six)
})

test('sphere lines wrap on words and keep each line horizontal', () => {
  assert.deepEqual(sphereLines('Consciousness without sensory input', 3, 16), ['Consciousness', 'without sensory', 'input'])
  const long = sphereLines('Revisit a place from a previous dream and write down every detail you remember', 3, 16)
  assert.equal(long.length <= 3, true)
  assert.equal(long.at(-1)?.endsWith('…'), true)
  assert.equal(long.join(' ').includes('dream and write down'), false)
  for (const line of long) {
    assert.equal(line.length > 1, true)
    assert.equal(line.includes('\n'), false)
    assert.equal(/^\S$/.test(line), false)
  }
  const huge = sphereLines('Supercalifragilistic', 3, 10)
  assert.deepEqual(huge, ['Supercali…'])
  assert.equal(sphereLines('   ').length, 0)
})

test('the constellation and the list use one editor', () => {
  const screen = readFileSync(new URL('../components/experiment-screen.tsx', import.meta.url), 'utf8')
  assert.match(screen, /Add thought/)
  assert.match(screen, /> Map</)
  assert.match(screen, /> List</)
  assert.match(screen, /role="dialog"/)
  assert.match(screen, /None is required/)
  assert.match(screen, /layoutConstellation/)
  assert.match(screen, /id="experiment-question"[\s\S]*experiment\.questionText/)
  assert.match(screen, /sphereLines\(experiment\.questionText/)
  assert.match(screen, /sphereLines\(item\.body\)/)
  assert.match(screen, /constellation-mark/)
  assert.match(screen, /experiment-detail-body/)
  assert.equal(screen.includes('>Question<'), false)
  assert.equal(screen.includes('openai'), false)
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  const preview = css.match(/\.constellation-preview \{[^}]+\}/)?.[0] ?? ''
  const spheres = css.match(/\.constellation-centre, \.constellation-sphere \{[^}]+\}/)?.[0] ?? ''
  assert.match(preview, /overflow-wrap:normal/)
  assert.equal(preview.includes('overflow-wrap:anywhere'), false)
  assert.match(spheres, /padding:0/)
  assert.equal(spheres.includes('padding:16%'), false)
})
