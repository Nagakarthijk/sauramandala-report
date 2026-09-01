// Shared fallback so a missing Supabase config degrades to "auth doesn't
// work yet" at runtime instead of crashing the build. See client.ts for
// why this matters at build/prerender time.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
