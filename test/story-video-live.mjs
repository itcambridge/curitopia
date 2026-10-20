import { createServer } from 'node:http'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { extname, join } from 'node:path'

const root = new URL('..', import.meta.url)
const outDir = new URL('../.tmp-video-check/', import.meta.url)
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = 8767

mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('tsconfig.json', outDir), JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'bundler',
    outDir: 'out',
    rootDir: '..',
    skipLibCheck: true,
    strict: false,
    paths: { '@/*': ['../*'] },
  },
  files: ['../lib/stories/video.ts'],
}, null, 2))
writeFileSync(new URL('check.html', outDir), `<!doctype html>
<meta charset="utf-8">
<script type="importmap">
{
  "imports": {
    "mediabunny": "/node_modules/mediabunny/dist/bundles/mediabunny.min.mjs",
    "@/lib/stories/export": "/.tmp-video-check/out/lib/stories/export.js",
    "@/lib/stories/export-face": "/.tmp-video-check/out/lib/stories/export-face.js",
    "@/lib/stories/video-plan": "/.tmp-video-check/out/lib/stories/video-plan.js"
  }
}
</script>
<pre id="out">working</pre>
<script type="module">
import { createStoryVideo } from '/.tmp-video-check/out/lib/stories/video.js'
const out = document.querySelector('#out')
const report = async (payload) => {
  out.textContent = JSON.stringify(payload)
  await fetch('/result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
}
const paintBlob = async (colour) => {
  const swatch = document.createElement('canvas')
  swatch.width = 64
  swatch.height = 64
  const paint = swatch.getContext('2d')
  paint.fillStyle = colour
  paint.fillRect(0, 0, 64, 64)
  const blob = await new Promise(resolve => swatch.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.src = url
  await image.decode()
  URL.revokeObjectURL(url)
  return blob
}
const colours = ['#c4483a', '#2f6f4e', '#1d4e89', '#c9a227', '#5b3a8c']
const blobs = []
for (const colour of colours) blobs.push(await paintBlob(colour))
const face = { hook: '', body: '' }
const slides = [
  { face, image: blobs[0], fit: 'cover', showMark: true },
  { face, image: blobs[1], fit: 'contain', showMark: false },
  { face, image: null, fit: 'cover', showMark: false },
  { face, image: blobs[2], fit: 'cover', showMark: false },
  { face, image: blobs[3], fit: 'cover', showMark: false },
  { face, image: blobs[4], fit: 'cover', showMark: false },
]
const options = { holdSeconds: 0.2, fadeSeconds: 0.2, onProgress() {} }
try {
  const controller = new AbortController()
  const cancelled = createStoryVideo(slides, { ...options, signal: controller.signal })
  controller.abort()
  let cancel = null
  try { await cancelled } catch (error) { cancel = { code: error && error.code, index: error && error.index, stage: error && error.stage } }
  let failure = null
  try {
    await createStoryVideo([
      slides[0],
      slides[1],
      { face, image: new Blob([1, 2, 3, 4], { type: 'image/png' }), fit: 'cover', showMark: false },
    ], { ...options, signal: new AbortController().signal })
  } catch (error) {
    failure = { code: error && error.code, index: error && error.index, stage: error && error.stage }
  }
  const blob = await createStoryVideo(slides, { ...options, signal: new AbortController().signal })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await fetch('/file', { method: 'POST', body: bytes })
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.src = URL.createObjectURL(blob)
  document.body.append(video)
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve
    video.onerror = () => reject(video.error || new Error('playback'))
  })
  const sample = async (time) => {
    video.currentTime = time
    await new Promise(resolve => { video.onseeked = resolve })
    const frame = document.createElement('canvas')
    frame.width = 8
    frame.height = 8
    const ctx = frame.getContext('2d')
    ctx.drawImage(video, 0, 0, 8, 8)
    return Array.from(ctx.getImageData(4, 4, 1, 1).data)
  }
  const times = [0.05, 0.45, 0.85, 1.25, 1.65, 2.05]
  const pixels = []
  for (const time of times) pixels.push(await sample(time))
  await report({
    ok: true,
    bytes: bytes.length,
    type: blob.type,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    duration: video.duration,
    pixels,
    cancel,
    failure,
  })
} catch (error) {
  await report({ ok: false, name: error && error.name, code: error && error.code, index: error && error.index, stage: error && error.stage })
}
</script>
`)

