'use client'

import { useActionState } from 'react'
import { signUp, type AuthActionState } from '@/lib/auth/actions'

const initialState: AuthActionState = {}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState)

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'signup-error' : state.message ? 'signup-message' : undefined} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'signup-error' : undefined} />
      {state.error ? <p id="signup-error" className="auth-message error" role="alert">{state.error}</p> : null}
      {state.message ? <p id="signup-message" className="auth-message success" role="status">{state.message}</p> : null}
      <button className="add-button" type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
    </form>
  )
}
