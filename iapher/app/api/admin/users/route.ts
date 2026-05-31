import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { session } } = await supabase.auth.getSession()
  const role = session?.user?.user_metadata?.role
  if (!session || role !== 'admin') return false
  return true
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!(await requireAdmin(supabase))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('listener_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return Response.json({ error: 'Failed to fetch users' }, { status: 500 })

    return Response.json({ users: data })
  } catch (err) {
    console.error('Admin users GET error:', err)
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!(await requireAdmin(supabase))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { email, display_name, languages, centre } = body

    if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

    const serviceClient = createServiceClient()

    // Invite user via Supabase Auth
    const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email,
      { data: { role: 'listener' } }
    )

    if (inviteError || !invited.user) {
      return Response.json({ error: 'Failed to invite user' }, { status: 500 })
    }

    await serviceClient.from('listener_profiles').insert({
      id: invited.user.id,
      display_name: display_name ?? email,
      languages: languages ?? [],
      centre: centre ?? null,
      is_active: true,
    })

    return Response.json({ success: true, userId: invited.user.id })
  } catch (err) {
    console.error('Admin users POST error:', err)
    return Response.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    if (!(await requireAdmin(supabase))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, is_active, display_name, languages, centre } = body

    if (!id) return Response.json({ error: 'User id required' }, { status: 400 })

    const serviceClient = createServiceClient()
    const { error } = await serviceClient
      .from('listener_profiles')
      .update({ is_active, display_name, languages, centre })
      .eq('id', id)

    if (error) return Response.json({ error: 'Failed to update user' }, { status: 500 })

    return Response.json({ success: true })
  } catch (err) {
    console.error('Admin users PATCH error:', err)
    return Response.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
