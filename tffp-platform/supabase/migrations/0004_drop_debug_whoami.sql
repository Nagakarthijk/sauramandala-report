-- Removes the temporary diagnostic function added in
-- 0003_debug_whoami.sql, now that the actual issue (RETURNING requiring
-- SELECT-policy visibility on a row inserted before its project_members
-- row existed) has been identified and fixed in app code.

drop function if exists whoami();
