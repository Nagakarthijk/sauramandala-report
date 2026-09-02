-- ═══════════════════════════════════════════════════════════════
-- TEMPORARY diagnostic function — remove once the project-creation
-- RLS issue is resolved.
-- ═══════════════════════════════════════════════════════════════
-- Unlike is_project_member() etc., this is SECURITY INVOKER (the
-- default) on purpose: it must reflect exactly what auth.uid() and
-- auth.role() resolve to for the CALLING request, not bypass anything.
-- If this returns uid = null / role = anon for a request the app
-- believes is authenticated, that proves the user's access token isn't
-- reaching PostgREST as the Authorization header for that request.

create or replace function whoami()
returns table(uid uuid, role text)
language sql
security invoker
stable
as $$
  select auth.uid(), auth.role();
$$;

grant execute on function whoami() to authenticated, anon;
