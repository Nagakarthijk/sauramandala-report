import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client — server-only, bypasses RLS. Used exclusively for
// operations an ordinary member policy can't express, like inviting a
// user by email who may not have an account yet. Never import this into
// anything that runs in the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server');
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
