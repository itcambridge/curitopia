const palette = ['#55baff', '#a969f4', '#71e7bf', '#ef8bc2', '#ffb84d'] as const

export function colourFromQuestionId(id: string) {
  const hex = id.replace(/-/g, '').slice(0, 8)
  const parsed = Number.parseInt(hex, 16)
  const index = Number.isNaN(parsed) ? 0 : parsed % palette.length
  return palette[index]
}
