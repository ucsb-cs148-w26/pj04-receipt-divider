import { Navigate, useParams } from 'react-router';
import { useAuth } from '../providers/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { sessionToken: accessToken, isLoading } = useAuth();
  const { roomId } = useParams<{ roomId: string }>();

  if (isLoading) {
    return null;
  }

  if (!accessToken) {
    const redirectTo = roomId ? `/join?roomId=${roomId}` : '/join';
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
