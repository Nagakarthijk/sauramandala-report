import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface FGDNoteInput {
  note_type: string
  question_id: string | null
  text_content: string
  recording_timestamp_sec: number | null
}

export interface FGDInsightInput {
  key_themes: string | null
  surprises: string | null
  silences: string | null
  disagreements: string | null
  local_concepts: string | null
  direct_quotes: string | null
  action_signals: string | null
  followup_needed: string | null
}

export async function generateFGDSummary(
  notes: FGDNoteInput[],
  facilitatorInsights: FGDInsightInput,
  sessionMeta: {
    centre: string
    participant_count: number | null
    primary_language: string | null
    age_range: string | null
    gender_composition: string | null
  }
): Promise<string> {
  const notesText = notes
    .map(
      (n) =>
        `[${n.note_type.toUpperCase()}${n.question_id ? ` Q:${n.question_id}` : ''}${n.recording_timestamp_sec != null ? ` @${n.recording_timestamp_sec}s` : ''}]: ${n.text_content}`
    )
    .join('\n')

  const insightsText = Object.entries(facilitatorInsights)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: `You are a qualitative research analyst helping a youth wellbeing programme in Meghalaya, India.

You have just received notes and facilitator reflections from a Focus Group Discussion (FGD) conducted at ${sessionMeta.centre}.

Session details:
- Participants: ${sessionMeta.participant_count ?? 'unknown'}
- Primary language: ${sessionMeta.primary_language ?? 'unknown'}
- Age range: ${sessionMeta.age_range ?? 'unknown'}
- Gender composition: ${sessionMeta.gender_composition ?? 'unknown'}

LIVE NOTES FROM SESSION:
${notesText || '(No live notes recorded)'}

FACILITATOR POST-SESSION REFLECTIONS:
${insightsText || '(No reflections provided)'}

Please write a structured qualitative summary of this FGD session. Your summary should:
1. Identify and synthesise the 3-5 most significant themes
2. Note what was said openly vs. what appeared difficult to say
3. Highlight any quotes or moments that were particularly revealing
4. Flag any urgent wellbeing concerns that need follow-up
5. Identify actionable signals for the CMYC programme
6. Note limitations (group dynamics, silences, representation gaps)

Write in clear, analytical prose. Be specific and grounded in the notes. Do not generalise beyond what was observed. This summary will be used for programme design and research — accuracy and nuance matter more than positivity.`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
