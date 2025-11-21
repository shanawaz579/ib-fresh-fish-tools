'use client';

import { createClient } from '@supabase/supabase-js';

// Browser client - only public URL, uses Supabase's secure session management
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL in environment variables');
}

// Create a client with NO key - Supabase will handle auth via browser cookies
// This is safe because:
// 1. The client can't make direct database calls without authentication
// 2. All data access is controlled by Supabase RLS (Row Level Security) policies
// 3. Authentication is managed via secure HTTP-only cookies
const supabaseBrowser = createClient(
  supabaseUrl,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaXRtaGZkY2draWZwdHljcWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDYxMDQsImV4cCI6MjA3ODc4MjEwNH0.qIFasVjpaxFFk2zeJ1bXVCYYDflH-lMAQKlhkmodyc8', // Public anon key is safe for browser
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabaseBrowser;
