import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration - hardcoded for mobile app
const supabaseUrl = 'https://bcitmhfdcgkifptycqdh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaXRtaGZkY2draWZwdHljcWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDYxMDQsImV4cCI6MjA3ODc4MjEwNH0.qIFasVjpaxFFk2zeJ1bXVCYYDflH-lMAQKlhkmodyc8';

// Create a single instance of the Supabase client with AsyncStorage for session persistence
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();
export default supabase;
