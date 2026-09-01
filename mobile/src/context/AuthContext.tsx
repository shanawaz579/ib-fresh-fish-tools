import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getUserRole, type UserRole } from '../auth/roles';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isPacker: boolean;
  role: UserRole;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitUntilTokenIsUsable(session: Session | null) {
  if (!session?.expires_at || !session.expires_in) return;
  const issuedAtMilliseconds = (session.expires_at - session.expires_in) * 1000;
  const delay = Math.min(15_000, Math.max(1_500, issuedAtMilliseconds - Date.now() + 1_500));
  await wait(delay);
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  isPacker: false,
  role: 'viewer',
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPacker, setIsPacker] = useState(false);
  const [role, setRole] = useState<UserRole>('viewer');

  const applySession = (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null;
    const nextRole = getUserRole(nextUser);
    setSession(nextSession);
    setUser(nextUser);
    setRole(nextRole);
    setIsAdmin(nextRole === 'admin');
    setIsPacker(nextRole === 'packer');
    setLoading(false);
  };

  useEffect(() => {
    let restoringSession = true;

    const restoreSession = async () => {
      const { data: { session: storedSession } } = await supabase.auth.getSession();
      if (!storedSession) {
        applySession(null);
        restoringSession = false;
        return;
      }

      // Refresh on app startup so a stale cached JWT cannot block database requests.
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: storedSession.refresh_token,
      });
      const restoredSession = error ? storedSession : data.session;
      await waitUntilTokenIsUsable(restoredSession);
      applySession(restoredSession);
      restoringSession = false;
    };

    restoreSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' && restoringSession) return;
      void waitUntilTokenIsUsable(session).then(() => applySession(session));
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setIsPacker(false);
    setRole('viewer');
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, isAdmin, isPacker, role, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
