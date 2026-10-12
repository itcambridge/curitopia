import type { JwtPayload } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { hasSupabaseEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedClaims(): Promise<JwtPayload | null> {
  if (!hasSupabaseEnv()) return null
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  if (data.claims.role !== 'authenticated' || data.claims.is_anonymous === true) return null
  return data.claims
}

export async function requireAuthenticatedClaims() {
  const claims = await getAuthenticatedClaims()
  if (!claims) redirect('/login')
  return claims
}
