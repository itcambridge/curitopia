'use client'

import { useActionState } from 'react'
import { updatePassword, type AuthActionState } from '@/lib/auth/actions'

const initialState: AuthActionState = {}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState)

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label htmlFor="password">New password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'password-error' : undefined} />
      {state.error ? <p id="password-error" className="auth-message error" role="alert">{state.error}</p> : null}
      <button className="add-button" type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Saving…' : 'Save password'}</button>
    </form>
  )
}