const compiled = spawn(process.execPath, [join(root.pathname.replace(/^\/(\w:)/, '$1'), 'node_modules/typescript/lib/tsc.js'), '-p', '.tmp-video-check/tsconfig.json'], {
  cwd: new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
  stdio: 'inherit',
})
const compileCode = await new Promise(resolve => compiled.on('exit', resolve))
if (compileCode !== 0) process.exit(compileCode)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
}
let result = null
let file = null
const server = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/result') {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
      result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      response.end('ok')
    })
    return
  }
  if (request.method === 'POST' && request.url === '/file') {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
      file = Buffer.concat(chunks)
      response.end('ok')
    })
    return
  }
  const url = new URL(request.url || '/', 'http://127.0.0.1')
  let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  if (relative === 'logo-removebg-preview.png') relative = 'public/logo-removebg-preview.png'
  const filePath = join(new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), relative)
  try {
    const body = readFileSync(filePath)
    response.writeHead(200, { 'content-type': types[extname(filePath)] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('missing')
  }
})

await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
const userData = new URL('../.tmp-video-check/chrome/', import.meta.url)
const browser = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  `--user-data-dir=${userData.pathname.replace(/^\/(\w:)/, '$1')}`,
  '--no-first-run',
  '--autoplay-policy=no-user-gesture-required',
  `http://127.0.0.1:${port}/.tmp-video-check/check.html`,
], { stdio: 'ignore' })

const deadline = Date.now() + 120000
while (!result && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 250))
browser.kill()
server.close()
if (!result) {
  console.error('The browser did not finish the encode.')
  process.exit(1)
}
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2))
  process.exit(1)
}
const header = file ? file.subarray(0, 16).toString('latin1') : ''
const saved = new URL('../.tmp-video-check/curitopia-story.mp4', import.meta.url)
if (file) writeFileSync(saved, file)
const webm = file ? file[0] === 0x1a && file[1] === 0x45 : true
const avc = file ? file.includes(Buffer.from('avc1')) || file.includes(Buffer.from('avc3')) : false
const pixels = result.pixels || []
const looks = [
  pixel => pixel[0] > pixel[1] + 40 && pixel[0] > pixel[2] + 40,
  pixel => pixel[1] > pixel[0] + 20 && pixel[1] > pixel[2] + 20,
  pixel => pixel[0] < 90 && pixel[1] < 90 && pixel[2] < 120,
  pixel => pixel[2] > pixel[0] + 20 && pixel[2] > pixel[1] + 20,
  pixel => pixel[0] > 140 && pixel[1] > 100 && pixel[2] < 140,
  pixel => pixel[2] > pixel[0] && pixel[2] > pixel[1],
]
const orderOk = pixels.length === 6 && pixels.every((pixel, index) => looks[index](pixel))
const summary = { ...result, header, webm, avc, orderOk }
console.log(JSON.stringify(summary, null, 2))
const passed = header.includes('ftyp') && !webm && avc && result.videoWidth === 1080 && result.videoHeight === 1920 && result.duration > 2 && result.duration < 2.6 && result.type === 'video/mp4' && result.cancel?.code === 'cancelled' && result.failure?.code === 'render' && result.failure?.index === 2 && result.failure?.stage === 'decode' && orderOk
try { rmSync(userData, { recursive: true, force: true }) } catch { /* Chrome can keep the profile lock for a moment. */ }
process.exit(passed ? 0 : 1)
