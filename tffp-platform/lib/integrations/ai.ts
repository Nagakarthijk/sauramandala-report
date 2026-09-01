// Optional AI assist. Only imported by components that render the
// "Suggest" button, and only called when a project has ai_enabled in
// settings — the rest of the platform never touches this file.
//
// The suggestion is never persisted on its own: callers show it in a
// modal, and only what the human accepts (and then edits and saves
// normally) ever reaches the database. There is no shadow table of AI
// output and no dependency on any provider being reachable.

export type AiProvider = 'anthropic' | 'openai' | 'ollama';

export interface AiSuggestRequest {
  provider: AiProvider;
  apiKey?: string;
  baseUrl?: string; // for an Ollama or other OpenAI-compatible endpoint
  task: 'condense' | 'illustration_prompt';
  input: string;
}

const SYSTEM_PROMPTS: Record<AiSuggestRequest['task'], string> = {
  condense:
    'You help condense an English translation of an oral folk story into a ' +
    '400-700 word story seed for a children\'s book, preserving voice, ' +
    'cultural detail, and the emotional core. Suggest, do not decide.',
  illustration_prompt:
    'You write a single visual illustration prompt (subject, setting, ' +
    'mood, lighting) for one page of a children\'s book manuscript, ' +
    'grounded only in what the page text actually describes.',
};

export async function requestAiSuggestion(req: AiSuggestRequest): Promise<string> {
  if (req.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 600,
        system: SYSTEM_PROMPTS[req.task],
        messages: [{ role: 'user', content: req.input }],
      }),
    });
    if (!res.ok) throw new Error(`AI suggestion failed (${res.status})`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }

  // OpenAI, or any OpenAI-compatible endpoint (including local Ollama).
  const res = await fetch(`${req.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(req.apiKey ? { authorization: `Bearer ${req.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: req.provider === 'ollama' ? 'llama3' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[req.task] },
        { role: 'user', content: req.input },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI suggestion failed (${res.status})`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
