import { NextResponse } from 'next/server'
import { getAuthenticatedClaims } from '@/lib/auth/session'
import { loadExploration } from '@/lib/explorations/load'
import { reflectForExploration } from '@/lib/reflection/decide'
import { requestReflection } from '@/lib/reflection/openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const result = await reflectForExploration({
    signedIn: Boolean(await getAuthenticatedClaims()),
    load: () => loadExploration(id),
    reflect: requestReflection,
  })
  return NextResponse.json(result.body, { status: result.status, headers: { 'cache-control': result.cacheControl } })
}
