import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const BLOCKED_PATTERNS = [
  /individual/i,
  /identify/i,
  /who specifically/i,
  /which person/i,
  /personal/i,
  /private/i,
  /name/i,
  /phone/i,
  /contact/i,
  /address/i,
  /location of (a |an |the )?person/i,
]

function isSafeQuery(question: string): boolean {
  return !BLOCKED_PATTERNS.some((p) => p.test(question))
}

export interface PublicDataSummary {
  total_responses: number
  unique_sessions: number
  by_district: Record<string, number>
  by_section: Record<string, number>
  scale_averages: Record<string, number>
  top_choices: Record<string, { index: number; count: number }[]>
}

export async function askPublicData(
  question: string,
  data: PublicDataSummary
): Promise<{ answer: string; safe: boolean }> {
  if (!isSafeQuery(question)) {
    return {
      answer:
        'I can only answer questions about aggregate patterns and trends, not about individual responses. Please ask about overall themes, averages, or group-level findings.',
      safe: false,
    }
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are a data analyst for the Iapher youth wellbeing platform in Meghalaya, India. You have access to anonymised, aggregated survey data. You can only discuss aggregate patterns — never individual responses.

Here is the aggregated dataset:
${JSON.stringify(data, null, 2)}

A user has asked: "${question}"

Rules:
- Only discuss aggregate trends and patterns
- Never speculate about individual respondents
- If asked about individuals or identifying information, decline politely
- Be concise and factual
- Note sample size limitations where relevant
- Use plain language appropriate for a general audience

Answer the question based on the data above:`,
      },
    ],
  })

  return {
    answer: response.content[0].type === 'text' ? response.content[0].text : 'Unable to process query.',
    safe: true,
  }
}
