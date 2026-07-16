-- 002_fix_view_security.sql
-- Recreates job_updates_with_profile view with SECURITY_INVOKER so RLS
-- on underlying tables is enforced, plus grants for Data API access.

DROP VIEW IF EXISTS public.job_updates_with_profile;

CREATE OR REPLACE VIEW public.job_updates_with_profile
WITH (security_invoker = true)
AS
SELECT
  ju.id,
  ju.job_sheet_id,
  ju.update_note,
  ju.status_changed_to,
  ju.created_at,
  ju.updated_by,
  p.full_name AS updated_by_name,
  p.id AS updated_by_id
FROM public.job_updates ju
LEFT JOIN public.profiles p ON p.id = ju.updated_by;

GRANT SELECT ON public.job_updates_with_profile TO authenticated;
GRANT SELECT ON public.job_updates_with_profile TO anon;
