import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { environment } from '../config/environment';
import { createSupabaseFetch } from './supabaseFetch';

// Create a single instance of the Supabase client with AsyncStorage for session persistence
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      db: {
        schema: environment.supabaseSchema,
      },
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: createSupabaseFetch(),
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();
export default supabase;
