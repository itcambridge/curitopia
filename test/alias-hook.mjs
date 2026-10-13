import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function aliasUrl(specifier) {
  const base = join(root, specifier.slice(2))
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return pathToFileURL(candidate).href
  }
  return pathToFileURL(base).href
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) return { url: aliasUrl(specifier), shortCircuit: true }
  return nextResolve(specifier, context)
}
