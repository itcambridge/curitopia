'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { allowedOrigin } from '@/lib/auth/redirects'
import { getAuthenticatedClaims } from '@/lib/auth/session'
import { isValidEmail } from '@/lib/auth/validation'
import { hasSupabaseEnv } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

const unconfigured: AuthActionState = { error: 'Authentication is not configured yet.' }

export type AuthActionState = {
  error?: string
  message?: string
}

async function requestOrigin() {
  const headerList = await headers()
  const fromOrigin = allowedOrigin(headerList.get('origin'))
  if (fromOrigin) return fromOrigin

  const host = (headerList.get('x-forwarded-host') ?? headerList.get('host') ?? '').split(',')[0]?.trim()
  if (!host) return null
  const forwardedProto = headerList.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto = forwardedProto || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return allowedOrigin(`${proto}://${host}`)
}

function authCode(error: { code?: string; message?: string }) {
  return error.code ?? ''
}

export async function signIn(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' }
  if (!password) return { error: 'Enter your password.' }
  if (!hasSupabaseEnv()) return unconfigured

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (authCode(error) === 'email_not_confirmed') {
      return { error: 'Confirm your email before signing in. Use the link in the message we sent.' }
    }
    if (authCode(error) === 'invalid_credentials') {
      return { error: 'Email or password is incorrect.' }
    }
    return { error: 'Sign-in failed. Try again.' }
  }

  redirect('/')
}

export async function signUp(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' }
  if (!password) return { error: 'Enter a password.' }
  if (!hasSupabaseEnv()) return unconfigured

  const origin = await requestOrigin()
  if (!origin) return { error: 'Account creation is not available from this address.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=%2F`,
    },
  })
  if (error) {
    if (authCode(error) === 'weak_password') return { error: 'Choose a longer password.' }
    return { error: 'Account could not be created. Check the email and password, then try again.' }
  }
  if (data.session) redirect('/')

  return {
    message: 'Check your email and confirm the address before signing in. Saved explorations are not available until that confirmation is done.',
  }
}

export async function requestPasswordReset(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' }
  if (!hasSupabaseEnv()) return unconfigured

  const origin = await requestOrigin()
  if (!origin) return { error: 'Password reset is not available from this address.' }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=%2Freset-password`,
  })

  return { message: 'If an account exists for that email, a reset link is on its way.' }
}

export async function updatePassword(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get('password') ?? '')
  if (!password) return { error: 'Enter a new password.' }
  if (!hasSupabaseEnv()) return unconfigured

  const claims = await getAuthenticatedClaims()
  if (!claims) return { error: 'This reset link is invalid or has expired. Request a new one.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (authCode(error) === 'weak_password') return { error: 'Choose a longer password.' }
    return { error: 'The password was not changed. Try a different password.' }
  }

  redirect('/')
}

export async function signOut() {
  if (!hasSupabaseEnv()) redirect('/login')
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) redirect('/?error=signout')
  redirect('/login')
}
