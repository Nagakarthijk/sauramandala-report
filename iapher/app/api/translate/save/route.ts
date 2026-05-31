import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { response_id, english_text, original_language, flagged_for_review } = body

    if (!response_id || !english_text) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data: translation, error } = await serviceClient
      .from('translations')
      .insert({
        response_id,
        translator_id: user.id,
        original_language: original_language ?? 'unknown',
        english_text,
        translation_quality: 'draft',
        flagged_for_review: flagged_for_review ?? false,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: 'Failed to save translation' }, { status: 500 })
    }

    // Fire-and-forget theme extraction
    void serviceClient
      .from('responses')
      .select('question_id')
      .eq('id', response_id)
      .single()
      .then(({ data: resp }) => {
        if (!resp) return
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/translate/extract-themes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            translation_id: translation.id,
            english_text,
            question_id: resp.question_id,
            language: original_language ?? 'unknown',
          }),
        }).catch(console.error)
      })

    return Response.json({ translation })
  } catch (err) {
    console.error('Translation save error:', err)
    return Response.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, english_text, translation_quality, flagged_for_review } = body

    if (!id) {
      return Response.json({ error: 'Missing translation id' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { error } = await serviceClient
      .from('translations')
      .update({
        english_text,
        translation_quality,
        flagged_for_review,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('translator_id', user.id)

    if (error) {
      return Response.json({ error: 'Failed to update translation' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Translation update error:', err)
    return Response.json({ error: 'Failed to update' }, { status: 500 })
  }
}
