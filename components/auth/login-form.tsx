'use client'

import { useActionState } from 'react'
import { signIn, type AuthActionState } from '@/lib/auth/actions'

const initialState: AuthActionState = {}

export function LoginForm({ linkError }: { linkError?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState)
  const error = state.error ?? linkError

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={error ? true : undefined} aria-describedby={error ? 'login-error' : undefined} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={error ? true : undefined} aria-describedby={error ? 'login-error' : undefined} />
      {error ? <p id="login-error" className="auth-message error" role="alert">{error}</p> : null}
      <button className="add-button" type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
