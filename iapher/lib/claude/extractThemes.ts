import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function extractThemes(
  translatedText: string,
  questionId: string,
  language: string
): Promise<{
  themes: string[]
  domain: string
  sentiment: 'positive' | 'neutral' | 'mixed' | 'difficult'
  wellbeingFlags: string[]
}> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `You are analysing an anonymous youth wellbeing response from Meghalaya, India.
Question category: ${questionId}
Original language: ${language}
Translated response: "${translatedText}"

Return ONLY valid JSON:
{
  "themes": ["2-4 word theme tag"],
  "domain": "employment|mental_health|relationships|sexual_health|climate|physical_health|future_anxiety|community|family|education|substance_use|other",
  "sentiment": "positive|neutral|mixed|difficult",
  "wellbeingFlags": ["migration_intent|isolation|help_seeking|community_support|climate_grief|employment_stress|relationship_pressure|information_gap"]
}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return { themes: [], domain: 'other', sentiment: 'neutral', wellbeingFlags: [] }
  }
}
