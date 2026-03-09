import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { jwtDecode } from 'jwt-decode';
import { AuthContext } from './AuthContext';
import { supabase } from '../services/supabase';

const SESSION_TOKEN_KEY = 'sessionToken';

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = jwtDecode(token);
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000 > Date.now();
    }
    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);

        if (!storedToken || !isTokenValid(storedToken)) {
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
          setSessionToken(null);
          setIsLoading(false);
          return;
        }

        setSessionToken(storedToken);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, []);

  const logout = useCallback(
    async (groupId: string) => {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setSessionToken(null);
      await supabase.auth.signOut();
      navigate(`/profile?roomId=${groupId}`);
    },
    [navigate],
  );

  const setSessionTokenWithStorage = useCallback((token: string) => {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    setSessionToken(token);
  }, []);

  const value = useMemo(
    () => ({
      sessionToken,
      isLoading,
      setSessionToken: setSessionTokenWithStorage,
      logout,
    }),
    [sessionToken, isLoading, setSessionTokenWithStorage, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
