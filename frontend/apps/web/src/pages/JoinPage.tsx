import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAuth } from '../providers/AuthContext';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoading } = useAuth();
  const roomId = searchParams.get('roomId');

  useEffect(() => {
    if (!roomId || isLoading) return;

    // TODO: call GET /group/join?group_id=<roomId> with Bearer token before navigating
    // TODO: error states
    navigate(`/group/${roomId}`);
  }, [roomId, isLoading, navigate]);

  if (!roomId) return <p>Scan a QR code to join a group.</p>;
  return <p>Joining group...</p>;
}
