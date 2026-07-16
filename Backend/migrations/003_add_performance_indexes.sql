-- 003_add_performance_indexes.sql
-- Performance indexes for frequent query patterns identified via codebase analysis:
--   - Dashboard user queries filtered by assigned_to + role
--   - Status filtering on list screens
--   - Date-ordered listings
--   - Team lookup by role
--   - Login lookup by username

CREATE INDEX IF NOT EXISTS idx_job_sheets_assigned_to ON public.job_sheets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_sheets_status ON public.job_sheets(status);
CREATE INDEX IF NOT EXISTS idx_job_sheets_assigned_to_status ON public.job_sheets(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_job_sheets_created_at ON public.job_sheets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_updates_job_sheet_id ON public.job_updates(job_sheet_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
