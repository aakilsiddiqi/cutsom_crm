import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { STORAGE_BUCKETS } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * In-memory fallback storage — used when AsyncStorage is unavailable
 * (e.g. Expo Go cold start before native modules are ready).
 * Sessions won't persist across app restarts in this mode, but the
 * app won't crash.
 */
const memoryStore: Record<string, string> = {};

const MemoryStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => memoryStore[key] ?? null,
  setItem: async (key: string, value: string): Promise<void> => { memoryStore[key] = value; },
  removeItem: async (key: string): Promise<void> => { delete memoryStore[key]; },
};

/**
 * Try to use AsyncStorage on native; fall back to in-memory store if
 * the native module isn't ready yet. On web, Supabase uses localStorage.
 */
const getNativeStorage = () => {
  if (Platform.OS === 'web') return undefined; // Supabase defaults to localStorage on web
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (!AsyncStorage) return MemoryStorageAdapter;
    return {
      getItem: async (key: string): Promise<string | null> => {
        try { return await AsyncStorage.getItem(key); } catch { return null; }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try { await AsyncStorage.setItem(key, value); } catch { /* ignore */ }
      },
      removeItem: async (key: string): Promise<void> => {
        try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
      },
    };
  } catch {
    return MemoryStorageAdapter;
  }
};

/**
 * Supabase client.
 * Type-safety at the call site is provided by our manual types in src/types/index.ts.
 * e.g. supabase.from('profiles').select('*').returns<UserProfile[]>()
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getNativeStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/**
 * Returns the public URL for a file in the machine_photos bucket.
 * Usage: getPhotoUrl('jobs/filename.jpg')
 */
export const getPhotoUrl = (filePath: string): string => {
  const { data } = supabase.storage
    .from(STORAGE_BUCKETS.MACHINE_PHOTOS)
    .getPublicUrl(filePath);
  return data?.publicUrl ?? '';
};

/**
 * Upload a single image using its local URI directly.
 * Fixes React Native Android issues with Blob fetch.
 */
export const uploadPhotoFromUri = async (filePath: string, fileUri: string): Promise<string> => {
  const base64Str = await FileSystem.readAsStringAsync(fileUri, {
    encoding: 'base64',
  });

  const arrayBuffer = decode(base64Str);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.MACHINE_PHOTOS)
    .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;
  return getPhotoUrl(filePath);
};
