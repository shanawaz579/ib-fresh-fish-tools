'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseBrowserClient';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Handle the OAuth callback
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/dashboard');
      }
    });

    // Also try to get the session from the URL hash
    const hash = window.location.hash;
    if (hash) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.push('/dashboard');
        }
      });
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white text-lg">Verifying your email...</p>
      </div>
    </div>
  );
}
