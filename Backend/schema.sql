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
  is_active BOOLEAN DEFAULT TRUE,
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

-- Username → email lookup for login
CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM public.profiles WHERE LOWER(username) = LOWER(p_username);
$$;

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
  service_location TEXT DEFAULT 'Workshop' CHECK (service_location IN ('Workshop', 'On-Site')),
  serial_number TEXT,
  priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Urgent')),
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
  job_sheet_id UUID REFERENCES public.job_sheets(id) ON DELETE SET NULL DEFAULT NULL,
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
    job_updates.job_sheet_id IS NULL
    OR EXISTS (
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

-- ==========================================
-- 5. JOB UPDATES VIEW (with profile names)
-- ==========================================
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

-- ==========================================
-- 6. PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_job_sheets_assigned_to ON public.job_sheets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_sheets_status ON public.job_sheets(status);
CREATE INDEX IF NOT EXISTS idx_job_sheets_assigned_to_status ON public.job_sheets(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_job_sheets_created_at ON public.job_sheets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_updates_job_sheet_id ON public.job_updates(job_sheet_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==========================================
-- 7. MIGRATIONS (run in order on existing DB)
-- ==========================================

-- Migration 1: Keep deletion logs when job sheet is removed
-- ALTER TABLE public.job_updates
--   DROP CONSTRAINT job_updates_job_sheet_id_fkey,
--   ALTER COLUMN job_sheet_id DROP NOT NULL,
--   ADD CONSTRAINT job_updates_job_sheet_id_fkey
--     FOREIGN KEY (job_sheet_id) REFERENCES public.job_sheets(id) ON DELETE SET NULL;

-- Migration 2: Allow viewing logs for deleted sheets (null job_sheet_id)
-- DROP POLICY IF EXISTS "Job updates viewable if job sheet is viewable" ON public.job_updates;
-- CREATE POLICY "Job updates viewable if job sheet is viewable"
--   ON public.job_updates FOR SELECT TO authenticated
--   USING (
--     job_updates.job_sheet_id IS NULL
--     OR EXISTS (
--       SELECT 1 FROM public.job_sheets 
--       WHERE id = job_updates.job_sheet_id 
--       AND (public.is_admin() OR assigned_to = auth.uid() OR created_by = auth.uid())
--     )
--   );

-- ==========================================
-- 8. REVENUE TRANSACTIONS TABLE
-- ==========================================
CREATE TABLE public.revenue_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES public.revenue_transactions(id) ON DELETE RESTRICT,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'Income','Expense','Amount Given','Amount Taken',
    'Bills','Client Payment','Vendor Payment','Refund','Adjustment','Other'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode TEXT DEFAULT 'Cash' CHECK (payment_mode IN ('Cash','Bank Transfer','Cheque','UPI','Card','Other')),
  category TEXT NOT NULL CHECK (category IN (
    'Marketing','Salary','Infrastructure','Software','Hardware',
    'Rent','Utilities','Sales','Miscellaneous','Other'
  )),
  description TEXT,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendor_name TEXT,
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN (
    'Pending','Partially Paid','Paid','Cancelled','Refunded','Adjusted'
  )),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  created_by UUID REFERENCES public.profiles(id) NOT NULL DEFAULT auth.uid(),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.revenue_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Revenue admin-only select"
  ON public.revenue_transactions FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Revenue admin-only insert"
  ON public.revenue_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Revenue admin-only update"
  ON public.revenue_transactions FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Revenue admin-only delete"
  ON public.revenue_transactions FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_revenue_transactions_modtime
  BEFORE UPDATE ON public.revenue_transactions
  FOR EACH ROW
  EXECUTE PROCEDURE update_modified_column();

-- ==========================================
-- 9. REVENUE AUDIT LOG
-- ==========================================
CREATE TABLE public.revenue_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES public.revenue_transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'create','update','payment','status_change','attachment','soft_delete','restore'
  )),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES public.profiles(id) NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.revenue_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit log admin-only select"
  ON public.revenue_audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Audit log admin-only insert"
  ON public.revenue_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ==========================================
-- 10. REVENUE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_revenue_date ON public.revenue_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_type ON public.revenue_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_revenue_category ON public.revenue_transactions(category);
CREATE INDEX IF NOT EXISTS idx_revenue_status ON public.revenue_transactions(status);
CREATE INDEX IF NOT EXISTS idx_revenue_client ON public.revenue_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_revenue_parent ON public.revenue_transactions(parent_id);
CREATE INDEX IF NOT EXISTS idx_revenue_audit_txn ON public.revenue_audit_log(transaction_id);

-- ==========================================
-- 11. CUSTOMERS TABLE (Customer Master)
-- ==========================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name_normalized ON public.customers(LOWER(TRIM(name_normalized)));

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers admin-only select"
  ON public.customers FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Customers admin-only insert"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Customers admin-only update"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.is_admin());

-- ==========================================
-- 12. CUSTOMER LEDGER TABLE
-- ==========================================
CREATE TABLE public.customer_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.revenue_transactions(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('invoice','payment','adjustment','refund','other')),
  direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  running_balance NUMERIC(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer ledger admin-only select"
  ON public.customer_ledger FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Customer ledger admin-only insert"
  ON public.customer_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON public.customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_created ON public.customer_ledger(customer_id, created_at DESC);

-- ==========================================
-- 13. REVENUE TRANSACTIONS ADDITIONS
-- ==========================================
ALTER TABLE public.revenue_transactions
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS service_sheet_number TEXT,
  ADD COLUMN IF NOT EXISTS custom_transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS custom_category TEXT,
  ADD COLUMN IF NOT EXISTS custom_payment_mode TEXT;

CREATE INDEX IF NOT EXISTS idx_revenue_customer_name ON public.revenue_transactions(customer_name);
CREATE INDEX IF NOT EXISTS idx_revenue_sheet_number ON public.revenue_transactions(service_sheet_number);
