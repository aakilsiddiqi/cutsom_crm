import { PostgrestError } from '@supabase/supabase-js';

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

export async function fetchWithRetry<T>(
  fn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  signal?: AbortSignal
): Promise<T | null> {
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) return null;

    const { data, error } = await fn();
    if (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        continue;
      }
      console.warn('fetchWithRetry exhausted:', error.message);
      return null;
    }
    return data;
  }
  return null;
}

export function useAbortSignal(): [AbortSignal, () => void] {
  const controller = new AbortController();
  return [controller.signal, () => controller.abort()];
}
