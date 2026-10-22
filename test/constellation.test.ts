import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { constellationStageSide, layoutConstellation, renderedCircle, sphereLines, spherePreview, type ConstellationItem } from '@/lib/experiments/constellation'
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
    assert.equal(node.radius >= 6, true)
    assert.equal(node.radius < first.centre.radius, true)
  }
  separated(first)
})

test('growing experiments stay apart and inside the canvas', () => {
  for (const count of [0, 1, 6, 8, 12, 20, 30]) {
    const layout = layoutConstellation(Array.from({ length: count }, (_, index) => item(`n-${index}`, index)))
    separated(layout)
    const circles = [layout.centre, ...layout.nodes]
    for (let i = 0; i < circles.length; i += 1) {
      for (let j = i + 1; j < circles.length; j += 1) {
        const distance = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y)
        assert.equal(distance + 0.05 >= circles[i].radius + circles[j].radius + 3, true, `${count} gap`)
      }
    }
    for (const circle of circles) {
      assert.equal(circle.x - circle.radius >= -0.05, true, `${count} left`)
      assert.equal(circle.x + circle.radius <= layout.size + 0.05, true, `${count} right`)
      assert.equal(circle.y - circle.radius >= -0.05, true, `${count} top`)
      assert.equal(circle.y + circle.radius <= layout.size + 0.05, true, `${count} bottom`)
    }
    if (count > 8) assert.equal(layout.nodes.some(node => node.orbit > 1), true)
  }

  const placed = (count: number) => layoutConstellation(Array.from({ length: count }, (_, index) => item(`keep-${index}`, index)))
  const around = (layout: ReturnType<typeof layoutConstellation>, orbit: number) => layout.nodes
    .filter(node => node.orbit === orbit)
    .map(node => [node.id, mapCoordinate(node.x - layout.centre.x), mapCoordinate(node.y - layout.centre.y), node.radius])
  const six = placed(6)
  const seven = placed(7)
  assert.equal(seven.nodes.some(node => node.orbit > 1), true)
  assert.deepEqual(around(seven, 1), around(six, 1))
  const twelve = placed(12)
  const thirteen = placed(13)
  assert.deepEqual(around(thirteen, 1), around(twelve, 1))

  for (const [width, height] of [[1400, 760], [390, 700], [1100, 500], [1920, 900]]) {
    const header = 148
    const canvasHeight = Math.max(0, height - header)
    const side = constellationStageSide(width, canvasHeight)
    assert.equal(side > 0 && side <= width && side <= canvasHeight, true)
    for (const count of [6, 12, 20, 30]) {
      const layout = layoutConstellation(Array.from({ length: count }, (_, index) => item(`fit-${count}-${index}`, index)))
      const circles = [layout.centre, ...layout.nodes].map(circle => renderedCircle(circle, layout.size, side))
      let top = side
      for (const circle of circles) {
        assert.equal(circle.cy - circle.radius >= -0.5, true)
        assert.equal(circle.cy + circle.radius <= side + 0.5, true)
        assert.equal(circle.cx - circle.radius >= -0.5, true)
        assert.equal(circle.cx + circle.radius <= side + 0.5, true)
        top = Math.min(top, circle.cy - circle.radius)
      }
      assert.equal(top >= side * 0.04, true, `${count} heading clearance`)
      for (let i = 0; i < circles.length; i += 1) {
        for (let j = i + 1; j < circles.length; j += 1) {
          const distance = Math.hypot(circles[i].cx - circles[j].cx, circles[i].cy - circles[j].cy)
          assert.equal(distance >= circles[i].radius + circles[j].radius + side * 0.02, true, `${width}x${height} ${count}`)
        }
      }
    }
  }
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
  assert.match(screen, /aria-label="Map"/)
  assert.match(screen, /aria-label="List"/)
  assert.match(screen, /\+ Experiment/)
  assert.match(screen, /className="sidebar experiment-sidebar"/)
  assert.equal(screen.includes('role="dialog"'), false)
  assert.equal(screen.includes('experiment-toolbar'), false)
  const sidebar = screen.slice(screen.indexOf('className="sidebar experiment-sidebar"'), screen.indexOf('className="experiment-workspace"'))
  assert.match(sidebar, /aria-label="Question page"/)
  assert.match(sidebar, /href=\{`\/explorations\/\$\{experiment\.explorationId\}`\}/)
  assert.match(sidebar, /aria-label="Create a Story"/)
  assert.match(sidebar, /href=\{`\/explorations\/\$\{experiment\.explorationId\}\/story`\}/)
  assert.match(sidebar, /\+ Experiment/)
  assert.match(sidebar, /experiment-icon-row/)
  assert.match(sidebar, /experiment-detail/)
  assert.match(sidebar, /ThoughtEditor/)
  assert.match(sidebar, /aria-label=\{experiment\.hasFocusImage \? imageLabel : 'Hide image'\}/)
  assert.match(sidebar, /aria-pressed=\{focusHidden\}/)
  assert.match(sidebar, /aria-label=\{experiment\.hasFocusImage \? dimLabel : 'Dim image'\}/)
  assert.match(sidebar, /aria-pressed=\{focusDimmed\}/)
  const workspace = screen.slice(screen.indexOf('className="experiment-workspace"'), screen.indexOf('function SphereMark'))
  assert.equal(workspace.includes('className="experiment-detail"'), false)
  assert.equal(workspace.includes('experiment-question-bar'), false)
  assert.equal(workspace.includes('Explore the ideas behind your question'), false)
  assert.equal(workspace.includes('About tests'), false)
  assert.match(screen, /draft\.kind === 'test'[\s\S]*If a test would change a live system/)
  assert.match(screen, /layoutConstellation/)
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
  assert.match(screen, /constellation-fit/)
  assert.match(screen, /node\.radius \* 2 \/ layout\.size/)
  assert.match(screen, /node\.x \/ layout\.size/)
  assert.match(screen, /node\.y \/ layout\.size/)
  assert.match(css, /\.constellation-stage \{[^}]*position:relative/)
  assert.match(css, /\.constellation-fit \{[^}]*width:min\(100cqw, 100cqh\)[^}]*height:min\(100cqw, 100cqh\)/)
  assert.equal(css.includes('68cqh'), false)
  assert.equal(css.includes('780px'), false)
  assert.match(screen, /\/api\/explorations\/\$\{experiment\.explorationId\}\/focus-image/)
  assert.match(screen, /setFocusHidden/)
  assert.match(screen, /setFocusDimmed/)
  assert.equal(screen.includes("'/focus-image', { method: 'POST'"), false)
  const load = readFileSync(new URL('../lib/experiments/load.ts', import.meta.url), 'utf8')
  assert.match(load, /select\('focus_image_path'\)/)
  assert.equal(load.includes(".from('explorations').update"), false)
  assert.equal(load.includes(".from('explorations').insert"), false)
})
