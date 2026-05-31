import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')

    if (!key) {
      return Response.json({ error: 'Missing key' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.storage
      .from('voices')
      .createSignedUrl(key, 3600) // 1 hour expiry

    if (error || !data) {
      return Response.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    return Response.json({ url: data.signedUrl })
  } catch (err) {
    console.error('Signed URL error:', err)
    return Response.json({ error: 'Failed' }, { status: 500 })
  }
}
