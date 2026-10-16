export const EXPERIMENT_ITEM_CHARACTER_LIMIT = 2000

export const experimentItemKinds = [
  { kind: 'concept', label: 'Concept' },
  { kind: 'note', label: 'Note' },
  { kind: 'hypothesis', label: 'Hypothesis' },
  { kind: 'test', label: 'Test' },
  { kind: 'observation', label: 'Observation' },
  { kind: 'discovery', label: 'Discovery' },
] as const

export type ExperimentItemKind = (typeof experimentItemKinds)[number]['kind']

export function experimentItemKind(value: string): ExperimentItemKind | null {
  return experimentItemKinds.some(item => item.kind === value) ? value as ExperimentItemKind : null
}

/** A new experiment starts from a prioritised question. An existing one can be reopened either way. */
export function mayOpenExperiment(input: { prioritised: boolean; existingExperimentId: string | null }): boolean {
  return input.prioritised || input.existingExperimentId !== null
}

/** The character limit applies to one item, not to the whole experiment. */
export function experimentItemBody(value: string): string | null {
  const text = value.trim()
  if (text.length < 1 || text.length > EXPERIMENT_ITEM_CHARACTER_LIMIT) return null
  return text
}

/** Leaving an experiment, or opening one, does not write the exploration. */
export function experimentLeaveEffect(): { writes: readonly []; changesStatus: false; changesQuestions: false } {
  return { writes: [], changesStatus: false, changesQuestions: false }
}
