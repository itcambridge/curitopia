'use client'

import { useActionState } from 'react'
import { requestPasswordReset, type AuthActionState } from '@/lib/auth/actions'

const initialState: AuthActionState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'reset-error' : state.message ? 'reset-message' : undefined} />
      {state.error ? <p id="reset-error" className="auth-message error" role="alert">{state.error}</p> : null}
      {state.message ? <p id="reset-message" className="auth-message success" role="status">{state.message}</p> : null}
      <button className="add-button" type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
    </form>
  )
}
