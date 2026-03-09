import { createContext, useContext } from 'react';

export type AuthContextType = {
  sessionToken: string | null;
  isLoading: boolean;
  setSessionToken: (token: string) => void;
  logout: (groupId: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
