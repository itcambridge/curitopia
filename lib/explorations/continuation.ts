export type StoredExplorationStatus = 'active' | 'completed'

/** A saved exploration stays editable whether or not it was previously marked completed. */
export function acceptsFurtherQuestions(status: StoredExplorationStatus | null): boolean {
  return status === null || status === 'active' || status === 'completed'
}

/** Opening the library or another exploration must not write questions or status. */
export function workspaceLeaveEffect(): { writes: readonly []; resetsQuestions: false; changesStatus: false } {
  return { writes: [], resetsQuestions: false, changesStatus: false }
}
