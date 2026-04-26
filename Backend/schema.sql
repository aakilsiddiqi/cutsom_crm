-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by all authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can manage profiles"
  ON public.profiles FOR ALL TO authenticated 
  USING (public.is_admin());


-- ==========================================
-- 2. JOB SHEETS TABLE
-- ==========================================
CREATE TABLE public.job_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_number TEXT NOT NULL,
  customer_name TEXT,
  customer_mobile TEXT,
  entry_date_time TIMESTAMPTZ DEFAULT NOW(),
  machine_model TEXT,
  issues_description TEXT,
  status TEXT NOT NULL DEFAULT 'In Queue' CHECK (status IN ('In Queue', 'In Progress', 'Completed', 'On Hold')),
  assigned_to UUID REFERENCES public.profiles(id),
  admin_instructions TEXT,
  parts_needed TEXT[],
  parts_used JSONB,
  photos TEXT[],
  completed_at TIMESTAMPTZ,
  tat_hours NUMERIC,
  created_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for job_sheets
ALTER TABLE public.job_sheets ENABLE ROW LEVEL SECURITY;

-- Job Sheets Policies
CREATE POLICY "Job sheets viewable by admin, assignee, or creator"
  ON public.job_sheets FOR SELECT TO authenticated
  USING (
    public.is_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "Users can create job sheets"
  ON public.job_sheets FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Job sheets updatable by admin, assignee, or creator"
  ON public.job_sheets FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR 
    assigned_to = auth.uid() OR 
    created_by = auth.uid()
  );

CREATE POLICY "Only admins can delete job sheets"
  ON public.job_sheets FOR DELETE TO authenticated
  USING (public.is_admin());

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_sheets_modtime
    BEFORE UPDATE ON public.job_sheets
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();


-- ==========================================
-- 3. JOB UPDATES TABLE (Activity Log)
-- ==========================================
CREATE TABLE public.job_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_sheet_id UUID REFERENCES public.job_sheets(id) ON DELETE CASCADE NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) DEFAULT auth.uid() NOT NULL,
  update_note TEXT,
  status_changed_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for job_updates
ALTER TABLE public.job_updates ENABLE ROW LEVEL SECURITY;

-- Job Updates Policies
CREATE POLICY "Job updates viewable if job sheet is viewable"
  ON public.job_updates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_sheets 
      WHERE id = job_updates.job_sheet_id 
      AND (public.is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid())
    )
  );

CREATE POLICY "Users can add updates to accessible job sheets"
  ON public.job_updates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_sheets 
      WHERE id = job_sheet_id 
      AND (public.is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid())
    )
  );

CREATE POLICY "Updates modifiable by creator or admin"
  ON public.job_updates FOR UPDATE TO authenticated
  USING (updated_by = auth.uid() OR public.is_admin());

CREATE POLICY "Updates deletable by admin only"
  ON public.job_updates FOR DELETE TO authenticated
  USING (public.is_admin());


-- ==========================================
-- 4. STORAGE BUCKET SETUP (Machine Photos)
-- ==========================================
-- Creates the public bucket "machine_photos"
INSERT INTO storage.buckets (id, name, public) VALUES ('machine_photos', 'machine_photos', true);

-- Storage Policies for 'machine_photos'
CREATE POLICY "Public Access to Photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'machine_photos');

CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'machine_photos');

CREATE POLICY "Users can update their own uploaded photos or admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'machine_photos' AND (auth.uid() = owner OR public.is_admin()));

CREATE POLICY "Users can delete their own uploaded photos or admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'machine_photos' AND (auth.uid() = owner OR public.is_admin()));
