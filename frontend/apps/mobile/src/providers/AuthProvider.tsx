import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();
const GOOGLE_REDIRECT_URI = 'eezyreceipt://login';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getValueFromUrl(url: string, key: string): string | null {
  const hashPart = url.includes('#') ? url.split('#')[1] : '';
  const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';

  const hashParams = new URLSearchParams(hashPart);
  const queryParams = new URLSearchParams(queryPart);

  return hashParams.get(key) ?? queryParams.get(key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        if (mounted) {
          setSession(data.session);
        }
      } catch {
        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signInWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      },
      signUpWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          throw error;
        }
      },
      signInWithGoogle: async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: GOOGLE_REDIRECT_URI,
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          throw error;
        }

        if (!data?.url) {
          throw new Error('Unable to start Google sign-in flow.');
        }

        const browserResult = await WebBrowser.openAuthSessionAsync(
          data.url,
          GOOGLE_REDIRECT_URI,
        );

        if (browserResult.type !== 'success') {
          return;
        }

        const accessToken = getValueFromUrl(browserResult.url, 'access_token');
        const refreshToken = getValueFromUrl(browserResult.url, 'refresh_token');
        const authCode = getValueFromUrl(browserResult.url, 'code');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            throw sessionError;
          }
          return;
        }

        if (authCode) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(authCode);
          if (exchangeError) {
            throw exchangeError;
          }
          return;
        }

        throw new Error('Google sign-in did not return auth tokens.');
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
