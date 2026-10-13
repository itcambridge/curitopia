export const reflectionResponseSchema: { [key: string]: unknown } = {
  type: 'object',
  additionalProperties: false,
  required: ['overview', 'themes', 'connections', 'prioritised', 'furtherQuestions'],
  properties: {
    overview: { type: 'string' },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'explanation', 'questionIds'],
        properties: {
          title: { type: 'string' },
          explanation: { type: 'string' },
          questionIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    connections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['connection', 'explanation', 'support', 'questionIds'],
        properties: {
          connection: { type: 'string' },
          explanation: { type: 'string' },
          support: { type: 'string', enum: ['speculative', 'supported'] },
          questionIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    prioritised: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'observations'],
      properties: {
        summary: { type: 'string' },
        observations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['questionId', 'note'],
            properties: {
              questionId: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
      },
    },
    furtherQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string' } },
      },
    },
  },
}
