import { createContext, useContext } from 'react';

export type AuthContextType = {
  accessToken: string | null;
  isLoading: boolean;
  setAccessToken: (token: string) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
