import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractThemes } from '@/lib/claude/extractThemes'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { translation_id, english_text, question_id, language } = body

    if (!translation_id || !english_text) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await extractThemes(english_text, question_id ?? 'unknown', language ?? 'unknown')

    const supabase = createServiceClient()
    await supabase
      .from('translations')
      .update({
        themes: result.themes,
        domain: result.domain,
        updated_at: new Date().toISOString(),
      })
      .eq('id', translation_id)

    return Response.json({ success: true, ...result })
  } catch (err) {
    console.error('Theme extraction error:', err)
    return Response.json({ error: 'Theme extraction failed' }, { status: 500 })
  }
}
