import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const revalidate = 3600 // cache for 1 hour

export async function GET(_req: NextRequest) {
  try {
    const supabase = createServiceClient()

    const { data: insights } = await supabase
      .from('public_insights')
      .select('*')

    // Aggregate totals
    const total_responses = insights?.reduce((sum, row) => sum + Number(row.response_count), 0) ?? 0
    const unique_sessions_set = new Set<string>()
    const by_district: Record<string, number> = {}
    const by_section: Record<string, number> = {}
    const scale_sums: Record<string, { sum: number; count: number }> = {}
    const choice_counts: Record<string, Record<number, number>> = {}

    for (const row of insights ?? []) {
      if (row.district) {
        by_district[row.district] = (by_district[row.district] ?? 0) + Number(row.response_count)
      }
      if (row.section) {
        by_section[row.section] = (by_section[row.section] ?? 0) + Number(row.response_count)
      }
      if (row.scale_value != null && row.question_id) {
        if (!scale_sums[row.question_id]) scale_sums[row.question_id] = { sum: 0, count: 0 }
        scale_sums[row.question_id].sum += Number(row.scale_value) * Number(row.response_count)
        scale_sums[row.question_id].count += Number(row.response_count)
      }
      if (row.choice_index != null && row.question_id) {
        if (!choice_counts[row.question_id]) choice_counts[row.question_id] = {}
        choice_counts[row.question_id][row.choice_index] =
          (choice_counts[row.question_id][row.choice_index] ?? 0) + Number(row.response_count)
      }
    }

    const scale_averages: Record<string, number> = {}
    for (const [qid, { sum, count }] of Object.entries(scale_sums)) {
      scale_averages[qid] = count > 0 ? Math.round((sum / count) * 10) / 10 : 0
    }

    const top_choices: Record<string, { index: number; count: number }[]> = {}
    for (const [qid, counts] of Object.entries(choice_counts)) {
      top_choices[qid] = Object.entries(counts)
        .map(([index, count]) => ({ index: Number(index), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }

    // Unique sessions from public_insights (approximate)
    const { count: voice_count } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .eq('has_voice', true)

    const { count: pending_translations } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .or('text_content.not.is.null,has_voice.eq.true')

    return Response.json(
      {
        total_responses,
        unique_sessions: insights?.length ?? 0,
        voice_notes: voice_count ?? 0,
        pending_translations: pending_translations ?? 0,
        by_district,
        by_section,
        scale_averages,
        top_choices,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    console.error('Dashboard public error:', err)
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}
