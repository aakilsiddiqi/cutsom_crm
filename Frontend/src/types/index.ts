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
  is_active: boolean;          // boolean, DEFAULT true
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
  service_location: 'Workshop' | 'On-Site';
  serial_number: string | null;
  priority: 'Normal' | 'Urgent';
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
  job_sheet_id: string | null;
  update_note: string | null;
  status_changed_to: string | null;
  created_at: string;
  updated_by: string;
  updated_by_name: string | null;
  updated_by_id: string | null;
};

// ==========================================
// NAVIGATION TYPES
// ==========================================
export type RootStackParamList = {
  Auth: undefined;
  AdminNavigator: undefined;
  AdminDashboard: undefined;
  AllJobs: undefined;
  Team: undefined;
  JobDetailAdminScreen: { jobSheetId: string };
  UserDashboard: undefined;
  CreateJobSheet: undefined;
  JobSheetDetail: { jobSheetId: string };
  EditJobSheet: { jobSheetId: string };
  Settings: undefined;
  EditProfile: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  JobDetailAdminScreen: { jobSheetId: string };
  Settings: undefined;
  AddTechnician: undefined;
  EditProfile: undefined;
  CreateJobSheet: undefined;
  RevenueDashboard: undefined;
  RevenueTransactions: undefined;
  RevenueTransactionForm: { transactionId?: string } | undefined;
  RevenueTransactionDetail: { transactionId: string };
  OutstandingCustomers: undefined;
  CustomerDetail: { customerId: string };
};

// ==========================================
// STORAGE CONSTANTS
// Centralised so a bucket rename is a one-line change.
// ==========================================
export const STORAGE_BUCKETS = {
  MACHINE_PHOTOS: 'machine_photos',
} as const;

// ==========================================
// REVENUE TYPES
// ==========================================

export type RevenueTransactionType =
  | 'Income' | 'Client Payment' | 'Refund' | 'Adjustment'
  | 'Expense' | 'Amount Given' | 'Bills' | 'Vendor Payment'
  | 'Other';

export type RevenueCategory =
  | 'Service' | 'Parts' | 'Labour' | 'Consultation' | 'Sales' | 'Rent'
  | 'Utilities' | 'Salary' | 'Maintenance' | 'Travel' | 'Office'
  | 'Tax' | 'Insurance' | 'Marketing' | 'Training' | 'Software'
  | 'Other';

export type RevenueStatus =
  | 'Pending' | 'Partially Paid' | 'Paid' | 'Cancelled' | 'Refunded' | 'Adjusted';

export type RevenuePaymentMode =
  | 'Cash' | 'Bank Transfer' | 'Cheque' | 'Credit Card' | 'Debit Card'
  | 'UPI' | 'Online' | 'Other';

export const REVENUE_TRANSACTION_TYPES: RevenueTransactionType[] = [
  'Income', 'Client Payment', 'Refund', 'Adjustment',
  'Expense', 'Amount Given', 'Bills', 'Vendor Payment',
];

export const REVENUE_CATEGORIES: RevenueCategory[] = [
  'Service', 'Parts', 'Labour', 'Consultation', 'Rent',
  'Utilities', 'Salary', 'Maintenance', 'Travel', 'Office',
  'Tax', 'Insurance', 'Marketing', 'Training', 'Software', 'Other',
];

export const REVENUE_STATUSES: RevenueStatus[] = [
  'Pending', 'Partially Paid', 'Paid', 'Cancelled',
];

export const REVENUE_PAYMENT_MODES: RevenuePaymentMode[] = [
  'Cash', 'Bank Transfer', 'Cheque', 'Credit Card', 'Debit Card', 'UPI', 'Online',
];

export const isIncomeType = (t: RevenueTransactionType) =>
  ['Income', 'Client Payment', 'Refund', 'Adjustment'].includes(t);

export const isExpenseType = (t: RevenueTransactionType) =>
  ['Expense', 'Amount Given', 'Bills', 'Vendor Payment'].includes(t);

export type RevenueTransaction = {
  id: string;
  parent_id: string | null;
  transaction_date: string;
  transaction_type: RevenueTransactionType;
  amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: RevenueStatus;
  payment_mode: RevenuePaymentMode | null;
  category: RevenueCategory | null;
  description: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  vendor_name: string | null;
  service_sheet_number: string | null;
  client_id: string | null;
  notes: string | null;
  custom_transaction_type: string | null;
  custom_category: string | null;
  custom_payment_mode: string | null;
  created_by: string;
  updated_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RevenueAuditLog = {
  id: string;
  transaction_id: string;
  action: string;
  old_data: any;
  new_data: any;
  changed_by: string;
  created_at: string;
};

export type RevenueSummary = {
  total_income: number;
  total_expense: number;
  net_profit: number;
  profit_margin: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  pending_bills: number;
  total_transactions: number;
  collection_rate: number;
};

export type RevenueFilters = {
  page?: number;
  page_size?: number;
  transaction_type?: RevenueTransactionType;
  category?: RevenueCategory;
  status?: RevenueStatus;
  client_id?: string;
  vendor_name?: string;
  payment_mode?: RevenuePaymentMode;
  invoice_number?: string;
  customer_name?: string;
  service_sheet_number?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
};

export type Customer = {
  id: string;
  name: string;
  name_normalized: string;
  created_at: string;
};

export type CustomerLedgerEntry = {
  id: string;
  customer_id: string;
  transaction_id: string | null;
  entry_type: 'invoice' | 'payment' | 'adjustment' | 'refund' | 'other';
  direction: 'debit' | 'credit';
  amount: number;
  running_balance: number;
  description: string | null;
  created_at: string;
};

export type CustomerSummary = {
  customer: Customer;
  total_revenue: number;
  total_outstanding: number;
  total_paid: number;
  pending_amount: number;
  transaction_count: number;
  last_payment_date: string | null;
  last_transaction_date: string | null;
};

export type OutstandingCustomer = CustomerSummary & { status: 'critical' | 'warning' | 'good' };
