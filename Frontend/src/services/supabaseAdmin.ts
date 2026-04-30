import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY!;

// This client bypasses RLS and has full admin access
// Only use for admin operations like creating users
export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});
