-- ============================================================================
-- SafeSpace: close anonymous-role privileges on AI Companion objects
-- Migration: 20261022000000_ai_companion_revoke_anon
--
-- Supabase grants ALL on new public tables and sequences to `anon` by default.
-- 20261020000000 revoked `authenticated` only, and 20261021000000 revoked the
-- attempt-log TABLE but not its identity SEQUENCE. RLS already denies `anon`
-- (every policy checks auth.uid(), which is null for anon); this removes the
-- underlying privileges as a second layer.
--
-- Intended access after this migration:
--   anon           -> nothing (children reach these tables only via Edge
--                     Functions, which use the service role)
--   authenticated  -> SELECT on conversations/messages (RLS: own, or own
--                     child's), nothing on the attempt log
--   service_role   -> unchanged (ALL), used by the ai-companion Edge Function
-- ============================================================================

revoke all on public.ai_companion_conversations from anon;
revoke all on public.ai_companion_messages from anon;

-- Identity sequence behind ai_companion_attempts.id. Slot inserts run inside
-- the security-definer function as its owner, so clients never need it.
revoke all on sequence public.ai_companion_attempts_id_seq from anon, authenticated;
