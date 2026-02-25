import { createContext, useContext } from 'react';

export interface AuthContextType {
  accessToken: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  accessToken: null,
});

export const useAuth = () => useContext(AuthContext);
