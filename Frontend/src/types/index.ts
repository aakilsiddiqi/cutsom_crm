// ==========================================
// DATABASE ROW TYPES
// Exactly mirror the Supabase live schema columns.
// Nullable columns are typed as `string | null` (not optional)
// so TypeScript catches missing null-checks.
// ==========================================

export type UserRole = 'admin' | 'user';

/** Mirrors: public.profiles */
export type UserProfile = {
  id: string;                  // uuid, PK, references auth.users
  username: string;            // text, unique, NOT NULL
  email: string;               // text, NOT NULL
  full_name: string | null;    // text, nullable
  role: UserRole;              // text, NOT NULL, 'admin' | 'user'
  phone: string | null;        // text, nullable
  created_at: string;          // timestamptz, DEFAULT NOW()
};

/** Part stored inside job_sheets.parts_used JSONB column */
export type PartUsed = {
  name: string;
  quantity: number;
};

export type JobSheetStatus = 'In Queue' | 'In Progress' | 'Completed' | 'On Hold';

/**
 * Mirrors: public.job_sheets (DB columns only).
 * Join shapes (assignee, creator) are on JobSheetWithJoins below.
 */
export type JobSheetRow = {
  id: string;
  registration_number: string;
  customer_name: string | null;
  customer_mobile: string | null;
  entry_date_time: string;
  machine_model: string | null;
  issues_description: string | null;
  status: JobSheetStatus;
  assigned_to: string | null;
  admin_instructions: string | null;
  parts_needed: string[] | null;
  parts_used: PartUsed[] | null;   // jsonb -> {name, quantity}[]
  photos: string[] | null;          // text[] of public Storage URLs
  completed_at: string | null;
  tat_hours: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** JobSheetRow extended with query join results */
export type JobSheet = JobSheetRow & {
  assignee?: UserProfile | null;
  creator?: UserProfile | null;
};

/** Mirrors: public.job_updates_with_profile view (or standard table if fields appended) */
export type JobUpdate = {
  id: string;
  job_sheet_id: string;
  updated_by?: string; // Kept for backwards compatibility if still in table
  updated_by_id?: string;
  updated_by_name?: string;
  update_note: string | null;
  status_changed_to: JobSheetStatus | null;
  created_at: string;
};

// ==========================================
// NAVIGATION TYPES
// ==========================================
export type RootStackParamList = {
  Auth: undefined;
  AdminDashboard: undefined;
  UserDashboard: undefined;
  CreateJobSheet: undefined;
  JobSheetDetail: { jobSheetId: string };
  EditJobSheet: { jobSheetId: string };
};

// ==========================================
// STORAGE CONSTANTS
// Centralised so a bucket rename is a one-line change.
// ==========================================
export const STORAGE_BUCKETS = {
  MACHINE_PHOTOS: 'machine_photos',
} as const;
