-- 001_add_user_email_lookup.sql
-- Adds RPC function for username → email resolution used in login flow.
-- Created via Supabase Dashboard SQL editor, migrating to version control.

CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM public.profiles WHERE LOWER(username) = LOWER(p_username);
$$;
