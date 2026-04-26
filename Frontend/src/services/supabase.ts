import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://lijzfdwqwyyjfiyqfkpc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpanpmZHdxd3l5amZpeXFma3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTY2MTEsImV4cCI6MjA5Mjc5MjYxMX0.0r9Bp-1fcMOS2a5n6xMi1RQEEVex4S3PtkBIGVk6jNA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage on native (Android/iOS); Supabase uses localStorage automatically on web
    storage: Platform.OS !== 'web' ? AsyncStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
