// Netlify Edge Function — AI field extraction proxy
// Supports OpenRouter (default/free), Anthropic, Google, Groq.
//
// Set in Netlify → Site → Environment variables:
//   AI_PROVIDER  = openrouter          (or: anthropic | google | groq)
//   AI_API_KEY   = sk-or-...           (your provider key)
//   AI_MODEL     = google/gemini-flash-1.5-8b:free   (optional — provider default used if unset)
//
// Backwards-compatible: ANTHROPIC_API_KEY still works if AI_API_KEY isn't set.

const DEFAULT_MODELS = {
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  anthropic:  'claude-haiku-4-5-20251001',
  google:     'gemini-1.5-flash-8b',
  groq:       'llama-3.3-70b-versatile',
};

const OPENAI_COMPAT_ENDPOINTS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  google:     'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
};

const SYSTEM_PROMPTS = {
  entrepreneur: `You extract structured data from a field agent's spoken notes about an entrepreneur they just met.
Return ONLY valid JSON with these exact keys (omit any you cannot determine):
{"name":"full name","phone":"10-digit mobile, digits only","business_name":"business name",
"sector":"one of: food_processing|handicrafts|agriculture|textile|beauty_wellness|carpentry|printing|energy|services|other",
"entity_type":"one of: individual|shg|partnership|company","location":"village or town"}
Rules: Raw JSON only, no markdown.`,

  observation: `You extract a clean field observation from a spoken/typed note.
Return ONLY valid JSON:
{"observation":"1-3 sentence note in third person","aspiration":"low|medium|high|very_high",
"confidence":"low|medium|high","stage_hint":"observed|qualifying|referred|active|resolved|deferred"}
Rules: Raw JSON only.`,

  general: `You summarise a field agent note about a micro-entrepreneur visit.
Return ONLY valid JSON:
{"summary":"2-4 sentence summary","key_points":["point 1","point 2"],
"suggested_needs":["need 1"],"next_steps":["step 1"]}
Rules: Raw JSON only.`,
};

async function callAI(systemPrompt, userContent, provider, apiKey, model) {
  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!resp.ok) {
      const e = await resp.json();
      throw new Error(e.error?.message || `Anthropic error ${resp.status}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || '';
  }

  // OpenAI-compatible: openrouter, google, groq
  const endpoint = OPENAI_COMPAT_ENDPOINTS[provider] || OPENAI_COMPAT_ENDPOINTS.openrouter;
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://sauramandala.org';
    headers['X-Title'] = 'DRIVE Field App';
  }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent },
      ],
    }),
  });
  if (!resp.ok) {
    const e = await resp.json();
    throw new Error(e.error?.message || `${provider} error ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const provider = Deno.env.get('AI_PROVIDER') || 'openrouter';
  const apiKey   = Deno.env.get('AI_API_KEY') || Deno.env.get('DRIVE_OPENROUTER') || Deno.env.get('ANTHROPIC_API_KEY') || '';
  const model    = Deno.env.get('AI_MODEL') || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openrouter;

  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'AI not configured. Set AI_PROVIDER and AI_API_KEY in Netlify environment variables.',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, mode } = body;
  if (!transcript || typeof transcript !== 'string') {
    return new Response(JSON.stringify({ error: 'transcript is required.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.general;
    const raw = await callAI(systemPrompt, transcript, provider, apiKey, model);

    let fields;
    try {
      // Strip markdown fences if model wrapped the JSON
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      fields = JSON.parse(cleaned);
    } catch {
      // Try to pull any {...} block out of prose wrapping
      const match = raw.match(/\{[\s\S]*?\}/);
      try { fields = match ? JSON.parse(match[0]) : {}; }
      catch { fields = {}; }
    }

    // Return raw alongside fields so client can debug if fields are empty
    return new Response(JSON.stringify({ fields, _raw: raw, _provider: provider, _model: model }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'AI call failed.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const config = { path: '/ai-extract' };
