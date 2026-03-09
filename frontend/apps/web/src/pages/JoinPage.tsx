import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('roomId');

  useEffect(() => {
    if (roomId) navigate(`/group/${roomId}`);
  }, [roomId, navigate]);

  if (!roomId) return <p>Scan a QR code to join a group.</p>;
  return <p>Joining group...</p>;
}
