-- Migration 086: Drop orphaned super-like quota RPCs.
--
-- get_super_like_quota_status() — defined in migration 040, never called by
--   any client code. get_super_likes_remaining() (migration 064 / 083) is used
--   instead.
--
-- check_super_like_quota() (no-arg) — also defined in migration 040. Its
--   one-arg overload (migration 071) was the version the client actually called,
--   and that was dropped in migration 083. The no-arg form is now also dead:
--   consume_super_like(UUID) replaced both.

DROP FUNCTION IF EXISTS public.get_super_like_quota_status();
DROP FUNCTION IF EXISTS public.check_super_like_quota();
