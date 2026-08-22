// Netlify Edge Function — proxy to Claude API for AI field extraction
// Keeps ANTHROPIC_API_KEY out of the browser.
// Endpoint: POST /.netlify/edge-functions/ai-extract
// Body: { transcript: string, mode: 'entrepreneur' | 'observation' | 'general' }
// Returns: { fields: {...} } or { error: string }

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI not configured on server.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, mode } = body;
  if (!transcript || typeof transcript !== 'string') {
    return new Response(JSON.stringify({ error: 'transcript is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompts = {
    entrepreneur: `You extract structured data from a field agent's spoken notes about an entrepreneur they just met.
Return ONLY valid JSON with these exact keys (omit any you cannot determine):
{
  "name": "full name of the entrepreneur",
  "phone": "10-digit mobile number, digits only",
  "business_name": "name of the business or product",
  "sector": one of: food_processing | handicrafts | agriculture | textile | beauty_wellness | carpentry | printing | energy | services | other,
  "entity_type": one of: individual | shg | partnership | company,
  "location": "village or town name"
}
Rules: Return raw JSON, no markdown fences, no explanation. If a field is unclear, omit it.`,

    observation: `You extract a clean field observation note from a field agent's spoken or typed draft.
Return ONLY valid JSON:
{
  "observation": "concise 1-3 sentence observation, written in third person (e.g. 'Entrepreneur sells pickles from home...')",
  "aspiration": one of: low | medium | high | very_high — based on the entrepreneur's ambition level implied in the note,
  "confidence": one of: low | medium | high — the agent's confidence that this need is real and relevant,
  "stage_hint": one of: observed | qualifying | referred | active | resolved | deferred — only if clearly implied
}
Rules: Return raw JSON, no markdown fences. Aspiration and confidence are about the entrepreneur's situation, not the agent.`,

    general: `You are a helpful assistant for a field agent working with micro-entrepreneurs in rural India.
Summarise the following note into clear, structured bullet points useful for case records.
Return ONLY valid JSON:
{
  "summary": "2-4 sentence summary",
  "key_points": ["point 1", "point 2", ...],
  "suggested_needs": ["need category 1", ...],
  "next_steps": ["step 1", ...]
}
Rules: Return raw JSON, no markdown fences. Keep language simple and actionable.`,
  };

  const systemPrompt = systemPrompts[mode] || systemPrompts.general;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: transcript }],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'AI request failed.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = data.content?.[0]?.text || '';
    let fields;
    try {
      fields = JSON.parse(raw);
    } catch {
      // If Claude returned something that's not pure JSON, try to extract JSON block
      const match = raw.match(/\{[\s\S]*\}/);
      fields = match ? JSON.parse(match[0]) : { summary: raw };
    }

    return new Response(JSON.stringify({ fields }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { path: '/ai-extract' };
