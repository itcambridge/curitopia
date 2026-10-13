export type ReflectionPhase = 'idle' | 'confirm' | 'loading' | 'ready' | 'error'
export type ReflectionConsentEvent = 'open' | 'cancel' | 'send' | 'succeed' | 'fail'

export function nextReflectionPhase(phase: ReflectionPhase, event: ReflectionConsentEvent, hasReflection: boolean): ReflectionPhase {
  if (event === 'open') return phase === 'loading' ? phase : 'confirm'
  if (event === 'cancel') {
    if (phase !== 'confirm') return phase
    return hasReflection ? 'ready' : 'idle'
  }
  if (event === 'send') {
    if (phase !== 'confirm' && phase !== 'error') return phase
    return 'loading'
  }
  if (event === 'succeed') return 'ready'
  if (event === 'fail') return 'error'
  return phase
}

export function maySendReflection(phase: ReflectionPhase, gates: {
  inFlight: boolean
  overLimit: boolean
  visibleCount: number
  saved: boolean
}): boolean {
  if (gates.inFlight || gates.overLimit || gates.visibleCount === 0 || !gates.saved) return false
  return phase === 'confirm' || phase === 'error'
}
