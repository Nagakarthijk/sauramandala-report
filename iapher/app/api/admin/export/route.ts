import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase.auth.getUser()
    const jwt = await supabase.auth.getSession()
    const role = jwt.data.session?.user?.user_metadata?.role
    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') ?? 'json'
    const district = searchParams.get('district')
    const section = searchParams.get('section')
    const lang = searchParams.get('lang')

    const serviceClient = createServiceClient()

    let query = serviceClient
      .from('responses')
      .select(`
        id,
        question_id,
        section,
        response_type,
        choice_index,
        multi_indices,
        scale_value,
        text_content,
        has_voice,
        voice_duration_sec,
        created_at,
        sessions!inner(lang, district, entry_mode, completed_at),
        translations(english_text, themes, domain, translation_quality)
      `)
      .not('sessions.completed_at', 'is', null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (district) query = (query as any).eq('sessions.district', district)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (section) query = (query as any).eq('section', section)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (lang) query = (query as any).eq('sessions.lang', lang)

    const { data, error } = await query.order('created_at', { ascending: false }).limit(10000)

    if (error) {
      return Response.json({ error: 'Export failed' }, { status: 500 })
    }

    if (format === 'csv') {
      const rows = data ?? []
      if (rows.length === 0) {
        return new Response('No data', { headers: { 'Content-Type': 'text/csv' } })
      }

      const headers = [
        'id', 'question_id', 'section', 'response_type',
        'choice_index', 'scale_value', 'text_content', 'has_voice',
        'lang', 'district', 'entry_mode', 'completed_at',
        'english_translation', 'themes', 'domain',
      ]

      const csvRows = rows.map((r: Record<string, unknown>) => {
        const session = r.sessions as Record<string, unknown> ?? {}
        const translation = (r.translations as Record<string, unknown>[])?.[0] ?? {}
        return [
          r.id,
          r.question_id,
          r.section,
          r.response_type,
          r.choice_index ?? '',
          r.scale_value ?? '',
          `"${String(r.text_content ?? '').replace(/"/g, '""')}"`,
          r.has_voice ? 'yes' : 'no',
          session.lang ?? '',
          session.district ?? '',
          session.entry_mode ?? '',
          session.completed_at ?? '',
          `"${String(translation.english_text ?? '').replace(/"/g, '""')}"`,
          `"${((translation.themes as string[]) ?? []).join('; ')}"`,
          translation.domain ?? '',
        ].join(',')
      })

      const csv = [headers.join(','), ...csvRows].join('\n')

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="iapher-export-${Date.now()}.csv"`,
        },
      })
    }

    return Response.json({ data, count: data?.length ?? 0 })
  } catch (err) {
    console.error('Export error:', err)
    return Response.json({ error: 'Export failed' }, { status: 500 })
  }
}
