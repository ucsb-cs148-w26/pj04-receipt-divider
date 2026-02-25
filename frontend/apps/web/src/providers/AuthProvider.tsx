// import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';

// TODO: once supabase client is set up:
// 1. add supabase import
// 2. uncomment useState, useEffect import above and the hook below
// 3. change AuthContext.Provider value (line 25) to just { accessToken }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // const [accessToken, setAccessToken] = useState<string | null>(null);

  // useEffect(() => {
  //   const initAuth = async () => {
  //     let session = (await supabase.auth.getSession()).data.session;
  //     if (!session) {
  //       const { data } = await supabase.auth.signInAnonymously();
  //       session = data.session;
  //     }
  //     setAccessToken(session?.access_token ?? null);
  //   };
  //   initAuth();
  // }, []);

  return (
    <AuthContext.Provider value={{ accessToken: null }}>
      {children}
    </AuthContext.Provider>
  );
}
